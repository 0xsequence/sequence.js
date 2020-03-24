import { BigNumber } from 'ethers/utils'

export type MethodTypes =
  | 'metaSafeBatchTransferFrom'
  | 'metaSafeTransferFrom'
  | 'metaSetApprovalForAll'

export type GasReceipt = {
  gasFee: number | string | BigNumber
  gasLimitCallback: number | string | BigNumber
  feeRecipient: string
  feeTokenData: FeeTokenData
}

export enum FeeTokenType {
  FeeTokenERC1155 = 0,
  FeeTokenERC20
}

export type FeeTokenData = {
  type: FeeTokenType
  address: string
  id: number | BigNumber
}

export type Opts = {
  nonce: BigNumber
  gasReceipt?: GasReceipt | null
  extra?: Uint8Array | null
}

export type BuyTokensObj = {
  recipient: string
  ids: number[] | string[] | BigNumber[]
  amounts: number[] | string[] | BigNumber[]
  deadline: number | string | BigNumber
}

export type SellTokensObj = {
  recipient: string
  minBaseTokens: number | string | BigNumber
  deadline: number | string | BigNumber
}
