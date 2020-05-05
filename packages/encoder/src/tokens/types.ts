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

export type MetaTxnOpts = {
  nonce: utils.BigNumber
  gasReceipt?: GasReceipt | null
  extra?: utils.Arrayish | null
}

export interface MetaSafeBatchTransferFrom {
  type: 'metaSafeBatchTransferFrom'
  params: [string, utils.BigNumberish[], utils.BigNumberish[]]
}

export interface MetaSafeTransferFrom {
  type: 'metaSafeTransferFrom'
  params: [string, utils.BigNumberish, utils.BigNumberish]
}

export interface MetaSetApprovalForAll {
  type: 'metaSetApprovalForAll'
  params: [string, boolean]
}

export type MetaTxMethods =
  | MetaSafeBatchTransferFrom
  | MetaSafeTransferFrom
  | MetaSetApprovalForAll
