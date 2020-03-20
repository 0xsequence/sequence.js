
import { expect } from 'chai';
import {niftyGetBuyTokenData, niftyGetSellTokenData} from '../src/nifty_swap'
import { promises as fs } from "fs";

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

async function readFixturesFile(path: string): Promise<string> {
    return (await fs.readFile('./tests/fixtures/' + path)).toString()
}

describe('Nifty', () => {
    it('buyOrders', () => {
        execNiftyTest("nifty_buyOrders.json", niftyGetBuyTokenData)
    })
    it('sellOrders', () => {
        execNiftyTest('nifty_sellOrders.json', niftyGetSellTokenData)
    })
})

async function execNiftyTest(path: string, func) {
    let data = JSON.parse(await readFixturesFile(path))
    for (const name in data) {
        const test = data[name]
        const result = func(test.obj)
        expect(result).to.equal(test.result)
    }
}
