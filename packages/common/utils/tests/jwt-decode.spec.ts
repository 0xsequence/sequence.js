import { expect } from 'chai'
import { jwtDecodeClaims } from '@0xsequence/utils'

describe('jwt-decode', function () {
  it('decode', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50IjoiMHg4ZTNlMzhmZTczNjdkZDNiNTJkMWUyODFlNGU4NDAwNDQ3YzhkOGI5IiwiYXBwIjoiU2VxdWVuY2UgV2FsbGV0IiwiZXhwIjoxNjIyNzY3MTcwLCJpYXQiOjE2MjAxNzUxNzB9.21AuC33BF6GR67_kixfhoRfpSfN-G98fSe1MEvrcgO0'

    const claims = jwtDecodeClaims(jwt)
    expect(claims.account).to.equal('0x8e3e38fe7367dd3b52d1e281e4e8400447c8d8b9')
    expect(claims.exp).to.equal(1622767170)
  })
})
