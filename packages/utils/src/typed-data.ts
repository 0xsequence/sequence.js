import { ethers } from 'ethers'
import { TypedDataDomain, TypedDataField }  from '@ethersproject/abstract-signer'

export interface TypedData {
  domain: TypedDataDomain
  types: Record<string, Array<TypedDataField>>
  message: Record<string, any>
}

export type { TypedDataDomain, TypedDataField }

export const encodeTypedDataHash = (typedData: TypedData) => {
  return ethers.utils._TypedDataEncoder.hash(typedData.domain, typedData.types, typedData.message)
}

export const encodeTypedDataDigest = (typedData: TypedData) => {
  const hash = encodeTypedDataHash(typedData)
  const digest = ethers.utils.arrayify(ethers.utils.keccak256(hash))
  return digest
}
