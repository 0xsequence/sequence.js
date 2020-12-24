import { NetworkConfig } from '@0xsequence/network'
import { Relayer } from '@0xsequence/relayer'
import { SignedTransactions, Transactionish } from '@0xsequence/transactions'
import { JsonRpcProvider, TransactionResponse } from '@ethersproject/providers'
import { BigNumberish, Signer as AbstractSigner } from 'ethers'
import { BytesLike, Deferrable } from 'ethers/lib/utils'
import { WalletConfig } from '.'

export abstract class Signer extends AbstractSigner { // TODO: add implements TypedDataSigner
  abstract getProvider(chainId?: number): Promise<JsonRpcProvider | undefined>
  abstract getRelayer(chainId?: number): Promise<Relayer | undefined>

  // TODO: getWalletContext(..) and getWalletConfig(..)
  // return []WalletConfig instead of GlobalWalletConfig too..
  abstract getSigners(): Promise<string[]>

  // TODO: add chainId on sendTransaction() method and others, so its compatible with Wallet and MultiWallet
  abstract sendTransaction(transaction: Deferrable<Transactionish>, allSigners?: boolean): Promise<TransactionResponse> // TODO: chainId

  abstract signMessage(message: BytesLike, chainId?: NetworkConfig | BigNumberish, allSigners?: boolean): Promise<string>
  abstract signTransactions(transaction: Deferrable<Transactionish>, allSigners?: boolean): Promise<SignedTransactions> // TODO: chainId

  // TODO: signTypedData(..) + chainId ..
  // signTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>): Promise<string>;


  abstract updateConfig(newConfig: WalletConfig): Promise<[WalletConfig, TransactionResponse | undefined]> // TODO: chainId..
  abstract publishConfig(): Promise<TransactionResponse> // TOOD: chainId..

  // add isDeployed(chainId: ..) 
}

export type SignerThreshold = {
  chaind: number, // typo..
  weight: number
}

export type SignerInfo = {
  address: string,
  networks: SignerThreshold[]
}

export interface DecodedSignature {
  threshold: number
  signers: (DecodedSigner | DecodedOwner)[]
}

export interface DecodedOwner {
  weight: number
  address: string
}

export interface DecodedSigner {
  r: string
  s: string
  v: number
  t: number
  weight: number
}

export class InvalidSigner extends Error {}

export class NotEnoughSigners extends Error {}
