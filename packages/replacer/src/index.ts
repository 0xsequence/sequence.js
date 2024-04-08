import { ethers } from 'ethers'
import { walletContracts } from '@0xsequence/abi'
import { isIPFS, useGateway } from './ipfs'
import { commons } from '@0xsequence/core'

export * from './cached'

export function eip5719Contract(address: string, provider: ethers.Provider): ethers.Contract {
  // TODO: for some reason walletContracts is not being loaded from local
  // remove this code once fixed
  const abi = [
    {
      inputs: [
        {
          internalType: 'bytes32',
          type: 'bytes32'
        }
      ],
      name: 'getAlternativeSignature',
      outputs: [
        {
          internalType: 'string',
          type: 'string'
        }
      ],
      stateMutability: 'view',
      type: 'function'
    }
  ]

  return new ethers.Contract(address, abi, provider)
}

export function eip1271Contract(address: string, provider: ethers.Provider): ethers.Contract {
  return new ethers.Contract(address, walletContracts.erc1271.abi, provider)
}

export async function isValidSignature(
  address: string,
  provider: ethers.Provider,
  digest: ethers.BytesLike,
  signature: ethers.BytesLike
): Promise<boolean> {
  // First we try to validate the signature using Ethers
  try {
    const addr = ethers.recoverAddress(digest, ethers.hexlify(signature))
    if (addr.toLowerCase() === address.toLowerCase()) return true
  } catch {}

  // Then we try to validate the signature using EIP1271
  try {
    const contract = eip1271Contract(address, provider)
    const value = await contract.isValidSignature(digest, signature)
    if (value === walletContracts.erc1271.returns) return true
  } catch {}

  // If all else fails, we return false
  return false
}

export interface URISolver {
  resolve: (uri: string) => Promise<string>
}

async function tryAwait<T>(promise: Promise<T>): Promise<T | undefined> {
  try {
    return await promise
  } catch {
    return undefined
  }
}

export async function runByEIP5719(
  address: string,
  provider: ethers.Provider,
  digest: ethers.BytesLike,
  signature: ethers.BytesLike,
  solver?: URISolver,
  tries: number = 0
): Promise<ethers.BytesLike> {
  if (tries > 10) throw new Error('EIP5719 - Too many tries')

  if (commons.signer.canRecover(signature)) {
    const recoveredAddr = commons.signer.recoverSigner(digest, signature)
    if (recoveredAddr && recoveredAddr.toLowerCase() === address.toLowerCase()) return signature
  }

  try {
    if (await commons.signer.isValidSignature(address, digest, signature, provider)) {
      return signature
    }
  } catch {}

  const altUri = await tryAwait(eip5719Contract(address, provider).getAlternativeSignature(digest) as Promise<string>)
  if (!altUri || altUri === '') throw new Error('EIP5719 - Invalid signature and no alternative signature')

  const altSignature = ethers.hexlify(await (solver || new URISolverIPFS()).resolve(altUri))
  if (!altSignature || altSignature === '') throw new Error('EIP5719 - Empty alternative signature')
  if (altSignature === ethers.hexlify(signature)) {
    throw new Error('EIP5719 - Alternative signature is invalid or the same')
  }
  return runByEIP5719(address, provider, digest, altSignature, solver, tries + 1)
}

export class URISolverIPFS implements URISolver {
  constructor(public gateway: string = 'https://cloudflare-ipfs.com/ipfs/') {}

  uri = (uri: string): string => {
    if (isIPFS(uri)) return useGateway(uri, this.gateway)
    return uri
  }

  resolve = async (uri: string): Promise<string> => {
    const url = this.uri(uri)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`URISolverIPFS - Failed to fetch ${url}`)
    return await res.text()
  }
}
