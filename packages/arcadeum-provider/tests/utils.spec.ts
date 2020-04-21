
import { expect } from 'chai';
import { ethers } from "ethers"

import * as arcadeum from '../src'

describe('Arcadeum utils', function() {
  it('should generate image hash', () => {
    const walletConfig = {
      threshold: 1,
      signers: [{
        weight: 1,
        address: ethers.constants.AddressZero
      }],
      context: {
        factory: '0x7c2C195CD6D34B8F845992d380aADB2730bB9C6F',
        mainModule: '0x8858eeB3DfffA017D4BCE9801D340D36Cf895CCf'
      }
    }

    const expected = '0xd5eb26a4673c3bf5bb325d407fe1544f0325b97d4b68afa6a28851b6dbbbd29f'
    expect(arcadeum.utils.imageHash(walletConfig)).to.be.equal(expected)
  })

  it('should generate wallet address', () => {
    const walletConfig = {
      threshold: 1,
      signers: [{
        weight: 1,
        address: '0xd63A09C47FDc03e2Cff620446b37f205A7D0679D'
      }],
      context: {
        factory: '0x7c2C195CD6D34B8F845992d380aADB2730bB9C6F',
        mainModule: '0x8858eeB3DfffA017D4BCE9801D340D36Cf895CCf'
      }
    }

    const expected = '0xF0BA65550F2d1DCCf4B131B774844DC3d801D886'
    expect(arcadeum.utils.addressOf(walletConfig)).to.be.equal(expected)
  })
})
