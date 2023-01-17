
import * as chai from 'chai'
import { assert } from 'console'
import { ethers } from 'ethers'
import { isSignerStatusPending, isSignerStatusRejected, isSignerStatusSigned, Orchestrator, Status } from '../src'
import { SapientSigner } from '../src/signers'

const { expect } = chai

describe('Orchestrator', () => {
  it('Should call all signers', async () => {
    const signers = [
      ethers.Wallet.createRandom(),
      ethers.Wallet.createRandom(),
      ethers.Wallet.createRandom()
    ]

    const orchestrator = new Orchestrator(signers)
    const signature = await orchestrator.signMessage('0x1234')

    expect(Object.keys(signature.signers)).to.have.lengthOf(signers.length)

    for (const signer of signers) {
      expect(signature.signers).to.have.property(signer.address)
    }
  })

  it('Should call callback with status updates', async () => {
    const signers = [
      ethers.Wallet.createRandom(),
      ethers.Wallet.createRandom(),
      ethers.Wallet.createRandom()
    ]

    const orchestrator = new Orchestrator(signers)

    let callbackCallsA = 0
    orchestrator.subscribe((status) => {
      // Status should have all signers
      let numErrors = 0
      let numSignatures = 0
      let numPending = 0
      expect(Object.keys(status.signers)).to.have.lengthOf(signers.length)
      for (const signer of signers) {
        expect(status.signers).to.have.property(signer.address)
        const signerStatus = status.signers[signer.address]

        if (isSignerStatusRejected(signerStatus)) {
          numErrors++
        }

        if (isSignerStatusPending(signerStatus)) {
          numPending++
        }

        if (isSignerStatusSigned(signerStatus)) {
          numSignatures++
        }
      }

      callbackCallsA++

      expect(numErrors).to.be.equal(0)
      expect(numSignatures).to.be.equal(Math.max(callbackCallsA, 3))
      expect(numPending).to.be.equal(Math.min(signers.length - callbackCallsA, 0))
    })

    let callbackCallsB = 0
    await orchestrator.signMessage('0x1234', () => {
      callbackCallsB++
      return false
    })

    // 3 updates + 1 final
    expect(callbackCallsA).to.be.equal(4)

    // only the 3 updates
    expect(callbackCallsB).to.be.equal(3)
  })

  it('getSigners should return all signers', async () => {
    const signers = new Array(10).fill(0).map(() => ethers.Wallet.createRandom())
    const orchestrator = new Orchestrator(signers)
    const result = await orchestrator.getSigners()
    expect(result).to.have.lengthOf(signers.length)
    for (const signer of signers) {
      expect(result).to.include(signer.address)
    }
  })

  it('setSigners should update the signers', async () => {
    const signers = new Array(10).fill(0).map(() => ethers.Wallet.createRandom())
    const orchestrator = new Orchestrator(signers)

    const newSigners = new Array(22).fill(0).map(() => ethers.Wallet.createRandom())
    orchestrator.setSigners(newSigners)
    const result = await orchestrator.getSigners()
    expect(result).to.have.lengthOf(newSigners.length)
    for (const signer of newSigners) {
      expect(result).to.include(signer.address)
    }
  })

  it('exception on signer should be interpreted as error', async () => {
    const brokenSignerEOA = ethers.Wallet.createRandom()
    const brokenSigner: SapientSigner = {
      getAddress: async function (): Promise<string> {
        return brokenSignerEOA.address
      },
      requestSignature: function (message: ethers.utils.BytesLike, callbacks: { onSignature: (signature: ethers.utils.BytesLike) => void; onRejection: (error: string) => void; onStatus: (situation: string) => void }): Promise<boolean> {
        throw new Error('This is a broken signer.')
      },
      notifyStatusChange: function (status: Status): void {},
      isEOA: function (): boolean {
        return true
      }
    }

    const signers = [
      ethers.Wallet.createRandom(),
      brokenSigner,
      ethers.Wallet.createRandom()
    ]

    const orchestrator = new Orchestrator(signers)

    let callbackCallsA = 0
    orchestrator.subscribe(async (status) => {
      // Status should have all signers
      let numErrors = 0
      let numSignatures = 0
      let numPending = 0

      expect(Object.keys(status.signers)).to.have.lengthOf(signers.length)

      for (const signer of signers) {
        expect(status.signers).to.have.property(await signer.getAddress())
        const signerStatus = status.signers[await signer.getAddress()]

        if (isSignerStatusRejected(signerStatus)) {
          numErrors++
        }

        if (isSignerStatusPending(signerStatus)) {
          numPending++
        }

        if (isSignerStatusSigned(signerStatus)) {
          numSignatures++
        }
      }

      callbackCallsA++

      expect(numErrors).to.be.equal(1)
      expect(numSignatures).to.be.equal(Math.max(callbackCallsA, 3))
      expect(numPending).to.be.equal(Math.min(signers.length - callbackCallsA, 0))
    })

    const signature = await orchestrator.signMessage('0x1234')
    expect(Object.keys(signature.signers)).to.have.lengthOf(signers.length)

    for (const signer of signers) {
      const address = await signer.getAddress()
      const status = signature.signers[address]

      if (address === await brokenSigner.getAddress()) {
        if (isSignerStatusRejected(status)) {
          expect(status.error).to.contain('This is a broken signer.')
        } else {
          expect.fail('Signer should be rejected')
        }
      } else {
        expect(isSignerStatusSigned(status)).to.be.true
      }
    }
  })

  it('Should manually reject a request', async () => {
    const rejectSignerEOA = ethers.Wallet.createRandom()
    const rejectSigner: SapientSigner = {
      getAddress: async function (): Promise<string> {
        return rejectSignerEOA.address
      },
      requestSignature: async function (message: ethers.utils.BytesLike, callbacks: { onSignature: (signature: ethers.utils.BytesLike) => void; onRejection: (error: string) => void; onStatus: (situation: string) => void }): Promise<boolean> {
        callbacks.onRejection('This is a rejected signer.')
        return true
      },
      notifyStatusChange: function (status: Status): void {},
      isEOA: function (): boolean {
        return true
      }
    }

    const signers = [
      ethers.Wallet.createRandom(),
      rejectSigner
    ]

    const orchestrator = new Orchestrator(signers)

    let callbackCallsA = 0
    orchestrator.subscribe(() => {
      callbackCallsA++
    })

    const signature = await orchestrator.signMessage('0x1234')
    expect(Object.keys(signature.signers)).to.have.lengthOf(signers.length)

    for (const signer of signers) {
      const address = await signer.getAddress()
      const status = signature.signers[address]

      if (address === await rejectSigner.getAddress()) {
        if (isSignerStatusRejected(status)) {
          expect(status.error).to.contain('This is a rejected signer.')
        } else {
          expect.fail('Signer should be rejected')
        }
      } else {
        expect(isSignerStatusSigned(status)).to.be.true
      }
    }
  })

  it('Should pass the correct message to the signer', async () => {
    const ogMessage = ethers.utils.randomBytes(99)
    const signer: SapientSigner = {
      getAddress: async function (): Promise<string> {
        return '0x1234'
      },
      requestSignature: async function (message: ethers.utils.BytesLike, callbacks: { onSignature: (signature: ethers.utils.BytesLike) => void; onRejection: (error: string) => void; onStatus: (situation: string) => void }): Promise<boolean> {
        expect(message).to.be.equal(ogMessage)
        callbacks.onSignature('0x5678')
        return true
      },
      notifyStatusChange: function (status: Status): void {},
      isEOA: function (): boolean {
        return true
      }
    }

    const orchestrator = new Orchestrator([signer])
    const signature = await orchestrator.signMessage(ogMessage)

    expect((signature.signers['0x1234'] as any).signature).to.be.equal('0x5678')
  })
})
