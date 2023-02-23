import { commons } from "@0xsequence/core"
import { migrator } from "@0xsequence/migration";
import { BigNumber, BigNumberish, ethers } from "ethers";
import { ConfigTracker, PresignedConfig, PresignedConfigLink } from "../tracker";

// This tracks wraps another tracker and dedupes calls to it, so in any calls
// are sent in short succession, only the first call is forwarded to the
// underlying tracker, and the rest are ignored.
export class DedupedTracker implements migrator.PresignedMigrationTracker, ConfigTracker {
  private readonly pending: Map<string, { promise: Promise<any>, time: number }> = new Map();

  constructor(
    private readonly tracker: migrator.PresignedMigrationTracker & ConfigTracker,
    public readonly window = 50,
    public verbose = false
  ) {}

  async dedupe<T, Y extends Array<any>>(key: string, fn: (...args: Y) => Promise<T>, ...args: Y): Promise<T> {
    this.clear()

    // TODO: Replace with a faster hash function
    const subkey = `${key}:${ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(args)))}`
    const now = Date.now()
    const pending = this.pending.get(subkey)

    if (pending && now - pending.time < this.window) {
      if (this.verbose) {
        console.log(`dedupe hit: ${subkey} -> found (${pending.time})`)
      }
      return pending.promise as Promise<T>
    }

    const promise = fn(...args)
    this.pending.set(subkey, { promise, time: now })
    return promise
  }

  clear() {
    // remove all pending calls past the window
    const now = Date.now()
    for (const [key, pending] of this.pending) {
      if (now - pending.time > this.window) {
        this.pending.delete(key)
      }
    }
  }

  configOfImageHash(args: { imageHash: string; }): Promise<commons.config.Config | undefined> {
    return this.dedupe('configOfImageHash', (args) => this.tracker.configOfImageHash(args), args)
  }

  getMigration(address: string, fromImageHash: string, fromVersion: number, chainId: BigNumberish): Promise<migrator.SignedMigration | undefined> {
    return this.dedupe('getMigration', (...args) => this.tracker.getMigration(...args), address, fromImageHash, fromVersion, chainId)
  }

  saveMigration(address: string, signed: migrator.SignedMigration, contexts: commons.context.VersionedContext): Promise<void> {
    return this.dedupe('saveMigration', (...args) => this.tracker.saveMigration(...args), address, signed, contexts)
  }

  loadPresignedConfiguration(args: { wallet: string; fromImageHash: string; longestPath?: boolean | undefined; }): Promise<PresignedConfigLink[]> {
    return this.dedupe('loadPresignedConfiguration', (args) => this.tracker.loadPresignedConfiguration(args), args)
  }

  savePresignedConfiguration(args: PresignedConfig): Promise<void> {
    return this.dedupe('savePresignedConfiguration', (args) => this.tracker.savePresignedConfiguration(args), args)
  }

  saveWitnesses(args: { wallet: string; digest: string; chainId: BigNumberish; signatures: string[]; }): Promise<void> {
    return this.dedupe('saveWitnesses', (args) => this.tracker.saveWitnesses(args), args)
  }

  saveWalletConfig(args: { config: commons.config.Config; }): Promise<void> {
    return this.dedupe('saveWalletConfig', (args) => this.tracker.saveWalletConfig(args), args)
  }

  imageHashOfCounterfactualWallet(args: { wallet: string; }): Promise<{ imageHash: string; context: commons.context.WalletContext; } | undefined> {
    return this.dedupe('imageHashOfCounterfactualWallet', (args) => this.tracker.imageHashOfCounterfactualWallet(args), args)
  }

  saveCounterfactualWallet(args: { config: commons.config.Config; context: commons.context.WalletContext[]; }): Promise<void> {
    return this.dedupe('saveCounterfactualWallet', (args) => this.tracker.saveCounterfactualWallet(args), args)
  }

  walletsOfSigner(args: { signer: string; }): Promise<{ wallet: string; proof: { digest: string; chainId: BigNumber; signature: string; }; }[]> {
    return this.dedupe('walletsOfSigner', (args) => this.tracker.walletsOfSigner(args), args)
  }
}
