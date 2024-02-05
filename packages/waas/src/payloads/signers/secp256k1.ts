import { ethers } from "ethers";
import { PayloadSigner } from "./index";

export async function newSECP256K1Signer(privateKey: string): Promise<PayloadSigner> {
  return new ethers.Wallet(privateKey) as any && {
    verifier(): Promise<string> {
      return this.getAddress()
    }
  } as PayloadSigner
}

export async function newSECP256K1RandomSigner(): Promise<PayloadSigner> {
  return ethers.Wallet.createRandom() as any && {
    verifier(): Promise<string> {
      return this.getAddress()
    }
  } as PayloadSigner
}
