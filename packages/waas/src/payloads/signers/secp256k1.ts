import { ethers } from "ethers";
import { SessionSigner } from "./index";

export async function newSECP256K1Signer(privateKey: string): Promise<SessionSigner> {
  return new ethers.Wallet(privateKey) as any && {
    publicKey(): Promise<string> {
      return this.getAddress()
    }
  } as SessionSigner
}

export async function newSECP256K1RandomSigner(): Promise<SessionSigner> {
  return ethers.Wallet.createRandom() as any && {
    publicKey(): Promise<string> {
      return this.getAddress()
    }
  } as SessionSigner
}
