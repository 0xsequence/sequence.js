import { expect } from 'chai'
import { sanitizeHost } from '@0xsequence/utils'

describe('sanitize', function () {
  it('sanitize host', () => {
    const a = 'http://localhost:4000'
    expect(sanitizeHost(a)).to.equal('http://localhost:4000')

    const b = 'https://localhost:4000'
    expect(sanitizeHost(b)).to.equal('https://localhost:4000')

    const c = 'http://play.skyweaver.net'
    expect(sanitizeHost(c)).to.equal('http://play.skyweaver.net')

    const d = 'http://hello123-world4.com'
    expect(sanitizeHost(d)).to.equal('http://hello123-world4.com')

    const e = 'http://hello-w(!#@%$#%^@orld.com'
    expect(sanitizeHost(e)).to.equal('http://hello-w')
  })
})
