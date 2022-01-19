import { ethers, Signer as AbstractSigner } from 'ethers'
import { TypedDataDomain, TypedDataField } from '@ethersproject/abstract-signer'
import { NetworkConfig, ChainIdLike, WalletContext } from '@0xsequence/network'
import { Relayer } from '@0xsequence/relayer'
import {
  Transactionish,
  TransactionRequest,
  Transaction,
  TransactionResponse,
  SignedTransactionBundle
} from '@0xsequence/transactions'
import { JsonRpcProvider } from '@ethersproject/providers'
import { BytesLike } from '@ethersproject/bytes'
import { Deferrable } from '@0xsequence/utils'
import { WalletConfig, WalletState } from '@0xsequence/config'
import { DecodedSigner, DecodedOwner } from './config'

export abstract class Signer extends AbstractSigner {
  static isSequenceSigner(cand: any): cand is Signer {
    return isSequenceSigner(cand)
  }

  abstract getProvider(chainId?: number): Promise<JsonRpcProvider | undefined>
  abstract getRelayer(chainId?: number): Promise<Relayer | undefined>

  abstract getWalletContext(): Promise<WalletContext>
  abstract getWalletConfig(chainId?: ChainIdLike): Promise<WalletConfig | undefined>
  abstract getWalletState(chainId?: ChainIdLike): Promise<WalletState>

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
    allSigners?: boolean
  ): Promise<TransactionResponse>

  // sendTransactionBatch provides the ability to send an array/batch of transactions as a single native on-chain transaction.
  // This method works identically to sendTransaction but offers a different syntax for convience, readability and type clarity.
  abstract sendTransactionBatch(
    transactions: Deferrable<TransactionRequest[] | Transaction[]>,
    chainId?: ChainIdLike,
    allSigners?: boolean
  ): Promise<TransactionResponse>

  // Low-level methods to sign and send/relayer signed transactions separately. The combination of these methods
  // is like calling just sendTransaction(..) above. Also note that sendSignedTransactions is identical
  // to calling getRelayer().relay(signedTxs), but included in this interface for convenience.
  abstract signTransactions(
    txs: Deferrable<Transactionish>,
    chainId?: ChainIdLike,
    allSigners?: boolean
  ): Promise<SignedTransactionBundle>
  abstract sendSignedTransactions(signedBundle: SignedTransactionBundle, chainId?: ChainIdLike): Promise<TransactionResponse>

  // isDeployed ..
  abstract isDeployed(chainId?: ChainIdLike): Promise<boolean>
}

export type SignedTransactionsCallback = (signedBundle: SignedTransactionBundle, metaTxnHash: string) => void

export function isSequenceSigner(signer: AbstractSigner): signer is Signer {
  const cand = signer as Signer
  return (
    cand &&
    cand.getWalletContext !== undefined &&
    cand.getWalletConfig !== undefined
  )
}

// TODO: move to error.ts, along with others..
export class InvalidSigner extends Error {}

export class NotEnoughSigners extends Error {}
