import { expect } from 'chai'

import { formatUnits, parseUnits, toHexString, MAX_UINT_256 } from '../src/bigint'
import { bigintReplacer, bigintReviver } from '../dist/0xsequence-utils.cjs'

describe('bigint', () => {
  it('should convert bigint to hex string', () => {
    expect(toHexString(0n)).to.equal('0x00')
    expect(toHexString(15n)).to.equal('0x0f')
    expect(toHexString(16n)).to.equal('0x10')
    expect(toHexString(255n)).to.equal('0xff')
    expect(toHexString(256n)).to.equal('0x0100')
    expect(toHexString(1234n)).to.equal('0x04d2')
    expect(toHexString(MAX_UINT_256)).to.equal('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
  })

  it('should parseUnits', () => {
    expect(parseUnits('1.234', 3)).to.equal(1234n)
    expect(parseUnits('1', 3)).to.equal(1000n)
    expect(parseUnits('.123', 3)).to.equal(123n)
    expect(parseUnits('1.', 3)).to.equal(1000n)
    expect(parseUnits('1.234000', 3)).to.equal(1234n)
    expect(parseUnits('-1.234', 3)).to.equal(-1234n)
    expect(parseUnits('1.2345', 4)).to.equal(12345n)
    expect(parseUnits('1', 18)).to.equal(1000000000000000000n)

    // Test padding decimals
    expect(parseUnits('1.2', 4)).to.equal(12000n)

    expect(parseUnits('1.234', 0)).to.equal(1n)
  })

  it('should formatUnits', () => {
    expect(formatUnits(1234n, 3)).to.equal('1.234')

    // Test stripping trailing zeros - keeps last
    expect(formatUnits(1000n, 3)).to.equal('1')

    expect(formatUnits(123n, 3)).to.equal('0.123')
    expect(formatUnits(1234n, 3)).to.equal('1.234')
    expect(formatUnits(-1234n, 3)).to.equal('-1.234')
    expect(formatUnits(1234n, 0)).to.equal('1234')
    expect(formatUnits(1234n, 4)).to.equal('0.1234')
    expect(formatUnits(1234n, 5)).to.equal('0.01234')
  })

  it('should serialize and deserialize bigints', () => {
    const s = JSON.stringify({ value: 1234n }, bigintReplacer)
    const d = JSON.parse(s, bigintReviver)

    expect(s).to.equal('{"value":{"$bigint":"1234"}}')
    expect(d).to.deep.equal({ value: 1234n })

    // BigNumber compatibility with ethers v5
    expect(JSON.parse('{"value":{"type":"BigNumber","hex":"0x04d2"}}', bigintReviver)).to.deep.equal({ value: 1234n })
  })
})
