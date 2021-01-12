import { BytesLike, ethers, Contract } from 'ethers'
import { Signer, DecodedSignature, DecodedSigner, DecodedOwner } from './signer'
import { walletContracts } from '@0xsequence/abi'
import { WalletConfig } from '@0xsequence/config'

export const fetchImageHash = async (signer: Signer): Promise<string> => {
  const address = await signer.getAddress()
  const walletContract = new Contract(address, walletContracts.mainModuleUpgradable.abi, await signer.getProvider())
  const currentImageHash = await (walletContract.functions.imageHash.call([]).catch(() => []))  as string[]
  return currentImageHash && currentImageHash.length > 0 ? currentImageHash[0] : ''
}

// recoverConfig decodes a WalletConfig from the subDigest and signature combo. Note: the subDigest argument
// is an encoding format of the original message, encoded by:
//
// subDigest = packMessageData(wallet.address, chainId, ethers.utils.keccak256(message))
export const recoverConfig = (subDigest: BytesLike, signature: string | DecodedSignature): WalletConfig => {
  const digest = ethers.utils.arrayify(ethers.utils.keccak256(subDigest))
  return recoverConfigFromDigest(digest, signature)
}

export const isSigner = (obj: DecodedSigner | DecodedOwner): boolean => {
  const cast = obj as DecodedSigner
  return cast.r !== undefined && cast.s !== undefined
}

// recoverConfigFromDigest decodes a WalletConfig from a digest and signature combo. Note: the digest
// is the keccak256 of the subDigest, see `recoverConfig` method.
export const recoverConfigFromDigest = (digest: BytesLike, signature: string | DecodedSignature): WalletConfig => {
  const decoded = (<DecodedSignature>signature).threshold !== undefined ? <DecodedSignature>signature : decodeSignature(signature as string)

  const signers = decoded.signers.map(s => {
    if (isSigner(s)) {
      return {
        weight: s.weight,
        address: recoverSigner(digest, s as DecodedSigner)
      }
    } else {
      return {
        weight: s.weight,
        address: (<DecodedOwner>s).address
      }
    }
  })

  return {
    threshold: decoded.threshold,
    signers: signers
  }
}

export const decodeSignature = (signature: string): DecodedSignature => {
  const auxsig = signature.replace('0x', '')

  const threshold = ethers.BigNumber.from(`0x${auxsig.slice(0, 4)}`).toNumber()

  const signers = []

  for (let rindex = 4; rindex < auxsig.length; ) {
    const isAddr = auxsig.slice(rindex, rindex + 2) !== '00'
    rindex += 2

    const weight = ethers.BigNumber.from(`0x${auxsig.slice(rindex, rindex + 2)}`).toNumber()
    rindex += 2

    if (isAddr) {
      const addr = ethers.utils.getAddress(auxsig.slice(rindex, rindex + 40))
      rindex += 40

      signers.push({
        weight: weight,
        address: addr
      })
    } else {
      const r = `0x${auxsig.slice(rindex, rindex + 64)}`
      rindex += 64

      const s = `0x${auxsig.slice(rindex, rindex + 64)}`
      rindex += 64

      const v = ethers.BigNumber.from(`0x${auxsig.slice(rindex, rindex + 2)}`).toNumber()
      rindex += 2

      const t = ethers.BigNumber.from(`0x${auxsig.slice(rindex, rindex + 2)}`).toNumber()
      rindex += 2

      signers.push({
        weight: weight,
        r: r,
        s: s,
        v: v,
        t: t
      })
    }
  }

  return {
    threshold: threshold,
    signers: signers
  }
}

const SIG_TYPE_EIP712 = 1
const SIG_TYPE_ETH_SIGN = 2

export const recoverSigner = (digest: BytesLike, sig: DecodedSigner) => {
  switch (sig.t) {
    case SIG_TYPE_EIP712:
      return ethers.utils.recoverAddress(digest, {
        r: sig.r,
        s: sig.s,
        v: sig.v
      })
    case SIG_TYPE_ETH_SIGN:
      const subDigest = ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ['string', 'bytes32'],
          ['\x19Ethereum Signed Message:\n32', digest]
        )
      )

      return ethers.utils.recoverAddress(subDigest, {
        r: sig.r,
        s: sig.s,
        v: sig.v
      })
    default:
      throw new Error('Unknown signature')
  }
}

export const joinSignatures = (...signatures: string[]) => {
  return signatures.reduce((p, c) => joinTwoSignatures(p, c))
}

export const joinTwoSignatures = (a: string, b: string): string => {
  const da = decodeSignature(a)
  const db = decodeSignature(b)

  const signers = da.signers.map((s, i) => ((<DecodedSigner>s).r ? s : db.signers[i]))

  const accountBytes = signers.map(s => {
    if ((<DecodedSigner>s).r) {
      const sig = s as DecodedSigner
      return ethers.utils.solidityPack(
        ['bool', 'uint8', 'bytes32', 'bytes32', 'uint8', 'uint8'],
        [false, s.weight, sig.r, sig.s, sig.v, sig.t]
      )
    } else {
      return ethers.utils.solidityPack(
        ['bool', 'uint8', 'address'],
        [true, s.weight, ethers.utils.getAddress((<DecodedOwner>s).address)]
      )
    }
  })

  return ethers.utils.solidityPack(['uint16', ...Array(accountBytes.length).fill('bytes')], [da.threshold, ...accountBytes])
}
