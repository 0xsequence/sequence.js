
import { expect } from 'chai';

import * as arcadeum from '../src'
import { ethers, Signer } from 'ethers';
import { encodeMessageData, recoverConfig } from '../src/utils';

describe('Arcadeum wallet units', function() {
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
      const wallet = new arcadeum.Wallet(config, context, pk)

      const expected = '0xF0BA65550F2d1DCCf4B131B774844DC3d801D886'
      expect(wallet.address).to.be.equal(expected)
    })
  })
  describe('signing', () => {
    it('Should sign a message', async () => {
      const message = '0x1901f0ba65550f2d1dccf4b131b774844dc3d801d886bbd4edcf660f395f21fe94792f7c1da94638270a049646e541004312b3ec1ac5'
      const digest = ethers.utils.arrayify(ethers.utils.keccak256(message))

      const config = {
        threshold: 1,
        signers: [{
          weight: 1,
          address: '0xd63A09C47FDc03e2Cff620446b37f205A7D0679D'
        }],
        context: {
          factory: '0x7c2C195CD6D34B8F845992d380aADB2730bB9C6F',
          mainModule: '0x8858eeB3DfffA017D4BCE9801D340D36Cf895CCf',
          mainModuleUpgradable: '0xC7cE8a07f69F226E52AEfF57085d8C915ff265f7'
        }
      }

      const pk = '0x87306d4b9fe56c2af23c7cc3bc69914eba8f7c8fc1d35b4c9a7dd7ea198a428b'
      const wallet = new arcadeum.Wallet(config, context, pk)

      const expected = '0x0001000173cb0485449f375942c864e14ebd3b21ae2f3b40a8a6aee4c1e54f026f9a02c27f648bc6304d85745836ee1a7569ae1c83caa600030b91762da1fe5330b394981b02'
      expect(await wallet.sign(digest)).to.equal(expected)
    })
    it('Should sign and recover the configuration of a single signer', async () => {
      const pk = ethers.utils.randomBytes(32)
      const wallet = await arcadeum.Wallet.singleOwner(context, pk)

      const message = ethers.utils.toUtf8Bytes('Hi! this is a test message')
      const chainId = 3

      const sig = await wallet.signMessage(message, chainId)
      const digest = encodeMessageData(wallet.address, chainId, ethers.utils.keccak256(message))
      const recovered = recoverConfig(digest, sig)

      expect(recovered.threshold).to.equal(1)
      expect(recovered.signers.length).to.equal(1)
      expect(recovered.signers[0].weight).to.equal(1)
      expect(recovered.signers[0].address).to.equal(wallet.config.signers[0].address)
    })
    it('Should sign and recover the configuration of multiple signers', async () => {
      const singer1 = new ethers.Wallet(ethers.utils.randomBytes(32))
      const singer2 = new ethers.Wallet(ethers.utils.randomBytes(32))
      const wallet = new arcadeum.Wallet(
        {
          threshold: 3,
          signers: [{
            weight: 2,
            address: singer1.address
          }, {
            weight: 5,
            address: singer2.address
          }]
        },
        context,
        singer1
      )

      const message = ethers.utils.toUtf8Bytes('Hi! this is a test message')
      const chainId = 3

      const sig = await wallet.signMessage(message, chainId)
      const digest = encodeMessageData(wallet.address, chainId, ethers.utils.keccak256(message))
      const recovered = recoverConfig(digest, sig)

      expect(recovered.threshold).to.equal(3)
      expect(recovered.signers.length).to.equal(2)
      expect(recovered.signers.find((s) => s.address === singer1.address).weight).to.equal(2)
      expect(recovered.signers.find((s) => s.address === singer2.address).weight).to.equal(5)
    })
  })
})
