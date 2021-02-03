import { ethers } from 'ethers'
import { TypedDataDomain, TypedDataField }  from '@ethersproject/abstract-signer'

export interface TypedData {
  domain: TypedDataDomain
  types: Record<string, Array<TypedDataField>>
  message: Record<string, any>
  primaryType?: string
}

export type { TypedDataDomain, TypedDataField }

export const encodeTypedDataHash = (typedData: TypedData) => {
  const types = { ...typedData.types }
  
  // remove EIP712Domain key from types as ethers will auto-gen it in
  // the hash encoder below
  delete types['EIP712Domain']

  return ethers.utils.arrayify(ethers.utils._TypedDataEncoder.hash(typedData.domain, types, typedData.message))
}

export const encodeTypedDataDigest = (typedData: TypedData) => {
  const hash = encodeTypedDataHash(typedData)
  const digest = ethers.utils.arrayify(ethers.utils.keccak256(hash))
  return digest
}
