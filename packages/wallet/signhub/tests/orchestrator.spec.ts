import * as chai from 'chai'
import { ethers } from 'ethers'
import { commons } from '@0xsequence/core'
import { isSignerStatusPending, Orchestrator, SignerState, Status } from '../src'
import { SapientSigner } from '../src/signers'

const { expect } = chai

describe('Orchestrator', () => {
  describe('signMessage', () => {
    it('Should call all signers', async () => {
      const signers = [ethers.Wallet.createRandom(), ethers.Wallet.createRandom(), ethers.Wallet.createRandom()]

      const orchestrator = new Orchestrator(signers)
      const signature = await orchestrator.signMessage({ message: '0x1234' })

      expect(Object.keys(signature.signers)).to.have.lengthOf(signers.length)

      for (const signer of signers) {
        expect(signature.signers).to.have.property(signer.address)
      }
    })

    it('Should call callback with status updates', async () => {
      const signers = [ethers.Wallet.createRandom(), ethers.Wallet.createRandom(), ethers.Wallet.createRandom()]

      const orchestrator = new Orchestrator(signers)

      let callbackCallsA = 0
      orchestrator.subscribe((status, metadata) => {
        // Status should have all signers
        let numErrors = 0
        let numSignatures = 0
        let numPending = 0
        expect(Object.keys(status.signers)).to.have.lengthOf(signers.length, 'Should have all signers')
        for (const signer of signers) {
          expect(status.signers).to.have.property(signer.address)
          const signerStatus = status.signers[signer.address]

          if (signerStatus.state === SignerState.ERROR) {
            numErrors++
          }

          if (isSignerStatusPending(signerStatus)) {
            numPending++
          }

          if (signerStatus.state === SignerState.SIGNED) {
            numSignatures++
          }
        }

        callbackCallsA++

        expect(numErrors).to.be.equal(0, 'No errors should be present')
        expect(numSignatures).to.be.equal(Math.max(callbackCallsA, 3), 'Should have max 3 signatures')
        expect(numPending).to.be.equal(Math.min(signers.length - callbackCallsA, 0), 'Should have 0 pending')
      })

      let callbackCallsB = 0
      await orchestrator.signMessage({
        message: '0x1234',
        callback: () => {
          callbackCallsB++
          return false
        }
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
        buildDeployTransaction(metadata) {
          throw new Error('This is a broken signer.')
        },
        async predecorateSignedTransactions(_metadata: object): Promise<commons.transaction.SignedTransactionBundle[]> {
          throw new Error('This is a broken signer.')
        },
        decorateTransactions(
          bundle: commons.transaction.IntendedTransactionBundle,
          metadata: object
        ): Promise<commons.transaction.IntendedTransactionBundle> {
          throw new Error('This is a broken signer.')
        },
        sign(_message, _metadata) {
          throw new Error('This is a broken signer.')
        },
        notifyStatusChange: function (id: string, status: Status): void {},
        suffix: function () {
          return new Uint8Array([2])
        }
      }

      const signers = [ethers.Wallet.createRandom(), brokenSigner, ethers.Wallet.createRandom()]

      const orchestrator = new Orchestrator(signers)

      let callbackCallsA = 0
      orchestrator.subscribe(async status => {
        // Status should have all signers
        let numErrors = 0
        let numSignatures = 0
        let numPending = 0

        expect(Object.keys(status.signers)).to.have.lengthOf(signers.length)

        for (const signer of signers) {
          expect(status.signers).to.have.property(await signer.getAddress())
          const signerStatus = status.signers[await signer.getAddress()]

          if (signerStatus.state === SignerState.ERROR) {
            numErrors++
          }

          if (isSignerStatusPending(signerStatus)) {
            numPending++
          }

          if (signerStatus.state === SignerState.SIGNED) {
            numSignatures++
          }
        }

        callbackCallsA++

        expect(numErrors).to.be.equal(1)
        expect(numSignatures).to.be.equal(2)
        expect(numPending).to.be.equal(0)
      })

      const signature = await orchestrator.signMessage({ message: '0x1234' })
      expect(Object.keys(signature.signers)).to.have.lengthOf(2)

      for (const signer of signers) {
        const address = await signer.getAddress()
        const status = signature.signers[address]

        if (address === (await brokenSigner.getAddress())) {
          if (status.state === SignerState.ERROR) {
            expect(status.error.message).to.contain('This is a broken signer.')
          } else {
            expect.fail('Signer should be rejected')
          }
        } else {
          expect(status.state === SignerState.SIGNED).to.be.true
        }
      }
    })

    it('Should manually reject a request', async () => {
      const rejectSignerEOA = ethers.Wallet.createRandom()
      const rejectSigner: SapientSigner = {
        getAddress: async function (): Promise<string> {
          return rejectSignerEOA.address
        },
        buildDeployTransaction(metadata) {
          throw new Error('This is a reject signer.')
        },
        async predecorateSignedTransactions(_metadata: object): Promise<commons.transaction.SignedTransactionBundle[]> {
          throw new Error('This is a reject signer.')
        },
        decorateTransactions(
          bundle: commons.transaction.IntendedTransactionBundle,
          metadata: object
        ): Promise<commons.transaction.IntendedTransactionBundle> {
          throw new Error('This is a rejected signer.')
        },
        async sign(_message, _metadata) {
          throw new Error('This is a rejected signer.')
        },
        notifyStatusChange: function (id: string, status: Status): void {},
        suffix: function () {
          return new Uint8Array([2])
        }
      }

      const signers = [ethers.Wallet.createRandom(), rejectSigner]

      const orchestrator = new Orchestrator(signers)

      let callbackCallsA = 0
      orchestrator.subscribe(() => {
        callbackCallsA++
      })

      const signature = await orchestrator.signMessage({ message: '0x1234' })
      expect(Object.keys(signature.signers)).to.have.lengthOf(signers.length)

      for (const signer of signers) {
        const address = await signer.getAddress()
        const status = signature.signers[address]

        if (address === (await rejectSigner.getAddress())) {
          if (status.state === SignerState.ERROR) {
            expect(status.error.message).to.contain('This is a rejected signer.')
          } else {
            expect.fail('Signer should be rejected')
          }
        } else {
          expect(status.state === SignerState.SIGNED).to.be.true
        }
      }
    })

    it('Should pass the correct message to the signer', async () => {
      const ogMessage = ethers.randomBytes(99)
      const signer: SapientSigner = {
        getAddress: async function (): Promise<string> {
          return '0x1234'
        },
        buildDeployTransaction(metadata) {
          return Promise.resolve(undefined)
        },
        predecorateSignedTransactions(_metadata: object): Promise<commons.transaction.SignedTransactionBundle[]> {
          return Promise.resolve([])
        },
        decorateTransactions(
          bundle: commons.transaction.IntendedTransactionBundle,
          metadata: object
        ): Promise<commons.transaction.IntendedTransactionBundle> {
          return Promise.resolve(bundle)
        },
        async sign(message, _metadata) {
          expect(message).to.be.equal(ogMessage)
          return '0x5678'
        },
        notifyStatusChange: function (id: string, status: Status): void {},
        suffix: function () {
          return new Uint8Array([2])
        }
      }

      const orchestrator = new Orchestrator([signer])
      const signature = await orchestrator.signMessage({ message: ogMessage })

      expect((signature.signers['0x1234'] as any).signature).to.be.equal('0x5678')
    })

    it('Should pass metadata to signer', async () => {
      const ogMessage = ethers.randomBytes(99)
      const signer: SapientSigner = {
        getAddress: async function (): Promise<string> {
          return '0x1234'
        },
        buildDeployTransaction(metadata) {
          return Promise.resolve(undefined)
        },
        predecorateSignedTransactions(_metadata: object): Promise<commons.transaction.SignedTransactionBundle[]> {
          return Promise.resolve([])
        },
        decorateTransactions(
          bundle: commons.transaction.IntendedTransactionBundle,
          metadata: object
        ): Promise<commons.transaction.IntendedTransactionBundle> {
          return Promise.resolve(bundle)
        },
        async sign(_message, metadata) {
          expect(metadata).to.be.deep.equal({ test: 'test' })
          return '0x5678'
        },
        notifyStatusChange: function (id: string, status: Status): void {},
        suffix: function () {
          return new Uint8Array([2])
        }
      }

      const orchestrator = new Orchestrator([signer])
      const signature = await orchestrator.signMessage({ message: ogMessage, metadata: { test: 'test' } })

      expect((signature.signers['0x1234'] as any).signature).to.be.equal('0x5678')
    })

    it('Should pass updated metadata to signer', async () => {
      const ogMessage = ethers.randomBytes(99)

      let firstCall = true
      let errorOnNotify: any = undefined

      const signer1: SapientSigner = {
        getAddress: async function (): Promise<string> {
          return '0x1234'
        },
        buildDeployTransaction(metadata) {
          return Promise.resolve(undefined)
        },
        predecorateSignedTransactions(_metadata: object): Promise<commons.transaction.SignedTransactionBundle[]> {
          return Promise.resolve([])
        },
        decorateTransactions(
          bundle: commons.transaction.IntendedTransactionBundle,
          metadata: object
        ): Promise<commons.transaction.IntendedTransactionBundle> {
          return Promise.resolve(bundle)
        },
        async sign(_message, metadata) {
          expect(metadata).to.be.deep.equal({ test: 'test' })
          return '0x5678'
        },
        notifyStatusChange: function (id: string, status: Status, metadata: object): void {
          try {
            if (firstCall) {
              expect(metadata).to.be.deep.equal({ test: 'test' })
            } else {
              expect(metadata).to.be.deep.equal({ hello: 'world' })
            }
          } catch (e) {
            errorOnNotify = e
          }
        },
        suffix: function () {
          return new Uint8Array([2])
        }
      }

      const signer2: SapientSigner = {
        getAddress: async function (): Promise<string> {
          return '0x5678'
        },
        buildDeployTransaction(metadata) {
          return Promise.resolve(undefined)
        },
        predecorateSignedTransactions(_metadata: object): Promise<commons.transaction.SignedTransactionBundle[]> {
          return Promise.resolve([])
        },
        decorateTransactions(
          bundle: commons.transaction.IntendedTransactionBundle,
          metadata: object
        ): Promise<commons.transaction.IntendedTransactionBundle> {
          return Promise.resolve(bundle)
        },
        async sign(_message, metadata) {
          expect(metadata).to.be.deep.equal({ test: 'test' })
          return '0x9012'
        },
        notifyStatusChange: function (id: string, status: Status, metadata: object): void {
          try {
            if (firstCall) {
              expect(metadata).to.be.deep.equal({ test: 'test' })
            } else {
              expect(metadata).to.be.deep.equal({ hello: 'world' })
            }
          } catch (e) {
            errorOnNotify = e
          }
        },
        suffix: function () {
          return new Uint8Array([2])
        }
      }

      const orchestrator = new Orchestrator([signer1, signer2])
      const signature = await orchestrator.signMessage({
        message: ogMessage,
        metadata: { test: 'test' },
        callback: (s: Status, onNewMetadata: (metadata: object) => void) => {
          if (firstCall) {
            firstCall = false
            onNewMetadata({ hello: 'world' })
            return false
          }

          return true
        }
      })

      expect((signature.signers['0x1234'] as any).signature).to.be.equal('0x5678')
      expect((signature.signers['0x5678'] as any).signature).to.be.equal('0x9012')
      if (errorOnNotify) throw errorOnNotify
    })

    it('Should auto-generate random tag', () => {
      const orchestrator1 = new Orchestrator([])
      const orchestrator2 = new Orchestrator([])

      expect(orchestrator1.tag).to.not.be.equal(orchestrator2.tag)
    })

    it('Should only sign with candidates', async () => {
      const message = ethers.randomBytes(99)

      const signer1 = ethers.Wallet.createRandom()
      const signer2 = ethers.Wallet.createRandom()
      const signer3 = ethers.Wallet.createRandom()
      const signer4 = ethers.Wallet.createRandom()

      const orchestrator = new Orchestrator([signer1, signer2, signer3, signer4])

      const result = await orchestrator.signMessage({
        message: message,
        candidates: [signer1.address, signer3.address]
      })

      expect(result.signers[signer1.address]).to.not.be.undefined
      expect(result.signers[signer2.address]).to.be.undefined
      expect(result.signers[signer3.address]).to.not.be.undefined
      expect(result.signers[signer4.address]).to.be.undefined
    })
  })
  describe('decorateTransactions', () => {
    it('Repeatedly decorate a bundle', async () => {
      const signer: SapientSigner = {
        getAddress: async function (): Promise<string> {
          return '0x1'
        },
        async buildDeployTransaction(metadata: object) {
          return undefined
        },
        async predecorateSignedTransactions(_metadata: object): Promise<commons.transaction.SignedTransactionBundle[]> {
          return []
        },
        async decorateTransactions(
          bundle: commons.transaction.IntendedTransactionBundle,
          metadata: object
        ): Promise<commons.transaction.IntendedTransactionBundle> {
          // Add a transaction on each call
          bundle.transactions.push({
            to: 'to'
          })
          return bundle
        },
        sign(_message, _metadata) {
          throw new Error('unreachable')
        },
        notifyStatusChange: function (id: string, status: Status): void {},
        suffix: function () {
          return new Uint8Array([0])
        }
      }

      const orchestrator = new Orchestrator([signer, signer, signer])
      const bundle: commons.transaction.IntendedTransactionBundle = {
        intent: {
          id: '',
          wallet: ''
        },
        chainId: 0,
        transactions: [],
        entrypoint: ''
      }

      const output = await orchestrator.decorateTransactions(bundle)

      expect(output?.transactions.length).to.be.equal(3)
    })
  })

  describe('buildDeployTransaction', () => {
    it('Should create a combined bundle', async () => {
      const signer1: SapientSigner = {
        getAddress: async function (): Promise<string> {
          return '0x1'
        },
        async buildDeployTransaction(metadata: object) {
          return {
            entrypoint: 'entrypoint1',
            transactions: [
              {
                to: 'to1',
                data: 'data1'
              }
            ]
          }
        },
        async predecorateSignedTransactions(_metadata: object): Promise<commons.transaction.SignedTransactionBundle[]> {
          return []
        },
        async decorateTransactions(
          bundle: commons.transaction.IntendedTransactionBundle,
          metadata: object
        ): Promise<commons.transaction.IntendedTransactionBundle> {
          return bundle
        },
        sign(_message, _metadata) {
          throw new Error('unreachable')
        },
        notifyStatusChange: function (id: string, status: Status): void {},
        suffix: function () {
          return new Uint8Array([0])
        }
      }
      const signer2: SapientSigner = {
        getAddress: async function (): Promise<string> {
          return '0x2'
        },
        async buildDeployTransaction(metadata: object) {
          return {
            entrypoint: 'entrypoint2',
            transactions: [
              {
                to: 'to2',
                data: 'data2'
              }
            ]
          }
        },
        async predecorateSignedTransactions(_metadata: object): Promise<commons.transaction.SignedTransactionBundle[]> {
          return []
        },
        async decorateTransactions(
          bundle: commons.transaction.IntendedTransactionBundle
        ): Promise<commons.transaction.IntendedTransactionBundle> {
          return bundle
        },
        sign(_message, _metadata) {
          throw new Error('unreachable')
        },
        notifyStatusChange: function (id: string, status: Status): void {},
        suffix: function () {
          return new Uint8Array([0])
        }
      }

      const orchestrator = new Orchestrator([signer1, signer2])
      const bundle = await orchestrator.buildDeployTransaction({})

      expect(bundle?.transactions.length).to.be.equal(2)
    })
  })
})
