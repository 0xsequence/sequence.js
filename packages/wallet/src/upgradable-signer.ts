import { ChainIdLike } from "@0xsequence/network"
import { Signer } from "."

export abstract class UpgradableSigner extends Signer {
  abstract isSettled(chainId?: ChainIdLike): Promise<boolean>
}

export function isUpgradableSigner(cand: UpgradableSigner | Signer): cand is UpgradableSigner {
  return (cand as UpgradableSigner).isSettled !== undefined
}
