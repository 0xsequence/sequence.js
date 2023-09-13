import * as chai from 'chai'
import { ethers } from 'ethers'

import { Payload, hashPacket, signPacket } from '../src/payloads'
import { TransactionsPacket } from '../src/payloads/wallet'

const { expect } = chai

describe('Payloads', () => {
  it('Should sign a payload', async () => {
    const transactionsPacket: TransactionsPacket = {
      code: 'sendTransactions',
      wallet: '0xD67FC48b298B09Ed3D03403d930769C527186c4e',
      network: '1',
      transactions: [{
        type: 'erc20send',
        token: ethers.constants.AddressZero,
        to: '0x0dc9603d4da53841C1C83f3B550C6143e60e0425',
        value: '0'
      }]
    }

    const sessionSigner = new ethers.Wallet('0xecd39e2cdadc2427255042ca7e0f86368bd7aa6e3c99470444b7d073840c1b51')
    const sessionSignature = await signPacket(sessionSigner, transactionsPacket)

    const payloads: Payload<TransactionsPacket> = {
      version: '1',
      packet: transactionsPacket,
      signatures: [{
        session: sessionSigner.address,
        signature: sessionSignature
      }]
    }

    const hash = hashPacket(payloads)
    expect(ethers.utils.hexlify(hash)).to.equal('0x21d0eeb9c2cd78933e3b44d5ae7ff6c76db2f89e2e35167d34149b607238bcae')
    expect(sessionSignature).to.equal('0xb84ebe339b75ef144065c1dd824d119228fb8128eeb1e74cc39faf6dab76de6b508b4fae06ba88e209ce4e8736085140ac7827293e25f7e3ecd44222bfca76251c')
  })

  it('Should sign a message payload', async () => {
    const messagePacket = {
      code: 'signMessage',
      wallet: '0xD67FC48b298B09Ed3D03403d930769C527186c4e',
      network: '1',
      message: '0xdeadbeef'
    }

    const sessionSigner = new ethers.Wallet('0xecd39e2cdadc2427255042ca7e0f86368bd7aa6e3c99470444b7d073840c1b51')
    const sessionSignature = await signPacket(sessionSigner, messagePacket)

    const payloads: Payload<typeof messagePacket> = {
      version: '1',
      packet: messagePacket,
      signatures: [{
        session: sessionSigner.address,
        signature: sessionSignature
      }]
    }

    const hash = hashPacket(payloads)
    expect(ethers.utils.hexlify(hash)).to.equal('0x26abd75b9e3f2f8f8a777f8e0ac628edb136dbe82a461c9c7ee4b102d654cb87')
    expect(ethers.utils.hexlify(sessionSignature)).to.equal('0xfa8697812a75e3893b7d498695fe699bcf00cfc84a6ca8815bd0a23021e631176dcbfeb7f07b942386277ebc821dc15ac6520e80e4d6d3947e556376d5a74e051c')
  })

  it('Should sign transaction payload', async () => {
    const transactionPacket: TransactionsPacket = {
      code: 'sendTransaction',
      wallet: '0xD67FC48b298B09Ed3D03403d930769C527186c4e',
      network: '10',
      transactions: [{
        type: "transaction",
        to: "0x479F6a5b0C1728947318714963a583C56A78366A",
        value: "39381",
        data: "0x3251ba32"
      }, {
        type: "erc20send",
        token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        to: "0x7b1Bd3474D789e18e2E329E2c53F819B6E687b4A",
        value: "1000"
      }, {
        type: "erc721send",
        token: "0xF87E31492Faf9A91B02Ee0dEAAd50d51d56D5d4d",
        to: "0x17fFA2d95b58228e1ECb0C6Ac25A6EfD20BA08E4",
        id: "7",
        safe: true,
        data: "0x112233"
      }, {
        type: "erc1155send",
        token: "0x631998e91476da5b870d741192fc5cbc55f5a52e",
        to: "0x91E8aC543C5fEDf9F3Ef8b9dA1500dB84305681F",
        vals: [{
          id: "2",
          amount: "5"
        }, {
          id: "500",
          amount: "1"
        }],
        data: "0x223344"
      }]
    }
    
  
    const sessionSigner = new ethers.Wallet('0xecd39e2cdadc2427255042ca7e0f86368bd7aa6e3c99470444b7d073840c1b51')
    const sessionSignature = await signPacket(sessionSigner, transactionPacket)

    const payloads: Payload<typeof transactionPacket> = {
      version: '1',
      packet: transactionPacket,
      signatures: [{
        session: sessionSigner.address,
        signature: sessionSignature
      }]
    }

    const hash = hashPacket(payloads)
    expect(ethers.utils.hexlify(hash)).to.equal('0xf7bbc2ad0d74cccdc1d6a8eae95f39f6f3f7d29f571e8ced744f626168913a00')
    expect(ethers.utils.hexlify(sessionSignature)).to.equal('0x71a0d20a974e8a7cc3643c9ab0cf6f52bbeda20bf486449a6287c09c5f6c7d0a478a5ed8d0747f83c9a8851d9b87c05c1c74e28a0a3a428aef7b067c4bcbb1bb1b')
  })
})