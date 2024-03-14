import * as chai from 'chai'
import { ethers } from 'ethers'

import { Intent, signIntent } from '../src/intents'
import { IntentDataSendTransaction, IntentDataSignMessage } from '../src/clients/intent.gen'
import { newSECP256K1SessionFromPrivateKey } from '../src/session'

import 'fake-indexeddb/auto'

const { expect } = chai

describe('Payloads', () => {
  it('Should sign a payload', async () => {
    const intent: Intent<IntentDataSendTransaction> = {
      version: '1',
      name: 'sendTransactions',
      issuedAt: 1600000000,
      expiresAt: 1600000000 + 86400,
      data: {
        identifier: 'test-identifier',
        wallet: '0xD67FC48b298B09Ed3D03403d930769C527186c4e',
        network: '1',
        transactions: [
          {
            type: 'erc20send',
            token: ethers.constants.AddressZero,
            to: '0x0dc9603d4da53841C1C83f3B550C6143e60e0425',
            value: '0'
          }
        ]
      }
    }

    const session = await newSECP256K1SessionFromPrivateKey('0xecd39e2cdadc2427255042ca7e0f86368bd7aa6e3c99470444b7d073840c1b51')
    const signedIntent = await signIntent(session, intent)

    expect(signedIntent.signatures.length).to.equal(1)
    expect(signedIntent.signatures[0].sessionId).to.equal(await session.sessionId())
    expect(signedIntent.signatures[0].signature).to.equal(
      '0x14682ca0eb116109cdf1d0bad6a84e29787787b4a1779d2b43c28d8705ade929267474e8a7725d5e7540ded2010897d3ecaad32b27c75fbfb4f63ff1cf1a948a1c'
    )
  })

  it('Should sign a message payload', async () => {
    const intent: Intent<IntentDataSignMessage> = {
      version: '1',
      name: 'sendTransactions',
      issuedAt: 1600000000,
      expiresAt: 1600000000 + 86400,
      data: {
        network: '1',
        wallet: '0xD67FC48b298B09Ed3D03403d930769C527186c4e',
        message: '0xdeadbeef'
      }
    }

    const session = await newSECP256K1SessionFromPrivateKey('0xecd39e2cdadc2427255042ca7e0f86368bd7aa6e3c99470444b7d073840c1b51')
    const signedIntent = await signIntent(session, intent)

    expect(signedIntent.signatures.length).to.equal(1)
    expect(signedIntent.signatures[0].sessionId).to.equal(await session.sessionId())
    expect(signedIntent.signatures[0].signature).to.equal(
      '0x768b25315317e551ed7b540e73fdf69d8816dcc763a50c648cf2966849f089a2495103f06c876c502bfb33cb348c4b77ffe39bbd6483b932b806a5817374f9ea1c'
    )
  })

  it('Should sign transaction payload', async () => {
    const intent: Intent<IntentDataSendTransaction> = {
      version: '1',
      name: 'sendTransactions',
      issuedAt: 1600000000,
      expiresAt: 1600000000 + 86400,
      data: {
        identifier: 'test-identifier',
        wallet: '0xD67FC48b298B09Ed3D03403d930769C527186c4e',
        network: '1',
        transactions: [
          {
            type: 'transaction',
            to: '0x479F6a5b0C1728947318714963a583C56A78366A',
            value: '39381',
            data: '0x3251ba32'
          },
          {
            type: 'erc20send',
            token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            to: '0x7b1Bd3474D789e18e2E329E2c53F819B6E687b4A',
            value: '1000'
          },
          {
            type: 'erc721send',
            token: '0xF87E31492Faf9A91B02Ee0dEAAd50d51d56D5d4d',
            to: '0x17fFA2d95b58228e1ECb0C6Ac25A6EfD20BA08E4',
            id: '7',
            safe: true,
            data: '0x112233'
          },
          {
            type: 'erc1155send',
            token: '0x631998e91476da5b870d741192fc5cbc55f5a52e',
            to: '0x91E8aC543C5fEDf9F3Ef8b9dA1500dB84305681F',
            vals: [
              {
                id: '2',
                amount: '5'
              },
              {
                id: '500',
                amount: '1'
              }
            ],
            data: '0x223344'
          },
          {
            type: 'delayedEncode',
            to: '0x140d72763D1ce39Ad4E2e73EC6e8FC53E5b73B64',
            value: '0',
            data: {
              abi: '[{"inputs":[{"internalType":"uint256","name":"_orderId","type":"uint256"},{"internalType":"uint256","name":"_maxCost","type":"uint256"},{"internalType":"address[]","name":"_fees","type":"address[]"},{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"fillOrKillOrder","outputs":[],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_val","type":"uint256"},{"internalType":"string","name":"_data","type":"string"}],"name":"notExpired","outputs":[],"stateMutability":"view","type":"function"},{"inputs":[],"name":"otherMethods","outputs":[],"stateMutability":"nonpayable","type":"function"}]',
              func: 'fillOrKillOrder',
              args: [
                '48774435471364917511246724398022004900255301025912680232738918790354204737320',
                '1000000000000000000',
                '["0x8541D65829f98f7D71A4655cCD7B2bB8494673bF"]',
                {
                  abi: 'notExpired(uint256,string)',
                  func: 'notExpired',
                  args: ['1600000000', 'Nov 1st, 2020']
                }
              ]
            }
          }
        ]
      }
    }

    const session = await newSECP256K1SessionFromPrivateKey('0xecd39e2cdadc2427255042ca7e0f86368bd7aa6e3c99470444b7d073840c1b51')
    const signedIntent = await signIntent(session, intent)

    expect(signedIntent.signatures.length).to.equal(1)
    expect(signedIntent.signatures[0].sessionId).to.equal(await session.sessionId())
    expect(signedIntent.signatures[0].signature).to.equal(
      '0x98dd84b3d4fe077b2f55e2839609b226d8119b9b0ee10756122615a5d68746bf60596069a305a7533123f212b576d16f3f14ad06faed9fc005c32a28bf8bafb21b'
    )
  })
})
