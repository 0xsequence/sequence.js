import { expect } from 'chai'

import * as lib from '../src'
import { ethers } from 'ethers'
import { recoverConfig } from '../src'
import { packMessageData } from "@0xsequence/utils"

describe('Wallet units', function() {
  const context = {
    factory: '0x7c2C195CD6D34B8F845992d380aADB2730bB9C6F',
    mainModule: '0x8858eeB3DfffA017D4BCE9801D340D36Cf895CCf',
    mainModuleUpgradable: '0xC7cE8a07f69F226E52AEfF57085d8C915ff265f7'
  }

  describe('wallet creation', () => {

    it('Should return wallet address', () => {
      const config = {
        threshold: 1,
        signers: [{
          weight: 1,
          address: '0xd63A09C47FDc03e2Cff620446b37f205A7D0679D'
        }]
      }

      const pk = '0x87306d4b9fe56c2af23c7cc3bc69914eba8f7c8fc1d35b4c9a7dd7ea198a428b'
      const wallet = new lib.Wallet({ config, context }, pk)

      const expected = '0xF0BA65550F2d1DCCf4B131B774844DC3d801D886'
      expect(wallet.address).to.be.equal(expected)
    })

    it('Should reject non-usable config', () => {
      const config = {
        threshold: 4,
        signers: [
          {
            address: '0x173C645E3a784612bC3132cA8ae47AFE4Ef405c4',
            weight: 1
          },
          {
            address: '0xEc5526D3C399f9810a70D44c90a680Dce93b7bEc',
            weight: 1
          }
        ]
      }

      expect(() => new lib.Wallet({ config })).to.throw(Error)
    })

    it('Should accept non-usable config on non-strict mode', () => {
      const config = {
        threshold: 4,
        signers: [
          {
            address: '0x173C645E3a784612bC3132cA8ae47AFE4Ef405c4',
            weight: 1
          },
          {
            address: '0xEc5526D3C399f9810a70D44c90a680Dce93b7bEc',
            weight: 1
          }
        ]
      }

      expect(() => new lib.Wallet({ config, context, strict: false })).to.not.throw(Error)
    })
  })

  describe('signing', () => {
    it('Should sign a nested message', async () => {
      const context = {
        factory: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        mainModule: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        mainModuleUpgradable: ethers.constants.AddressZero,
        nonStrict: true
      }

      const signer = new ethers.Wallet('0x2bf2dfccb8c9fb4bb4d46ac9e2b537c373b44ae4c2ee66de92e02f132f7c2237')
      expect(signer.address).to.equal('0x1d76701Ba8B8B87Eb36C4cB30B17aea32c22846c')

      const wallet_a = await lib.Wallet.singleOwner(signer, context)
      expect(wallet_a.address).to.equal('0xcBf920895f0A101b85f94903775E61d1B652b6Ca')

      const wallet = await lib.Wallet.singleOwner(wallet_a, context)
      expect(wallet.address).to.equal('0x78505fd3f2C93cc112e5653C559c901760A64662')

      const message = "0xa5c192879af3d12649fddbc1923aec506ac2a2697421ca198f2443efca1e17cd46e1090945dd946f32c0f957a013a564c8006e1e756534b4d8821bba94731b98a2c00daf2e5d69275fdbf4753b912878f2abd37fbb4de896d11147c8e7a3f8"

      const signed = await wallet.signMessage(message, 31337, true)
      expect(signed).to.equal("0x00010201cbf920895f0a101b85f94903775e61d1b652b6ca004700010001bb1be304f3e34bca7ce59067d47f70cddf41c6888166a924570319b6d0e1606e37d92b1ad79895d7e78e8e621a3ecadc884a6cbca4fff1b3e130c7313c1772591c0203")
    })
    it('Should sign a message', async () => {
      const message = '0x1901f0ba65550f2d1dccf4b131b774844dc3d801d886bbd4edcf660f395f21fe94792f7c1da94638270a049646e541004312b3ec1ac5'
      const digest = ethers.utils.arrayify(ethers.utils.keccak256(message))

      const config = {
        threshold: 1,
        signers: [{
          weight: 1,
          address: '0xd63A09C47FDc03e2Cff620446b37f205A7D0679D'
        }]
      }

      const pk = '0x87306d4b9fe56c2af23c7cc3bc69914eba8f7c8fc1d35b4c9a7dd7ea198a428b'
      const wallet = (new lib.Wallet({ config, context, strict: false }, pk))

      const expected = '0x00010001a0fb306480bc3027c04d33a16370f4618b29f2d5b89464f526045c94802bc9d1525389c364b75daf58e859ed0d6105aac6b3718e4659814c7793c626653edb871b02'
      expect(await wallet.sign(digest, true, 1)).to.equal(expected)
    })

    it('Should sign and recover the configuration of a single signer', async () => {
      const pk = ethers.utils.randomBytes(32)
      const wallet = await lib.Wallet.singleOwner(pk, { ...context, nonStrict: true })

      const message = ethers.utils.toUtf8Bytes('Hi! this is a test message')
      const chainId = 3

      const sig = await wallet.signMessage(message, chainId)
      const digest = packMessageData(wallet.address, chainId, ethers.utils.keccak256(message))
      const recovered = await recoverConfig(digest, sig)

      expect(recovered.threshold).to.equal(1)
      expect(recovered.signers.length).to.equal(1)
      expect(recovered.signers[0].weight).to.equal(1)
      expect(recovered.signers[0].address).to.equal(wallet.config.signers[0].address)
    })

    it('Should sign and recover the configuration of multiple signers', async () => {
      const signer1 = new ethers.Wallet(ethers.utils.randomBytes(32))
      const signer2 = new ethers.Wallet(ethers.utils.randomBytes(32))
      const wallet = new lib.Wallet({
        config: {
          threshold: 3,
          signers: [{
            weight: 2,
            address: signer1.address
          }, {
            weight: 5,
            address: signer2.address
          }]
        },
        context,
        strict: false
      }, signer1)

      const message = ethers.utils.toUtf8Bytes('Hi! this is a test message')
      const chainId = 3

      const sig = await wallet.signMessage(message, chainId)
      const digest = packMessageData(wallet.address, chainId, ethers.utils.keccak256(message))
      const recovered = await recoverConfig(digest, sig)

      expect(recovered.threshold).to.equal(3)
      expect(recovered.signers.length).to.equal(2)
      expect(recovered.signers.find((s) => s.address === signer1.address).weight).to.equal(2)
      expect(recovered.signers.find((s) => s.address === signer2.address).weight).to.equal(5)
    })
  })

})
