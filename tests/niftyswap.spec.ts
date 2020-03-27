import { getBuyTokenData, getSellTokenData } from '../src/niftyswap/types'
import nifty_buyOrders from './fixtures/nifty_buyOrders.json'
import nifty_sellOrders from './fixtures/nifty_sellOrders.json'

describe('Nifty', () => {
  it('buyOrders', () => {
    for (const name in nifty_buyOrders) {
      const test = nifty_buyOrders[name]
      const result = getBuyTokenData(test.obj)
      expect(result).toEqual(test.result)
    }
  })
  it('sellOrders', () => {
    for (const name in nifty_sellOrders) {
      const test = nifty_sellOrders[name]
      const result = getSellTokenData(test.obj)
      expect(result).toEqual(test.result)
    }
  })
})
