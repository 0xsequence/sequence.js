import { Config, Context, GenericTree, Payload, Signature } from '@0xsequence/wallet-primitives'
import { Address, Hex } from 'ox'
import { Reader as ReaderInterface } from '../index.js'

export class Reader implements ReaderInterface {
  getConfiguration(imageHash: Hex.Hex): Promise<Config.Config | undefined> {
  }

  getDeploy(wallet: Address.Address): Promise<{ imageHash: Hex.Hex; context: Context.Context } | undefined> {
  }

  getWallets(signer: Address.Address): Promise<{ [wallet: Address.Address]: { chainId: number; payload: Payload.Parented; signature: Signature.SignatureOfSignerLeaf } }> {
  }

  getWalletsForSapient(signer: Address.Address, imageHash: Hex.Hex): Promise<{ [wallet: Address.Address]: { chainId: number; payload: Payload.Parented; signature: Signature.SignatureOfSapientSignerLeaf } }> {
  }

  getWitnessFor(wallet: Address.Address, signer: Address.Address): Promise<{ chainId: number; payload: Payload.Parented; signature: Signature.SignatureOfSignerLeaf } | undefined> {
  }

  getWitnessForSapient(wallet: Address.Address, signer: Address.Address, imageHash: Hex.Hex): Promise<{ chainId: number; payload: Payload.Parented; signature: Signature.SignatureOfSapientSignerLeaf } | undefined> {
  }

  getConfigurationUpdates(wallet: Address.Address, fromImageHash: Hex.Hex, options?: { allUpdates?: boolean }): Promise<Array<{ imageHash: Hex.Hex; signature: Signature.RawSignature }>> {
  }

  getTree(imageHash: Hex.Hex): Promise<GenericTree.Tree | undefined> {
  }

  getPayload(digest: Hex.Hex): Promise<{ chainId: number; payload: Payload.Parented; wallet: Address.Address } | undefined> {
  }
}
