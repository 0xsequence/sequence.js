import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'

import {
  removeIep191Prefix_test1_prefixed,
  removeIep191Prefix_test1_raw,
  removeIep191Prefix_test2_prefixed,
  removeIep191Prefix_test2_raw,
  removeIep191Prefix_test3_prefixed,
  removeIep191Prefix_test3_raw,
  removeIep191Prefix_test4_prefixed,
  removeIep191Prefix_test4_raw,
  removeIep191Prefix_test5_prefixed,
  removeIep191Prefix_test5_raw
} from './messages'
import { removeEIP191Prefix } from '../src/utils'
import { ethers } from 'ethers'
const { expect } = chai.use(chaiAsPromised)

describe('removing eip191prefix', () => {
  it('should remove prefix', () => {
    expect(ethers.utils.toUtf8String(removeEIP191Prefix(removeIep191Prefix_test1_prefixed))).equal(removeIep191Prefix_test1_raw)
  })

  it('should handle eip191 exempt messages (by returning early)', () => {
    expect(ethers.utils.toUtf8String(removeEIP191Prefix(removeIep191Prefix_test2_prefixed))).equal(removeIep191Prefix_test2_raw)
  })

  it('should remove prefix for case where max prefix char as number is bigger than the length of the message', () => {
    expect(ethers.utils.toUtf8String(removeEIP191Prefix(removeIep191Prefix_test3_prefixed))).equal(removeIep191Prefix_test3_raw)
    expect(ethers.utils.toUtf8String(removeEIP191Prefix(removeIep191Prefix_test4_prefixed))).equal(removeIep191Prefix_test4_raw)
    expect(ethers.utils.toUtf8String(removeEIP191Prefix(removeIep191Prefix_test5_prefixed))).equal(removeIep191Prefix_test5_raw)
  })
})
