import { BigNumberish, BigNumber, ethers } from "ethers"
import { compareAddr, WalletConfig } from "../config"
import { PromiseSome } from "../utils"
import fetchPonyfill from 'fetch-ponyfill'
import { ConfigTracker, PresignedConfigUpdate, TransactionBody } from "./config-tracker"
import { Sessions } from "./gen/sessions.gen"
import { imageHash } from ".."
import { WalletContext } from "@0xsequence/network"

export class SessionsApiConfigTracker implements ConfigTracker {
  public sessions: Sessions

  constructor(url: string) {
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
      compareAddr(w.context.factory, args.context.factory) &&
      compareAddr(w.context.mainModule, args.context.mainModule)
    ))?.imageHash
  }

  saveCounterFactualWallet = async (args: {
    imageHash: string;
    context: WalletContext
  }): Promise<void> => {
    // TODO: Implement API
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

  savePresignedConfiguration = async ( args: {
    wallet: string,
    config: WalletConfig,
    tx: TransactionBody,
    signatures: {
      chainId: BigNumber,
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
        gapNonce: args.tx.gapNonce.toNumber(),
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
}
