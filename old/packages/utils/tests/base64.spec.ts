import { expect } from 'chai'
import { base64EncodeObject, base64DecodeObject } from '@0xsequence/utils'

describe('base64', function () {
  it('encoding, a', () => {
    const object = {
      a: 1,
      b: 2,
      c: 'hihi',
      d: '1.234'
    }

    const encoded = base64EncodeObject(object)
    expect(encoded).to.be.equal('eyJhIjoxLCJiIjoyLCJjIjoiaGloaSIsImQiOiIxLjIzNCJ9')

    const o = base64DecodeObject(encoded)
    expect(object).to.deep.equal(o)
  })

  it('encoding, b', () => {
    const object = {
      a: 1,
      b: 2,
      c: 'hihi',
      d: `how do quote's "work+out"?`
    }

    const encoded = base64EncodeObject(object)
    expect(encoded).to.be.equal('eyJhIjoxLCJiIjoyLCJjIjoiaGloaSIsImQiOiJob3cgZG8gcXVvdGUncyBcIndvcmsrb3V0XCI_In0')

    const o = base64DecodeObject(encoded)
    expect(object).to.deep.equal(o)
  })

  it('encoding, c', () => {
    const object = {
      a: 1,
      b: 2,
      c: 'hihi',
      d: { nest: '123' }
    }

    const encoded = base64EncodeObject(object)
    expect(encoded).to.be.equal('eyJhIjoxLCJiIjoyLCJjIjoiaGloaSIsImQiOnsibmVzdCI6IjEyMyJ9fQ')

    const o = base64DecodeObject(encoded)
    expect(object).to.deep.equal(o)
  })
})
