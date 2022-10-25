import { BytesLike, Signer as AbstractSigner, providers, TypedDataDomain, TypedDataField } from 'ethers'
import { NetworkConfig, ChainIdLike, WalletContext } from '@0xsequence/network'
import { FeeQuote, Relayer } from '@0xsequence/relayer'
import {
  SignedTransactions,
  Transactionish,
  TransactionRequest,
  Transaction,
  TransactionResponse
} from '@0xsequence/transactions'
import { Deferrable } from '@0xsequence/utils'
import { WalletConfig, WalletState } from '@0xsequence/config'

export abstract class Signer extends AbstractSigner {
  static isSequenceSigner(cand: any): cand is Signer {
    return isSequenceSigner(cand)
  }

  abstract getProvider(chainId?: number): Promise<providers.JsonRpcProvider | undefined>
  abstract getRelayer(chainId?: number): Promise<Relayer | undefined>

  abstract getWalletContext(): Promise<WalletContext>
  abstract getWalletConfig(chainId?: ChainIdLike): Promise<WalletConfig[]>
  abstract getWalletState(chainId?: ChainIdLike): Promise<WalletState[]>

  abstract getNetworks(): Promise<NetworkConfig[]>

  // getSigners returns a list of available / attached signers to the interface. Note: you need
  // enough signers in order to meet the signing threshold that satisfies a wallet config.
  abstract getSigners(): Promise<string[]>

  // signMessage .....
  abstract signMessage(message: BytesLike, chainId?: ChainIdLike, allSigners?: boolean, isDigest?: boolean): Promise<string>

  // signTypedData ..
  abstract signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    message: Record<string, any>,
    chainId?: ChainIdLike,
    allSigners?: boolean
  ): Promise<string>

  // sendTransaction takes an unsigned transaction, or list of unsigned transactions, and then has it signed by
  // the signer, and finally sends it to the relayer for submission to an Ethereum network.
  abstract sendTransaction(
    transaction: Deferrable<Transactionish>,
    chainId?: ChainIdLike,
    allSigners?: boolean,
    quote?: FeeQuote
  ): Promise<TransactionResponse>

  // sendTransactionBatch provides the ability to send an array/batch of transactions as a single native on-chain transaction.
  // This method works identically to sendTransaction but offers a different syntax for convience, readability and type clarity.
  abstract sendTransactionBatch(
    transactions: Deferrable<TransactionRequest[] | Transaction[]>,
    chainId?: ChainIdLike,
    allSigners?: boolean,
    quote?: FeeQuote
  ): Promise<TransactionResponse>

  // Low-level methods to sign and send/relayer signed transactions separately. The combination of these methods
  // is like calling just sendTransaction(..) above. Also note that sendSignedTransactions is identical
  // to calling getRelayer().relay(signedTxs), but included in this interface for convenience.
  abstract signTransactions(
    txs: Deferrable<Transactionish>,
    chainId?: ChainIdLike,
    allSigners?: boolean
  ): Promise<SignedTransactions>
  abstract sendSignedTransactions(signedTxs: SignedTransactions, chainId?: ChainIdLike, quote?: FeeQuote): Promise<TransactionResponse>

  // updateConfig will update the wallet image hash on-chain, aka deploying a smart wallet config to chain. If
  // newConfig argument is undefined, then it will use the existing config. Config contents will also be
  // automatically published to the authChain when updating the config image hash.
  abstract updateConfig(newConfig?: WalletConfig): Promise<[WalletConfig, TransactionResponse | undefined]>

  // publishConfig will store the raw WalletConfig object on-chain, note: this may be expensive,
  // and is only necessary for config data-availability, in case of Account the contents are published
  // to the authChain.
  abstract publishConfig(): Promise<TransactionResponse | undefined>

  // isDeployed ..
  abstract isDeployed(chainId?: ChainIdLike): Promise<boolean>
}

export type SignedTransactionsCallback = (signedTxs: SignedTransactions, metaTxnHash: string) => void

export function isSequenceSigner(signer: AbstractSigner): signer is Signer {
  const cand = signer as Signer
  return (
    cand &&
    cand.updateConfig !== undefined &&
    cand.publishConfig !== undefined &&
    cand.getWalletContext !== undefined &&
    cand.getWalletConfig !== undefined
  )
}

// TODO: move to error.ts, along with others..
export class InvalidSigner extends Error {}

export class NotEnoughSigners extends Error {}
