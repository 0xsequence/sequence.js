import { BigNumberish, BigNumber, ethers } from "ethers"
import { WalletConfig } from "../config"
import fetchPonyfill from 'fetch-ponyfill'
import { ConfigTracker, PresignedConfigUpdate, TransactionBody } from "./config-tracker"
import { Sessions } from "./gen/sessions.gen"
import { addressOf, DecodedSignaturePart, imageHash, isAddrEqual } from ".."
import { WalletContext } from "@0xsequence/network"

export class SessionsApiConfigTracker implements ConfigTracker {
  public sessions: Sessions

  constructor(url: string, public maxResults = 50) {
    this.sessions = new Sessions(url, fetchPonyfill().fetch)
  }

  imageHashOfCounterFactualWallet = async (args: {
    context: WalletContext;
    wallet: string
  }): Promise<string | undefined> => {
    const candidates = await this.sessions.imageHashForWallet({ address: args.wallet })

    // API may return counterfactual wallets for other configs
    // so we filter looking for the rifgr one
    return candidates.wallets.find((w) => (
      isAddrEqual(w.context.factory, args.context.factory) &&
      isAddrEqual(w.context.mainModule, args.context.mainModule)
    ))?.imageHash
  }

  saveCounterFactualWallet = async (args: {
    imageHash: string;
    context: WalletContext
  }): Promise<void> => {
    const address = addressOf(args.imageHash, args.context)
    await this.sessions.saveWallets({ wallets: [{ address, imageHash: args.imageHash, context: args.context }] })
  }

  loadPresignedConfiguration = async ( args: {
    wallet: string,
    fromImageHash: string,
    chainId: BigNumberish
  }): Promise<PresignedConfigUpdate[]> => {
    const res = await this.sessions.presignedRouteForWallet({
      wallet: args.wallet,
      fromImageHash: args.fromImageHash,
      chainid: ethers.BigNumber.from(args.chainId).toString()
    })
  
    return res.txs.map((tx) => {
      return {
        chainId: ethers.BigNumber.from(tx.signature.chainid),
        signature: tx.signature.signature,
        body: {
          ...tx.tx,
          gapNonce: ethers.BigNumber.from(tx.tx.gapNonce),
          nonce: ethers.BigNumber.from(tx.tx.nonce)
        }
      }
    })
  }

  configOfImageHash = async ( args : {
    imageHash: string
  }): Promise<WalletConfig | undefined> => {
    const res = await this.sessions.configurationForImageHash({ imageHash: args.imageHash })
    return res.config
  }

  saveWitness = async (args: {
    wallet: string,
    digest: string,
    signatures: {
      chainId: BigNumberish,
      signature: string
    }[]
  }): Promise<void> => {
    await this.sessions.saveWitness({
      witness: {
        wallet: args.wallet,
        digest: args.digest,
      },
      signatures: args.signatures.map((s) => ({
        chainid: s.chainId.toString(),
        signature: s.signature
      }))
    })
  }

  savePresignedConfiguration = async ( args: {
    wallet: string,
    config: WalletConfig,
    tx: TransactionBody,
    signatures: {
      chainId: BigNumberish,
      signature: string
    }[]
  }): Promise<void> => {
    await this.sessions.savePresignedTransactions({
      newConfig: {
        ...args.config,
        imageHash: ""
      },
      rtx: {
        ...args.tx,
        gapNonce: ethers.BigNumber.from(args.tx.gapNonce).toNumber(),
        nonce: args.tx.nonce.toString()
      },
      signatures: args.signatures.map((sig) => {
        return {
          chainid: sig.chainId.toString(),
          signature: sig.signature
        }
      })
    })
  }

  saveWalletConfig = async ( args: {
    config: WalletConfig
  }): Promise<void> => {
    await this.sessions.saveConfigurations({ configs: [{ ...args.config, imageHash: "" }] })
  }

  walletsOfSigner = async (args: {
    signer: string
  }): Promise<{ wallet: string, proof: { digest: string, chainId: ethers.BigNumber, signature: DecodedSignaturePart }}[]> => {
    const res = await this.sessions.walletsOfSigner({ address: args.signer, start: 0, count: this.maxResults })
    return res.wallets.map((w) => {
      const chainId = ethers.BigNumber.from(w.proof.chainId)
      const signature = { weight: 0, signature: w.proof.signature }
      return { wallet: w.address, proof: { digest: w.proof.digest, chainId, signature } }
    })
  }

  signaturesOfSigner = async (args: {
    signer: string
  }): Promise<{ signature: string, chainid: ethers.BigNumber, wallet: string, digest: string }[]> => {
    // Call sessions client
    const res = await this.sessions.knownSignaturesOfSigner({ signer: args.signer, start: 0, count: this.maxResults })

    // Convert to our format
    return res.signatures.map((sig) => {
      return {
        signature: sig.signature,
        chainid: ethers.BigNumber.from(sig.chainid),
        wallet: sig.transaction.wallet,
        digest: sig.transaction.digest
      }
    })
  }

  imageHashesOfSigner = async (args: { signer: string }): Promise<string[]> => {
    const res = await this.sessions.imageHashesForSigner({ address: args.signer, start: 0, count: this.maxResults })
    return res.signers.map((r) => r.imageHash)
  }

  signaturesForImageHash = async (args: {
    imageHash: string
  }): Promise<{ signer: string, signature: string, chainId: ethers.BigNumber, wallet: string, digest: string }[]> => {
    const res = await this.sessions.signaturesForImageHash({ imageHash: args.imageHash, start: 0, count: this.maxResults })
    return res.signatures.map((sig) => ({
      signer: sig.signer,
      signature: sig.signature,
      chainId: ethers.BigNumber.from(sig.chainid),
      wallet: sig.transaction.wallet,
      digest: sig.transaction.digest
    }))
  }
}
