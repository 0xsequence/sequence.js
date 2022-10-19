import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'

import { isZeroExV3Order, messageIsExemptFromEIP191Prefix } from '../src/eip191exceptions'
import { message1, zeroExV3Order } from './messages'
import { ethers } from 'ethers'
const { expect } = chai.use(chaiAsPromised)

describe('191 prefix exceptions', () => {
  it('decentraland is exempt', () => {
    expect(messageIsExemptFromEIP191Prefix(message1, 'https://play.decentraland.org')).equal(true)
  })

  it('should strip 191 prefix from 0x v3 orders', () => {
    expect(messageIsExemptFromEIP191Prefix(zeroExV3Order, undefined)).equal(true)
  })

  it('should not strip 191 prefix from other messages', () => {
    expect(messageIsExemptFromEIP191Prefix(message1, undefined)).equal(false)
    expect(messageIsExemptFromEIP191Prefix(message1, 'https://play.example.com')).equal(false)
  })
})
