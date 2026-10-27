import { Envelope, Wallet as CoreWallet } from '@0xsequence/wallet-core'
import { Constants, Payload, Signature } from '@0xsequence/wallet-primitives'
import { AbiFunction, Address, Bytes, Hash, Hex } from 'ox'
import { Shared } from './manager.js'
import { Actions } from './types/signature-request.js'

/**
 * Nonce space of guard settlement transactions: the low 160 bits of keccak256("sequence.guard-settlement").
 * A dedicated space keeps the settlement independent from the wallet's regular transactions,
 * and nonce 0 makes it valid exactly once per chain.
 */
export const GuardSettlementSpace = Hex.toBigInt(
  Hex.slice(Hash.keccak256(Hex.fromString('sequence.guard-settlement')), 12),
)

/**
 * A signed, chain-agnostic transaction that writes the wallet's configuration on-chain.
 *
 * After a wallet moves to a new guard, its previous configuration (with the old guard) stays valid on every chain
 * where the on-chain configuration is older. Relaying this transaction on a chain closes that gap there.
 * The relayer builds the chain-specific transaction with `Wallet.buildTransaction(provider, envelope)`,
 * which prepends the configuration updates needed on that chain (and deploys the wallet if needed).
 */
export type GuardSettlement = {
  wallet: Address.Address
  imageHash: Hex.Hex
  envelope: Envelope.Signed<Payload.Calls>
  // No-chain-id signature of the settlement payload by the target configuration, without the configuration updates
  signature: Hex.Hex
}

export function guardSettlementPayload(wallet: Address.Address, imageHash: Hex.Hex, nonce = 0n): Payload.Calls {
  return {
    type: 'call',
    space: GuardSettlementSpace,
    nonce,
    calls: [
      {
        to: wallet,
        value: 0n,
        data: AbiFunction.encodeData(Constants.UPDATE_IMAGE_HASH, [imageHash]),
        gasLimit: 0n,
        delegateCall: false,
        onlyFallback: false,
        behaviorOnError: 'revert',
      },
    ],
  }
}

export class GuardSettlements {
  constructor(private readonly shared: Shared) {}

  /**
   * Requests the signatures for a settlement of the wallet's latest configuration.
   * Signed by a device and by the guard of that configuration (the new guard after a migration).
   *
   * @returns The signature request id, or undefined if the wallet has no guard.
   */
  async request(wallet: Address.Address, origin?: string): Promise<string | undefined> {
    if (await this.shared.modules.wallets.needsGuardMigration(wallet)) {
      throw new Error('guard-migration-pending')
    }

    const coreWallet = new CoreWallet(wallet, {
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })
    const status = await coreWallet.getStatus()

    const { guardTopology } = await this.shared.modules.wallets.getConfigurationParts(wallet)
    if (!guardTopology) {
      return undefined
    }

    const envelope: Envelope.Envelope<Payload.Calls> = {
      wallet,
      chainId: 0,
      configuration: status.configuration,
      payload: guardSettlementPayload(wallet, status.imageHash),
    }

    return this.shared.modules.signatures.request(envelope, Actions.GuardSettlement, { origin })
  }

  /**
   * Completes a signed settlement request and saves it with the state provider (the key machine) for relaying.
   */
  async complete(requestId: string): Promise<GuardSettlement> {
    const request = await this.shared.modules.signatures.get(requestId)
    if (request.action !== Actions.GuardSettlement || !Payload.isCalls(request.envelope.payload)) {
      throw new Error('invalid-request-action')
    }

    const envelope = request.envelope as Envelope.Signed<Payload.Calls>
    if (!Envelope.reachedThreshold(envelope)) {
      throw new Error('insufficient-weight')
    }

    const [imageHash] = AbiFunction.decodeData(Constants.UPDATE_IMAGE_HASH, envelope.payload.calls[0]!.data)
    const settlement: GuardSettlement = {
      wallet: envelope.wallet,
      imageHash,
      envelope,
      signature: Bytes.toHex(Signature.encodeSignature(Envelope.encodeSignature(envelope))),
    }

    const stateProvider = this.shared.sequence.stateProvider
    if (!stateProvider.saveGuardSettlement) {
      throw new Error('state provider does not support guard settlements')
    }
    await stateProvider.saveGuardSettlement(settlement.wallet, settlement.envelope.payload, settlement.signature)
    await this.shared.modules.signatures.complete(requestId)

    return settlement
  }
}
