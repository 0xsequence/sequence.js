

import { NetworkConfig } from '@arcadeum/provider'
import { BigNumberish, providers } from 'ethers'

export type MoveEstimate = {
  crossTime: BigNumberish,
  steps: BigNumberish
}

export type Move = {
  transactionHash: string,
  completeTx: providers.TransactionRequest[] | undefined,
  isCompleted: boolean,
  isPending: boolean,
  fromChain: number,
  toChain: number
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
  id: BigNumberish,
  amount: BigNumberish
}

export function isERC20Move(move: Move): move is MoveERC20 {
  const cand = move as MoveERC20 & MoveERC721
  return cand.token !== undefined && cand.amount !== undefined && !cand.id
}

export function isERC721Move(move: Move): move is MoveERC721 {
  const cand = move as MoveERC721 & MoveERC1155
  return cand.token !== undefined && cand.id !== undefined && !cand.amount
}

export function isERC1155Move(move: Move): move is MoveERC721 {
  const cand = move as MoveERC1155
  return cand.token !== undefined && cand.id !== undefined && cand.amount !== undefined
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

  supportsNative(from: NetworkConfig, to: NetworkConfig): Promise<boolean>
  estimateNative(from: NetworkConfig, to: NetworkConfig): Promise<MoveEstimate | undefined>
  moveNative(from: NetworkConfig, to: NetworkConfig, dest: string, amount: BigNumberish): Promise<providers.TransactionRequest[] | undefined>
  completeNative(from: NetworkConfig, to: NetworkConfig, txHash: string, wallet: string): Promise<providers.TransactionRequest[] | undefined>

  supportsERC20(from: NetworkConfig, to: NetworkConfig, token: string): Promise<boolean>
  estimateERC20(from: NetworkConfig, to: NetworkConfig, token: string): Promise<MoveEstimate | undefined>
  moveERC20(from: NetworkConfig, to: NetworkConfig, token: string, dest: string, amount: BigNumberish): Promise<providers.TransactionRequest[] | undefined>
  completeERC20(from: NetworkConfig, to: NetworkConfig, txHash: string, wallet: string): Promise<providers.TransactionRequest[] | undefined>

  supportsERC1155(from: NetworkConfig, to: NetworkConfig, token: string, ids: BigNumberish[]): Promise<boolean>
  estimateERC1155(from: NetworkConfig, to: NetworkConfig, token: string, ids: BigNumberish[]): Promise<MoveEstimate | undefined>
  moveERC1155(from: NetworkConfig, to: NetworkConfig, token: string, ids: BigNumberish[], amounts: BigNumberish[]): Promise<providers.TransactionRequest[] | undefined>
  completeERC1155(from: NetworkConfig, to: NetworkConfig, txHash: string, wallet: string): Promise<providers.TransactionRequest[] | undefined>

  supportsERC721(from: NetworkConfig, to: NetworkConfig, token: string, ids: BigNumberish[]): Promise<boolean>
  estimateERC721(from: NetworkConfig, to: NetworkConfig, token: string, ids: BigNumberish[]): Promise<MoveEstimate | undefined>
  moveERC721(from: NetworkConfig, to: NetworkConfig, token: string, ids: BigNumberish[]): Promise<providers.TransactionRequest[] | undefined>
  completeERC721(from: NetworkConfig, to: NetworkConfig, txHash: string, wallet: string): Promise<providers.TransactionRequest[] | undefined>
}
