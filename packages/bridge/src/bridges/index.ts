import { NetworkConfig } from '@0xsequence/networks'
import { BigNumberish, providers } from 'ethers'

export type MoveEstimate = {
  crossTime: number,
  steps: number
}

export type Move = {
  transactionHash: string,
  completeTx: providers.TransactionRequest[] | undefined,
  isCompleted: boolean,
  isPending: boolean,
  fromChainId: number,
  toChainId: number
}

export type MoveNative = Move & {
  amount: BigNumberish
}

export type MoveERC20 = Move & {
  token: string,
  amount: BigNumberish
}

export type MoveERC721 = Move & {
  token: string,
  id: BigNumberish
}

export type MoveERC1155 = Move & {
  token: string,
  ids: BigNumberish[],
  amounts: BigNumberish[]
}

export function isERC20Move(move: Move): move is MoveERC20 {
  const cand = move as MoveERC20 & MoveERC721
  return cand.token !== undefined && cand.amount !== undefined && !cand.id
}

export function isERC721Move(move: Move): move is MoveERC721 {
  const cand = move as MoveERC721 & MoveERC1155
  return cand.token !== undefined && cand.id !== undefined && !cand.amounts
}

export function isERC1155Move(move: Move): move is MoveERC1155 {
  const cand = move as MoveERC1155
  return cand.token !== undefined && cand.ids !== undefined && cand.amounts !== undefined
}

export function isNativeMove(move: Move): move is MoveNative {
  const cand = move as MoveERC20 & MoveERC721
  return !isERC20Move(move) && cand.amount !== undefined && !cand.id
}

export interface Bridge {
  name(): string
  id(): string

  connect(networks: NetworkConfig[]): Bridge

  getMoves(wallet: string, from: providers.BlockTag, to: providers.BlockTag): Promise<Move[]>
}

export interface BridgeNative extends Bridge {
  supportsNative(from: NetworkConfig, to: NetworkConfig): Promise<boolean>
  estimateNative(from: NetworkConfig, to: NetworkConfig): Promise<MoveEstimate | undefined>
  moveNative(from: NetworkConfig, to: NetworkConfig, dest: string, amount: BigNumberish): Promise<providers.TransactionRequest[] | undefined>
  completeNative(from: NetworkConfig, to: NetworkConfig, txHash: string, wallet: string): Promise<providers.TransactionRequest[] | undefined>
}

export function isBridgeNative(bridge: Bridge): bridge is BridgeNative {
  const cand = bridge as BridgeNative
  return cand.supportsNative !== undefined && cand.estimateNative !== undefined && cand.moveNative !== undefined && cand.completeNative !== undefined
}

export interface BridgeERC20 extends Bridge {
  supportsERC20(from: NetworkConfig, to: NetworkConfig, token: string): Promise<boolean>
  estimateERC20(from: NetworkConfig, to: NetworkConfig, token: string): Promise<MoveEstimate | undefined>
  moveERC20(from: NetworkConfig, to: NetworkConfig, token: string, dest: string, amount: BigNumberish): Promise<providers.TransactionRequest[] | undefined>
  completeERC20(from: NetworkConfig, to: NetworkConfig, txHash: string, wallet: string): Promise<providers.TransactionRequest[] | undefined>
}

export function isBridgeERC20(bridge: Bridge): bridge is BridgeERC20 {
  const cand = bridge as BridgeERC20
  return cand.supportsERC20 !== undefined && cand.estimateERC20 !== undefined && cand.moveERC20 !== undefined && cand.completeERC20 !== undefined
}

export interface BridgeERC721 extends Bridge {
  supportsERC721(from: NetworkConfig, to: NetworkConfig, token: string, ids: BigNumberish[]): Promise<boolean>
  estimateERC721(from: NetworkConfig, to: NetworkConfig, token: string, ids: BigNumberish[]): Promise<MoveEstimate | undefined>
  moveERC721(from: NetworkConfig, to: NetworkConfig, token: string, dest: string, ids: BigNumberish[]): Promise<providers.TransactionRequest[] | undefined>
  completeERC721(from: NetworkConfig, to: NetworkConfig, txHash: string, wallet: string): Promise<providers.TransactionRequest[] | undefined>
}

export function isBridgeERC712(bridge: Bridge): bridge is BridgeERC721 {
  const cand = bridge as BridgeERC721
  return cand.supportsERC721 !== undefined && cand.estimateERC721 !== undefined && cand.moveERC721 !== undefined && cand.completeERC721 !== undefined
}

export interface BridgeERC1155 extends Bridge {
  supportsERC1155(from: NetworkConfig, to: NetworkConfig, token: string, ids: BigNumberish[]): Promise<boolean>
  estimateERC1155(from: NetworkConfig, to: NetworkConfig, token: string, ids: BigNumberish[]): Promise<MoveEstimate | undefined>
  moveERC1155(from: NetworkConfig, to: NetworkConfig, token: string, dest: string, ids: BigNumberish[], amounts: BigNumberish[]): Promise<providers.TransactionRequest[] | undefined>
  completeERC1155(from: NetworkConfig, to: NetworkConfig, txHash: string, wallet: string): Promise<providers.TransactionRequest[] | undefined>
}

export function isBridgeERC1155(bridge: Bridge): bridge is BridgeERC1155 {
  const cand = bridge as BridgeERC1155
  return cand.supportsERC1155 !== undefined && cand.estimateERC1155 !== undefined && cand.moveERC1155 !== undefined && cand.completeERC1155 !== undefined
}
