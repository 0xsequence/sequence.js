import * as ethers from 'ethers'
import { BigNumber } from 'ethers/utils'

import { BuyTokensObj, SellTokensObj } from 'typings/types'

const methodsSignature = {
  BUYTOKENS: '0xb2d81047',
  SELLTOKENS: '0xdb08ec97'
}

const BuyTokensType = `tuple(
    address recipient,
    uint256[] ids,
    uint256[] amounts,
    uint256 deadline
)`

const SellTokensType = `tuple(
    address recipient,
    uint256 minBaseTokens,
    uint256 deadline
)`

export function niftyGetBuyTokenData(obj: BuyTokensObj) {
  return ethers.utils.defaultAbiCoder.encode(
    ['bytes4', BuyTokensType],
    [methodsSignature.BUYTOKENS, obj]
  )
}

export function niftyGetSellTokenData(obj: SellTokensObj) {
  return ethers.utils.defaultAbiCoder.encode(
    ['bytes4', SellTokensType],
    [methodsSignature.SELLTOKENS, obj]
  )
}
