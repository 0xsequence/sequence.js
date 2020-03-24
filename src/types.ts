import { utils } from 'ethers'

export type MethodTypes =
  | 'metaSafeBatchTransferFrom'
  | 'metaSafeTransferFrom'
  | 'metaSetApprovalForAll'

export type GasReceipt = {
  gasFee: number | string | utils.BigNumber
  gasLimitCallback: number | string | utils.BigNumber
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
  id: number | utils.BigNumber
}

export type Opts = {
  nonce: utils.BigNumber
  gasReceipt?: GasReceipt | null
  extra?: utils.Arrayish | null
}

export type BuyTokensObj = {
  recipient: string
  ids: number[] | string[] | utils.BigNumber[]
  amounts: number[] | string[] | utils.BigNumber[]
  deadline: number | string | utils.BigNumber
}

export type SellTokensObj = {
  recipient: string
  minBaseTokens: number | string | utils.BigNumber
  deadline: number | string | utils.BigNumber
}
