import { ethers } from "ethers";

export type Signer = {
  privateKey: string

  getAddress(): Promise<string>
  signMessage(message: string): Promise<string>
}

export async function createSigner(privateKey: string): Promise<Signer> {
  if (window.crypto !== undefined) {
    const wrappingKey = await window.crypto.subtle.importKey("raw", window.crypto.getRandomValues(new Uint8Array(16)), "AES-GCM", false, ["wrapKey", "unwrapKey"])
    const wrappedKey = await window.crypto.subtle.unwrapKey("jwk", privateKey, wrappingKey, {name:"AES-GCM", iv: new Uint8Array(16)});

    return {
      privateKey: ethers.utils.hexlify(Array.from(new Uint8Array(wrappedKey))),
      getAddress: async () => {
        return ""
      },
      signMessage: async (message: string) => {
        return ""
      }
    }
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

    //const enc = new TextEncoder();
    //const encoded = enc.encode("test message");
    const enc = new TextEncoder();
    const deriveKey = await window.crypto.subtle.importKey(
      "raw",
      enc.encode("password"),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"],
    );

    const wrappingKey = await window.crypto.subtle.importKey("raw", window.crypto.getRandomValues(new Uint8Array(16)), "AES-GCM", false, ["wrapKey", "unwrapKey"])
    const wrappedKey = await window.crypto.subtle.wrapKey("jwk", privateKey.privateKey, wrappingKey, {name:"AES-GCM", iv: new Uint8Array(16)});

    return {
      privateKey: ethers.utils.hexlify(Array.from(new Uint8Array(wrappedKey))),
      getAddress: async () => {
        // todo: calc address
        return ""
      },
      signMessage: async (message: string) => {
        // todo: sign message
        return ""
      }
    }
  } else {
    return ethers.Wallet.createRandom() as Signer
  }
}
