import * as chai from 'chai'
import { ethers } from 'ethers'

import { Intent, signIntent } from '../src/intents'
import { IntentName, IntentDataSendTransaction, IntentDataSignMessage } from '../src/clients/intent.gen'
import { newSECP256K1SessionFromPrivateKey } from '../src/session'
import { getDefaultSecureStoreBackend } from '../src/secure-store'

import 'fake-indexeddb/auto'

const { expect } = chai

describe('Payloads', () => {
  it('Should sign a payload', async () => {
    const intent: Intent<IntentDataSendTransaction> = {
      version: '1',
      name: IntentName.sendTransaction,
      issuedAt: 1600000000,
      expiresAt: 1600000000 + 86400,
      data: {
        identifier: 'test-identifier',
        wallet: '0xD67FC48b298B09Ed3D03403d930769C527186c4e',
        network: '1',
        transactions: [
          {
            type: 'erc20send',
            token: ethers.ZeroAddress,
            to: '0x0dc9603d4da53841C1C83f3B550C6143e60e0425',
            value: '0'
          }
        ]
      }
    }

    const secureStoreBackend = getDefaultSecureStoreBackend()
    if (!secureStoreBackend) {
      throw new Error('Secure store backend not available')
    }
    const session = await newSECP256K1SessionFromPrivateKey(
      '0xecd39e2cdadc2427255042ca7e0f86368bd7aa6e3c99470444b7d073840c1b51',
      secureStoreBackend
    )
    const signedIntent = await signIntent(session, intent)

    expect(signedIntent.signatures.length).to.equal(1)
    expect(signedIntent.signatures[0].sessionId).to.equal(await session.sessionId())
    expect(signedIntent.signatures[0].signature).to.equal(
      '0x0707e5b0a66bc2aa536cd6dfd0ad3f7859ac3a864f9be1d351b450e704b4cf3548b19ffd72f956e1448b0298b862c95489daeb00c0f0686a8c76f22908bf29801b'
    )
  })

  it('Should sign a message payload', async () => {
    const intent: Intent<IntentDataSignMessage> = {
      version: '1',
      name: IntentName.sendTransaction,
      issuedAt: 1600000000,
      expiresAt: 1600000000 + 86400,
      data: {
        network: '1',
        wallet: '0xD67FC48b298B09Ed3D03403d930769C527186c4e',
        message: '0xdeadbeef'
      }
    }

    const secureStoreBackend = getDefaultSecureStoreBackend()
    if (!secureStoreBackend) {
      throw new Error('Secure store backend not available')
    }
    const session = await newSECP256K1SessionFromPrivateKey(
      '0xecd39e2cdadc2427255042ca7e0f86368bd7aa6e3c99470444b7d073840c1b51',
      secureStoreBackend
    )
    const signedIntent = await signIntent(session, intent)

    expect(signedIntent.signatures.length).to.equal(1)
    expect(signedIntent.signatures[0].sessionId).to.equal(await session.sessionId())
    expect(signedIntent.signatures[0].signature).to.equal(
      '0xf21bd58b31a490895c64eec3848465dc89426a208b2a480013e0f779003474d41be802c900c03841a467e6598785e8e7c29b506ff78ec7d08cdccba2be7ecc8c1c'
    )
  })

  it('Should sign transaction payload', async () => {
    const intent: Intent<IntentDataSendTransaction> = {
      version: '1',
      name: IntentName.sendTransaction,
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
            type: 'contractCall',
            to: '0x140d72763D1ce39Ad4E2e73EC6e8FC53E5b73B64',
            data: {
              abi: 'fillOrKillOrder(uint256 orderId, uint256 maxCost, address[] fees, bytes data)',
              args: [
                '48774435471364917511246724398022004900255301025912680232738918790354204737320',
                '1000000000000000000',
                ['0x8541D65829f98f7D71A4655cCD7B2bB8494673bF'],
                {
                  abi: 'notExpired(uint256,string)',
                  args: ['1600000000', 'Nov 1st, 2020']
                }
              ]
            }
          }
        ]
      }
    }

    const secureStoreBackend = getDefaultSecureStoreBackend()
    if (!secureStoreBackend) {
      throw new Error('Secure store backend not available')
    }
    const session = await newSECP256K1SessionFromPrivateKey(
      '0xecd39e2cdadc2427255042ca7e0f86368bd7aa6e3c99470444b7d073840c1b51',
      secureStoreBackend
    )
    const signedIntent = await signIntent(session, intent)

    expect(signedIntent.signatures.length).to.equal(1)
    expect(signedIntent.signatures[0].sessionId).to.equal(await session.sessionId())
    expect(signedIntent.signatures[0].signature).to.equal(
      '0x692c5c4c969f54dc96b216e41a80b5366829754e652a5a6b499aa7b4fb3c086664cbf282568c863030c4183ae0c05a2861bfb5de1e76fea94f71796ff6cd1c9f1c'
    )
  })
})
