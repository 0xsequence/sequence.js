import { commons } from '@0xsequence/core'
import { expect } from 'chai'
import { validateTransactionRequest } from '../src/transactions'

const self = '0x5e1f5e1f5e1f5e1f5e1f5e1f5e1f5e1f5e1f5e1f'
const to = '0x0123456789012345678901234567890123456789'

describe('validating transaction requests', () => {
  it('should throw an error when a transaction does a self call', () => {
    const transaction = {
      to,
      data: commons.transaction.encodeBundleExecData({
        entrypoint: to,
        transactions: [
          {
            to: self,
            data: '0x12345678'
          }
        ]
      })
    }

    expect(() => validateTransactionRequest(self, transaction)).to.throw()
  })

  it('should throw an error when a transaction does a deep self call', () => {
    const transaction = {
      to,
      data: commons.transaction.encodeBundleExecData({
        entrypoint: to,
        transactions: [
          {
            to: self,
            data: commons.transaction.encodeBundleExecData({
              entrypoint: self,
              transactions: [
                {
                  to: self,
                  data: '0x12345678'
                }
              ]
            })
          }
        ]
      })
    }

    expect(() => validateTransactionRequest(self, transaction)).to.throw()
  })

  it('should throw an error when a transaction does a delegate call', () => {
    const transaction = {
      to,
      data: commons.transaction.encodeBundleExecData({
        entrypoint: to,
        transactions: [
          {
            to,
            delegateCall: true
          }
        ]
      })
    }

    expect(() => validateTransactionRequest(self, transaction)).to.throw()
  })

  it('should throw an error when a transaction does a deep delegate call', () => {
    const transaction = {
      to,
      data: commons.transaction.encodeBundleExecData({
        entrypoint: to,
        transactions: [
          {
            to: self,
            data: commons.transaction.encodeBundleExecData({
              entrypoint: self,
              transactions: [
                {
                  to: self,
                  delegateCall: true
                }
              ]
            })
          }
        ]
      })
    }

    expect(() => validateTransactionRequest(self, transaction)).to.throw()
  })

  it('should not throw an error in general', () => {
    const transaction = {
      to,
      data: commons.transaction.encodeBundleExecData({
        entrypoint: to,
        transactions: [
          {
            to: self, // self without data is ok
            value: '1000000000000000000'
          }
        ]
      })
    }

    expect(() => validateTransactionRequest(self, transaction)).to.not.throw()
  })
})
