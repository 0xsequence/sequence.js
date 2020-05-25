import { expect } from 'chai'
import { ethers } from 'ethers'

import * as arcadeum from '../src'

describe('Arcadeum utils', function () {
  it('Should generate image hash', () => {
    const config = {
      threshold: 1,
      signers: [
        {
          weight: 1,
          address: ethers.constants.AddressZero
        }
      ]
    }

    const expected = '0xd5eb26a4673c3bf5bb325d407fe1544f0325b97d4b68afa6a28851b6dbbbd29f'
    expect(arcadeum.utils.imageHash(config)).to.be.equal(expected)
  })

  it('Should generate wallet address', () => {
    const config = {
      threshold: 1,
      signers: [
        {
          weight: 1,
          address: '0xd63A09C47FDc03e2Cff620446b37f205A7D0679D'
        }
      ]
    }

    const context = {
      factory: '0x7c2C195CD6D34B8F845992d380aADB2730bB9C6F',
      mainModule: '0x8858eeB3DfffA017D4BCE9801D340D36Cf895CCf'
    }

    const expected = '0xF0BA65550F2d1DCCf4B131B774844DC3d801D886'
    expect(arcadeum.utils.addressOf(config, context)).to.be.equal(expected)
  })
})
