import * as chai from 'chai'
import { ethers } from 'ethers'

import { Payload, hashPacket, signPacket } from '../src/payloads'
import { TransactionsPacket } from '../src/payloads/packets/transactions'

const { expect } = chai

describe('Payloads', () => {
  it('Should sign a payload', async () => {
    const transactionsPacket: TransactionsPacket = {
      code: 'sendTransactions',
      identifier: 'test-identifier',
      issued: 1600000000,
      expires: 1600000000 + 86400,
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
    expect(ethers.utils.hexlify(hash)).to.equal('0x893060f818437f8e3d9b4d8e103c5eb3c325fa25dd0221fb7b61cca6dd03a79e')
    expect(sessionSignature).to.equal('0xcca6253c4fd281247ddd0fa487252ef91932eaec8d68b61f0901ccaa70345bf66fdbbd98ed3e3c9752f9e35ef2a7bc88dd9c8ae23c594241b476fe988824ab881c')
  })

  it('Should sign a message payload', async () => {
    const messagePacket = {
      code: 'signMessage',
      issued: 1600000000,
      expires: 1600000000 + 86400,
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
    expect(ethers.utils.hexlify(hash)).to.equal('0x5b15538a25716e951630dde1cf38ae056d764976145d1134576461203a621ddb')
    expect(ethers.utils.hexlify(sessionSignature)).to.equal('0x827b2a2afbf4a8a79e761fdb26e567b519a56a06e897dce5517b3ccfb408b55f20aaba276c1dade28112f51fe7262fbd0508da0019c0f8582c41b2be451ddede1b')
  })

  it('Should sign transaction payload', async () => {
    const transactionPacket: TransactionsPacket = {
      code: 'sendTransaction',
      identifier: 'test-identifier',
      issued: 1600000000,
      expires: 1600000000 + 86400,
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
      }, {
				"type": "delayedEncode",
        "to": "0x140d72763D1ce39Ad4E2e73EC6e8FC53E5b73B64",
        "value": "0",
				"data": {
					"abi": "[{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"_orderId\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"_maxCost\",\"type\":\"uint256\"},{\"internalType\":\"address[]\",\"name\":\"_fees\",\"type\":\"address[]\"},{\"internalType\":\"bytes\",\"name\":\"_data\",\"type\":\"bytes\"}],\"name\":\"fillOrKillOrder\",\"outputs\":[],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"_val\",\"type\":\"uint256\"},{\"internalType\":\"string\",\"name\":\"_data\",\"type\":\"string\"}],\"name\":\"notExpired\",\"outputs\":[],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"otherMethods\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"}]",
					"func": "fillOrKillOrder",
					"args": [
						"48774435471364917511246724398022004900255301025912680232738918790354204737320",
						"1000000000000000000",
						"[\"0x8541D65829f98f7D71A4655cCD7B2bB8494673bF\"]",
						{
							"abi": "notExpired(uint256,string)",
							"func": "notExpired",
							"args": [
								"1600000000",
								"Nov 1st, 2020"
							]
						}
					]
				}
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
    expect(ethers.utils.hexlify(hash)).to.equal('0x2feb22d5631075041c5aaafce98da8950d706a9eca8d9ea2b28ea95142d8e890')
    expect(ethers.utils.hexlify(sessionSignature)).to.equal('0xdd137166e6e73fcaa710e822aa3eef3d501ef1b7969d59e8583cb602a32233e0628d4e28ea5a562a1ccf6bd85bfccfcd1004673a28763640cca33002fbedbb3a1b')
  })
})
