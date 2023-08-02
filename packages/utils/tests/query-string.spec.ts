import { expect } from 'chai'
import { queryStringFromObject, queryStringToObject } from '@0xsequence/utils'

describe('query-string', function () {
  it('encoding, a', () => {
    const object = {
      a: 1,
      b: 2,
      c: 'hihi',
      d: '1.234'
    }

    const qs = queryStringFromObject('k', object)
    expect(qs).to.be.equal('k=%7B%22a%22%3A1%2C%22b%22%3A2%2C%22c%22%3A%22hihi%22%2C%22d%22%3A%221.234%22%7D')

    const o = queryStringToObject(qs)
    expect({ k: object }).to.deep.equal(o)
  })

  it('encoding, b', () => {
    const object = {
      a: 1,
      b: 2,
      c: 'hihi',
      d: `how do quote's "work+out"?`
    }

    const qs = queryStringFromObject('k', object)
    expect(qs).to.be.equal(
      "k=%7B%22a%22%3A1%2C%22b%22%3A2%2C%22c%22%3A%22hihi%22%2C%22d%22%3A%22how%20do%20quote's%20%5C%22work%2Bout%5C%22%3F%22%7D"
    )

    const o = queryStringToObject(qs)
    expect({ k: object }).to.deep.equal(o)
  })

  it('encoding, c', () => {
    const object = {
      a: 1,
      b: 2,
      c: 'hihi',
      d: { nest: '123' }
    }

    const qs = queryStringFromObject('k', object)
    expect(qs).to.be.equal('k=%7B%22a%22%3A1%2C%22b%22%3A2%2C%22c%22%3A%22hihi%22%2C%22d%22%3A%7B%22nest%22%3A%22123%22%7D%7D')

    const o = queryStringToObject(qs)
    expect({ k: object }).to.deep.equal(o)
  })
})
