import { base64Encode } from "@0xsequence/utils";
import { ethers } from "ethers";

export type Signer = {
  privateKey: string

  getAddress(): Promise<string>
  signMessage(message: string | Uint8Array): Promise<string>
}

export async function createSigner(privateKey: string): Promise<Signer> {
  const [pubKey, privKey] = await loadKeys(privateKey)

  if (window.crypto !== undefined) {
    return newSigner(pubKey, privKey)
  } else {
    return new ethers.Wallet(privateKey) as Signer
  }
}

export async function createRandomSigner(): Promise<Signer> {
  if (window.crypto !== undefined) {
    const privateKey = await window.crypto.subtle.generateKey(
      {
        name: "ECDSA",
        namedCurve: "P-256",
      },
      true,
      ["sign", "verify"],
    )

    return newSigner(privateKey.publicKey, privateKey.privateKey)
  } else {
    return ethers.Wallet.createRandom() as Signer
  }
}

async function newSigner(publicKey: CryptoKey, privateKey: CryptoKey): Promise<Signer> {
  const exPrivateKey = await window.crypto.subtle.exportKey('jwk', privateKey)
  const exPublicKey = await window.crypto.subtle.exportKey('jwk', publicKey)
  const keys = [exPublicKey, exPrivateKey]

  // todo: encrypt keys

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  return {
    privateKey: ethers.utils.hexlify(encoder.encode(JSON.stringify(keys))),
    getAddress: async () => {
      const pubRaw = await window.crypto.subtle.exportKey('raw', publicKey)
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
      const signatureBuff = await window.crypto.subtle.sign({name: 'ECDSA', hash: {name: 'SHA-256'}}, privateKey, message)
      return 'r1:'+ethers.utils.hexlify(new Uint8Array(signatureBuff))
    }
  }
}

async function loadKeys(privateKey: string): Promise<CryptoKey[]> {
  const decoder = new TextDecoder()
  const privateKeyBytes = ethers.utils.arrayify(privateKey)
  const keysFromJson = JSON.parse(decoder.decode(privateKeyBytes))

  const pubKey = await window.crypto.subtle.importKey('jwk', keysFromJson[0], {name: 'ECDSA', namedCurve: 'P-256'}, true, ['verify'])
  const privKey = await window.crypto.subtle.importKey('jwk', keysFromJson[1], {name: 'ECDSA', namedCurve: 'P-256'}, true, ['sign'])
  return [pubKey, privKey]
}
