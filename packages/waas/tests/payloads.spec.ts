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
    expect(ethers.utils.hexlify(hash)).to.equal('0x5a4fc6915903806d66e785444fc7ce645814b4c46e16624ba115bd3beb5a762a')
    expect(sessionSignature).to.equal('0xfc02326d953a6e22dafba0a1b06cefd8b524cdefcbbefcd243f578c8c0634d925f05496ab9f1be5d84caa3b40533b9569d9112a9da2fa94605cb1c8b7312a9c21b')
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
    expect(ethers.utils.hexlify(hash)).to.equal('0xf811404061b84abc22011ff0ae291ad61268396f8da1137ce5d8b19202dff4d7')
    expect(ethers.utils.hexlify(sessionSignature)).to.equal('0x0fcfce66291c21110d2c88b77c966a7806c9691517b2479693bfb8db475ecc8002b1c5cf52a45281fc0398992ad8b7b6d0bc49567673fba3e2d11866900f36a11c')
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
    console.log("signer address", sessionSigner.address)
    const sessionSignature = await signPacket(sessionSigner, transactionPacket)
    console.log("sessionSignature", sessionSignature)

    const payloads: Payload<typeof transactionPacket> = {
      version: '1',
      packet: transactionPacket,
      signatures: [{
        session: sessionSigner.address,
        signature: sessionSignature
      }]
    }

    const hash = hashPacket(payloads)
    expect(ethers.utils.hexlify(hash)).to.equal('0x437629d2d86800f7d568ce8f1575cbcb6ec9b30cb3d661bc245fefc6a5f8cf7a')
    expect(ethers.utils.hexlify(sessionSignature)).to.equal('0xfaf2c6af7a18344c4055d61c3475a6e2f43425961fa59bb6309a846ab582b0781016ec62d264eaa732136f9ad371a8da7e638105e1d1c3a9798f45da0807f9801c')
  })
})
