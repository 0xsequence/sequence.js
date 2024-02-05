import { newSECP256K1RandomSigner, newSECP256K1Signer } from "./secp256k1";
import { newSECP256R1Signer, newSECP256R1RandomSigner } from "./secp256r1";

export type PayloadSigner = {
  privateKey: string

  verifier(): Promise<string>
  signMessage(message: string | Uint8Array): Promise<string>
}

export async function newPayloadSigner(privateKey: string): Promise<PayloadSigner> {
  if (window.crypto !== undefined) {
    return newSECP256R1Signer(privateKey)
  } else {
    return newSECP256K1Signer(privateKey)
  }
}

export async function newRandomPayloadSigner(): Promise<PayloadSigner> {
  if (window.crypto !== undefined) {
    return newSECP256R1RandomSigner()
  } else {
    return newSECP256K1RandomSigner()
  }
}

export * from './secp256r1'
export * from './secp256k1'
