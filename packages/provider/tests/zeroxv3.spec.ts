import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'

import { isZeroExV3Order } from '../src/eip191exceptions'
import { message1, zeroExV3Order } from './messages'
const { expect } = chai.use(chaiAsPromised)

describe('Utils / 0xv3', () => {
  it('should detect 0x v3 order', () => {
    expect(isZeroExV3Order(message1)).equals(false)
    expect(isZeroExV3Order(zeroExV3Order.slice(0, -1))).equals(false)
    expect(isZeroExV3Order(zeroExV3Order)).equals(true)
  })
})
