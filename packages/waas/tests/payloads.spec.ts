import * as chai from 'chai'
import { ethers } from 'ethers'

import { Payload, hashPacket, signPacket } from '../src/payloads'
import { TransactionsPacket } from '../src/payloads/wallet'

const { expect } = chai

describe('Payloads', () => {
  it('Should sign a transactions payload', async () => {
    const transactionsPacket: TransactionsPacket = {
      code: 'sendTransactions',
      wallet: '0xD67FC48b298B09Ed3D03403d930769C527186c4e',
      chainId: 1,
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
    expect(ethers.utils.hexlify(hash)).to.equal('0xe54e41eca96c1c047ad6a31f80dd3e61ba5f8a6e0a8a83b95e58515afe1780da')
    expect(sessionSignature).to.equal('0xd22e5853e09ea29812774fd658811aa6007781d3a7fa23bf5ab69d58cd18cd6467cf1a7969b982695e35db5514b90313c53a9eb941a986d572b35c5bd1d0a46f1b')
  })
})