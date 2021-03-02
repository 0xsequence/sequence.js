import { ethers } from 'ethers'
import { TypedDataDomain, TypedDataField }  from '@ethersproject/abstract-signer'

export interface TypedData {
  domain: TypedDataDomain
  types: Record<string, Array<TypedDataField>>
  message: Record<string, any>
  primaryType?: string
}

export type { TypedDataDomain, TypedDataField }

export const encodeTypedDataHash = (typedData: TypedData): string => {
  const types = { ...typedData.types }
  
  // remove EIP712Domain key from types as ethers will auto-gen it in
  // the hash encoder below
  delete types['EIP712Domain']

  return ethers.utils._TypedDataEncoder.hash(typedData.domain, types, typedData.message)
}

export const encodeTypedDataDigest = (typedData: TypedData): Uint8Array => {
  return ethers.utils.arrayify(encodeTypedDataHash(typedData))
}
