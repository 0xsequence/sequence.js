import chaiAsPromised from 'chai-as-promised'
import * as chai from 'chai'

import {
  trimEIP191Prefix_test1_prefixed,
  trimEIP191Prefix_test1_raw,
  trimEIP191Prefix_test2_prefixed,
  trimEIP191Prefix_test2_raw,
  trimEIP191Prefix_test3_prefixed,
  trimEIP191Prefix_test3_raw,
  trimEIP191Prefix_test4_prefixed,
  trimEIP191Prefix_test4_raw,
  trimEIP191Prefix_test5_prefixed,
  trimEIP191Prefix_test5_raw
} from './messages'
import { trimEIP191Prefix } from '../src/utils'
import { ethers } from 'ethers'
const { expect } = chai.use(chaiAsPromised)

describe('trimming eip191prefix', () => {
  it('should trim prefix', () => {
    expect(ethers.toUtf8String(trimEIP191Prefix(trimEIP191Prefix_test1_prefixed))).equal(trimEIP191Prefix_test1_raw)
  })

  it('should handle eip191 exempt messages (by returning early)', () => {
    expect(ethers.toUtf8String(trimEIP191Prefix(trimEIP191Prefix_test2_prefixed))).equal(trimEIP191Prefix_test2_raw)
  })

  it('should trim prefix for case where max prefix char as number is bigger than the length of the message', () => {
    expect(ethers.toUtf8String(trimEIP191Prefix(trimEIP191Prefix_test3_prefixed))).equal(trimEIP191Prefix_test3_raw)
    expect(ethers.toUtf8String(trimEIP191Prefix(trimEIP191Prefix_test4_prefixed))).equal(trimEIP191Prefix_test4_raw)
    expect(ethers.toUtf8String(trimEIP191Prefix(trimEIP191Prefix_test5_prefixed))).equal(trimEIP191Prefix_test5_raw)
  })
})
