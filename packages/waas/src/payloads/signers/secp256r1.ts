import { ethers } from "ethers";
import { PayloadSigner } from "./index";

export async function newSECP256R1Signer(privateKey: string): Promise<PayloadSigner> {
  const [pubKey, privKey] = await loadSECP256R1Keys(privateKey)

  const exPrivateKey = await window.crypto.subtle.exportKey('jwk', privKey)
  const exPublicKey = await window.crypto.subtle.exportKey('jwk', pubKey)
  const keys = [exPublicKey, exPrivateKey]

  const encoder = new TextEncoder()
  return {
    privateKey: ethers.utils.hexlify(encoder.encode(JSON.stringify(keys))),
    verifier: async () => {
      const pubRaw = await window.crypto.subtle.exportKey('raw', pubKey)
      return 'r1:'+ethers.utils.hexlify(new Uint8Array(pubRaw))
    },
    signMessage: async (message: string | Uint8Array) => {
      if (typeof message === 'string') {
        if (message.startsWith('0x')) {
          message = message.slice(2)
          message = ethers.utils.arrayify(message)
        } else {
          message = encoder.encode(message)
        }
      }
      const signatureBuff = await window.crypto.subtle.sign({name: 'ECDSA', hash: {name: 'SHA-256'}}, privKey, message)
      return 'r1:'+ethers.utils.hexlify(new Uint8Array(signatureBuff))
    }
  }
}

export async function newSECP256R1RandomSigner(): Promise<PayloadSigner> {
  const generatedKeys = await window.crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"],
  )

  const exPrivateKey = await window.crypto.subtle.exportKey('jwk', generatedKeys.privateKey)
  const exPublicKey = await window.crypto.subtle.exportKey('jwk', generatedKeys.publicKey)
  const keys = [exPublicKey, exPrivateKey]

  const encoder = new TextEncoder()
  const privateKey = ethers.utils.hexlify(encoder.encode(JSON.stringify(keys)))

  return newSECP256R1Signer(privateKey)
}
async function loadSECP256R1Keys(privateKey: string): Promise<CryptoKey[]> {
  const decoder = new TextDecoder()
  const privateKeyBytes = ethers.utils.arrayify(privateKey)
  const keysFromJson = JSON.parse(decoder.decode(privateKeyBytes))

  const pubKey = await window.crypto.subtle.importKey('jwk', keysFromJson[0], {name: 'ECDSA', namedCurve: 'P-256'}, true, ['verify'])
  const privKey = await window.crypto.subtle.importKey('jwk', keysFromJson[1], {name: 'ECDSA', namedCurve: 'P-256'}, true, ['sign'])
  return [pubKey, privKey]
}

