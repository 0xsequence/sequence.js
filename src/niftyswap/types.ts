import * as ethers from 'ethers'
import { utils } from 'ethers'

type BigNumber = utils.BigNumber

interface transferBase {
  recipient: string
  transferIds: string[]
  transferAmounts: string[]
}

export interface NiftyswapBuy extends transferBase {
  type: 'buy'
  tokenIdsToBuy: number[] | ethers.utils.BigNumber[]
  tokensAmountsToBuy: ethers.utils.BigNumber[]
  deadline: number
}

export interface NiftyswapSell extends transferBase {
  type: 'sell'
  cost: BigNumber
  deadline: number
}

export interface NiftyswapAddLiquidity {
  type: 'addLiquidity'
  baseAmountsToAdd: ethers.utils.BigNumber[]
  deadline: number
}

export interface NiftyswapRemoveLiquidity {
  type: 'removeLiquidity'
  minBaseTokens: ethers.utils.BigNumber[]
  minTokens: ethers.utils.BigNumber[]
  deadline: number
}

export type NiftyswapMethods =
  | NiftyswapBuy
  | NiftyswapSell
  | NiftyswapAddLiquidity
  | NiftyswapRemoveLiquidity

const methodsSignature = {
  BUYTOKENS: '0xb2d81047',
  SELLTOKENS: '0xdb08ec97',
  ADDLIQUIDITY: '0x82da2b73',
  REMOVELIQUIDITY: '0x5c0bf259'
}

export const BuyTokensType = `tuple(
  address recipient,
  uint256[] tokensBoughtIDs,
  uint256[] tokensBoughtAmounts,
  uint256 deadline
)`

const SellTokensType = `tuple(
  address recipient,
  uint256 minBaseTokens,
  uint256 deadline
)`

export const AddLiquidityType = `tuple(
  uint256[] maxBaseTokens,
  uint256 deadline
)`

export const RemoveLiquidityType = `tuple(
  uint256[] minBaseTokens,
  uint256[] minTokens,
  uint256 deadline
)`

export type BuyTokensObj = {
  recipient: string
  tokensBoughtIDs: number[] | string[] | BigNumber[]
  tokensBoughtAmounts: number[] | string[] | BigNumber[]
  deadline: number | string | BigNumber
}

export type SellTokensObj = {
  recipient: string
  minBaseTokens: number | string | BigNumber
  deadline: number | string | BigNumber
}

export type AddLiquidityObj = {
  maxBaseTokens: number[] | string[] | BigNumber[]
  deadline: number | string | BigNumber
}

export type RemoveLiquidityObj = {
  minBaseTokens: number[] | string[] | BigNumber[]
  minTokens: number[] | string[] | BigNumber[]
  deadline: number | string | BigNumber
}

export function getBuyTokenData(obj: BuyTokensObj) {
  return ethers.utils.defaultAbiCoder.encode(
    ['bytes4', BuyTokensType],
    [methodsSignature.BUYTOKENS, obj]
  )
}

export function getSellTokenData(obj: SellTokensObj) {
  return ethers.utils.defaultAbiCoder.encode(
    ['bytes4', SellTokensType],
    [methodsSignature.SELLTOKENS, obj]
  )
}

export const getAddLiquidityData = (
  baseAmountsToAdd: ethers.utils.BigNumber[],
  deadline: number
) => {
  const addLiquidityObj = {
    maxBaseTokens: baseAmountsToAdd,
    deadline
  } as AddLiquidityObj

  return ethers.utils.defaultAbiCoder.encode(
    ['bytes4', AddLiquidityType],
    [methodsSignature.ADDLIQUIDITY, addLiquidityObj]
  )
}

export const getRemoveLiquidityData = (
  minBaseTokens: ethers.utils.BigNumber[],
  minTokens: ethers.utils.BigNumber[],
  deadline: number
) => {
  const removeLiquidityObj = {
    minBaseTokens,
    minTokens,
    deadline
  } as RemoveLiquidityObj

  return ethers.utils.defaultAbiCoder.encode(
    ['bytes4', RemoveLiquidityType],
    [methodsSignature.REMOVELIQUIDITY, removeLiquidityObj]
  )
}
