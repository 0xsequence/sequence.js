import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'

import { messageIsExemptFromEIP191Prefix } from '../src/eip191exceptions'
import { dclLogin, message1, zeroExV3Order } from './messages'
const { expect } = chai.use(chaiAsPromised)

describe('191 prefix exceptions', () => {
  it('decentraland is exempt', () => {
    expect(messageIsExemptFromEIP191Prefix(dclLogin)).equal(true)
  })

  it('should strip 191 prefix from 0x v3 orders', () => {
    expect(messageIsExemptFromEIP191Prefix(zeroExV3Order)).equal(true)
  })

  it('should not strip 191 prefix from other messages', () => {
    expect(messageIsExemptFromEIP191Prefix(message1)).equal(false)
    expect(messageIsExemptFromEIP191Prefix(zeroExV3Order.slice(0, -10))).equal(false)
    expect(messageIsExemptFromEIP191Prefix(dclLogin.slice(0, -10))).equal(false)
  })
})
