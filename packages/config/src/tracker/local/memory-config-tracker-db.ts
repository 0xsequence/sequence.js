import { WalletContext } from "@0xsequence/network"
import { ethers } from "ethers"
import { ConfigTrackerDatabase, SignaturePart } from "."
import { imageHash } from "../.."
import { WalletConfig } from "../../config"
import { DecodedSignaturePart } from "../../signature"
import { TransactionBody } from "../config-tracker"


export class MemoryConfigTrackerDb implements ConfigTrackerDatabase {
  private readonly _imageHashToConfig = new Map<string, WalletConfig>()
  private readonly _addressToImageHash = new Map<string, string>()
  private readonly _digestToTransaction = new Map<string, TransactionBody>()

  private readonly _signerToImageHashes = new Map<string, Set<string>>()
  private readonly _imageHashToSignaturePartKey = new Map<string, Set<string>>()

  private readonly _partKeysForAddressAndChaind = new Map<string, Map<string, Set<string>>>()
  private readonly _partIndexForDigestAndSigner = new Map<string, SignaturePart>()

  private _toImageHashKey(address: string, context: WalletContext) {
    return `${address.toLowerCase()}-${context.factory.toLowerCase()}-${context.mainModule.toLowerCase()}`
  }

  private _toPartIndex(signer: string, digest: string, chainId: ethers.BigNumber) {
    return `${signer.toLowerCase()}-${digest}-${chainId.toString()}`
  }

  imageHashOfCounterFactualWallet = async (args: {
    context: WalletContext,
    wallet: string
  }): Promise<string | undefined> => {
    const key = this._toImageHashKey(args.wallet, args.context)
    return this._addressToImageHash.get(key)
  }

  saveCounterFactualWallet = async (args: {
    wallet: string,
    imageHash: string,
    context: WalletContext
  }): Promise<void> => {
    const key = this._toImageHashKey(args.wallet, args.context)
    this._addressToImageHash.set(key, args.imageHash)
  }

  configOfImageHash = async (args: {
    imageHash: string
  }): Promise<WalletConfig | undefined> => {
    return this._imageHashToConfig.get(args.imageHash)
  }

  imageHashesOfSigner = async (args: {
    signer: string
  }): Promise<string[]> => {
    const set = this._signerToImageHashes.get(args.signer)
    if (!set) return []
    return [...set.keys()]
  }

  saveWalletConfig = async (args: {
    imageHash: string,
    config: WalletConfig
  }): Promise<void> => {
    this._imageHashToConfig.set(args.imageHash, args.config)

    args.config.signers.forEach(signer => {
      const arr = this._signerToImageHashes.get(signer.address)
      if (!arr) {
        this._signerToImageHashes.set(signer.address, new Set([args.imageHash]))
      } else {
        arr.add(args.imageHash)
      }
    })
  }

  transactionWithDigest = async (args: {
    digest: string
  }): Promise<TransactionBody | undefined> => {
    return this._digestToTransaction.get(args.digest)
  }

  savePresignedTransaction = async (args: {
    digest: string,
    body: TransactionBody
  }): Promise<void> => {
    this._digestToTransaction.set(args.digest, args.body)
  }

  saveSignatureParts = async (args: {
    wallet: string,
    digest: string,
    chainId: ethers.BigNumber,
    signatures: {
      part: DecodedSignaturePart,
      signer: string,
    }[],
    imageHash?: string
  }): Promise<void> => {
    const chainId = ethers.BigNumber.from(args.chainId)

    for (let i = 0; i < args.signatures.length; i ++) {
      const signature = args.signatures[i]
      const key = this._toPartIndex(signature.signer, args.digest, chainId)
  
      if (this._partIndexForDigestAndSigner.get(key)) {
        return
      }
  
      this._partIndexForDigestAndSigner.set(key, {
        wallet: args.wallet,
        digest: args.digest,
        chainId,
        signature: signature.part,
        signer: signature.signer,
        imageHash: args.imageHash
      })
  
      const signerLowerCase = signature.signer.toLowerCase()
      if (!this._partKeysForAddressAndChaind.has(signerLowerCase)) {
        this._partKeysForAddressAndChaind.set(signerLowerCase, new Map())
      }
  
      const partsForAddr = this._partKeysForAddressAndChaind.get(signerLowerCase)!
      if (!partsForAddr.has(chainId.toString())) {
        partsForAddr.set(chainId.toString(), new Set())
      }
  
      partsForAddr.get(chainId.toString())!.add(key)

      if (args.imageHash) {
        const partsForImageHash = this._imageHashToSignaturePartKey.get(args.imageHash)
        if (!partsForImageHash) {
          this._imageHashToSignaturePartKey.set(args.imageHash, new Set())
        }
  
        this._imageHashToSignaturePartKey.get(args.imageHash)!.add(key)
      }
    }
  }

  getSignaturePart = async (args: {
    signer: string,
    digest: string,
    chainId: ethers.BigNumberish
  }): Promise<SignaturePart | undefined> => {
    const chainId = ethers.BigNumber.from(args.chainId)
    const key = this._toPartIndex(args.signer, args.digest, chainId)

    return this._partIndexForDigestAndSigner.get(key)
  }

  getSignaturePartsForAddress = async (args: {
    signer: string,
    chainId?: ethers.BigNumberish
  }): Promise<SignaturePart[]> => {
    const signerLowerCase = args.signer.toLowerCase()
    const partsForAddr = this._partKeysForAddressAndChaind.get(signerLowerCase)
    if (!partsForAddr) return []

    let keys: string[]
    if (args.chainId) {
      const set = partsForAddr.get(ethers.BigNumber.from(args.chainId).toString())
      if (set) {
        keys = [...set.keys()]
      } else {
        keys = []
      }
    } else {
      keys = []
      partsForAddr.forEach((v) => keys.push(...v))
    }

    return keys
      .map((k) => this._partIndexForDigestAndSigner.get(k))
      .filter((v) => v) as SignaturePart[]
  }

  getSignaturePartsForImageHash = async (args: {
    imageHash: string,
  }): Promise<SignaturePart[]> => {
    const keys = this._imageHashToSignaturePartKey.get(args.imageHash)?.keys()
    if (!keys) return []

    const parts: SignaturePart[] = []
    for (const key of keys) {
      const part = this._partIndexForDigestAndSigner.get(key)
      if (part) {
        parts.push(part)
      }
    }

    return parts
  }
}
