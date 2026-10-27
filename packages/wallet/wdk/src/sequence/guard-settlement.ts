import { Envelope, Wallet as CoreWallet } from '@0xsequence/wallet-core'
import { Constants, Network, Payload } from '@0xsequence/wallet-primitives'
import { AbiFunction, Address, Hash, Hex, Provider, RpcTransport } from 'ox'
import { Shared } from './manager.js'
import { Actions } from './types/signature-request.js'

const GuardSettlementTag = Hex.fromString('sequence.guard-settlement')

/**
 * Nonce space of the settlement of a configuration: the low 160 bits of
 * keccak256("sequence.guard-settlement" ‖ imageHash). Each configuration has its own space and the settlement uses
 * nonce 0, so it is valid once per chain and settlements of successive configurations never collide.
 */
export function guardSettlementSpace(imageHash: Hex.Hex): bigint {
  return Hex.toBigInt(Hex.slice(Hash.keccak256(Hex.concat(GuardSettlementTag, imageHash)), 12))
}

/**
 * A transaction that writes the configuration `imageHash` on-chain. It is signed without a chain id, so the same
 * signature settles every chain.
 */
export function guardSettlementPayload(wallet: Address.Address, imageHash: Hex.Hex): Payload.Calls {
  return {
    type: 'call',
    space: guardSettlementSpace(imageHash),
    nonce: 0n,
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

export type GuardSettlementResult = {
  chainId: number
  opHash?: Hex.Hex
  error?: string
}

/**
 * After a wallet moves to a new guard, its previous configuration (with the old guard) stays valid on every chain
 * where the on-chain configuration is older. Settlements write the latest configuration on those chains.
 *
 * Nothing is stored: every run checks which chains still need it, so a failed send is retried the next time.
 */
export class GuardSettlements {
  constructor(private readonly shared: Shared) {}

  /**
   * Chains where the wallet is deployed or holds native funds, and whose on-chain (or counterfactual) configuration
   * is older than the latest one and still names a rotated-out guard.
   */
  async chainsToSettle(wallet: Address.Address): Promise<Network.Network[]> {
    const coreWallet = new CoreWallet(wallet, {
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })

    const results = await Promise.all(
      this.shared.sequence.networks.map(async (network) => {
        try {
          const provider = Provider.from(RpcTransport.fromHttp(network.rpcUrl))
          const status = await coreWallet.getStatus(provider)
          if (Hex.isEqual(status.onChainImageHash, status.imageHash)) {
            return undefined
          }

          if (!status.isDeployed) {
            const balance = await provider.request({ method: 'eth_getBalance', params: [wallet, 'latest'] })
            if (Hex.toBigInt(balance) === 0n) {
              return undefined
            }
          }

          const onChainConfiguration = await this.shared.sequence.stateProvider.getConfiguration(
            status.onChainImageHash,
          )
          // If the on-chain configuration is unknown, settle anyway
          if (onChainConfiguration && !this.shared.modules.wallets.referencesLegacyGuard(onChainConfiguration)) {
            return undefined
          }

          return network
        } catch (error) {
          this.shared.modules.logger.log(`Failed to check guard settlement on chain ${network.chainId}`, error)
          return undefined
        }
      }),
    )

    return results.filter((network) => network !== undefined)
  }

  /**
   * Requests the signatures for the settlement of the wallet's latest configuration, if any chain needs it.
   * Signed by a device and by the guard of that configuration.
   *
   * @returns The signature request id, or undefined if no chain needs a settlement.
   */
  async request(wallet: Address.Address, origin?: string): Promise<string | undefined> {
    if (await this.shared.modules.wallets.needsGuardMigration(wallet)) {
      throw new Error('guard-migration-pending')
    }

    const { guardTopology } = await this.shared.modules.wallets.getConfigurationParts(wallet)
    if (!guardTopology) {
      return undefined
    }

    if ((await this.chainsToSettle(wallet)).length === 0) {
      return undefined
    }

    const coreWallet = new CoreWallet(wallet, {
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })
    const status = await coreWallet.getStatus()
    const payload = guardSettlementPayload(wallet, status.imageHash)

    // Reuse a pending request for the same configuration
    const pending = (await this.shared.modules.signatures.list()).find(
      (request) =>
        request.action === Actions.GuardSettlement &&
        request.status === 'pending' &&
        Address.isEqual(request.wallet, wallet) &&
        Payload.isCalls(request.envelope.payload) &&
        request.envelope.payload.space === payload.space,
    )
    if (pending) {
      return pending.id
    }

    const envelope: Envelope.Envelope<Payload.Calls> = {
      wallet,
      chainId: 0,
      configuration: status.configuration,
      payload,
    }

    return this.shared.modules.signatures.request(envelope, Actions.GuardSettlement, { origin })
  }

  /**
   * Sends a signed settlement through the relayer to every chain that still needs it.
   * Failures are returned per chain; the next `request` retries them.
   */
  async complete(requestId: string): Promise<GuardSettlementResult[]> {
    const request = await this.shared.modules.signatures.get(requestId)
    if (request.action !== Actions.GuardSettlement || !Payload.isCalls(request.envelope.payload)) {
      throw new Error('invalid-request-action')
    }

    const envelope = request.envelope as Envelope.Signed<Payload.Calls>
    if (!Envelope.reachedThreshold(envelope)) {
      throw new Error('insufficient-weight')
    }

    const coreWallet = new CoreWallet(envelope.wallet, {
      stateProvider: this.shared.sequence.stateProvider,
      guest: this.shared.sequence.guest,
    })

    const results: GuardSettlementResult[] = []
    for (const network of await this.chainsToSettle(envelope.wallet)) {
      try {
        const provider = Provider.from(RpcTransport.fromHttp(network.rpcUrl))
        const transaction = await coreWallet.buildTransaction(provider, envelope)
        results.push({ chainId: network.chainId, opHash: await this.relay(envelope.wallet, network, transaction) })
      } catch (error) {
        this.shared.modules.logger.log(`Failed to settle guard on chain ${network.chainId}`, error)
        results.push({ chainId: network.chainId, error: error instanceof Error ? error.message : String(error) })
      }
    }

    await this.shared.modules.signatures.complete(requestId)
    return results
  }

  private async relay(
    wallet: Address.Address,
    network: Network.Network,
    transaction: { to: Address.Address; data: Hex.Hex },
  ): Promise<Hex.Hex> {
    let lastError: unknown = new Error(`no relayer available for chain ${network.chainId}`)

    for (const relayer of this.shared.sequence.relayers) {
      try {
        if (!(await relayer.isAvailable(wallet, network.chainId))) {
          continue
        }
        // The settlement can't pay a fee (its calls are fixed by the signature), so the relay must be sponsored
        const { quote } = await relayer.feeOptions(wallet, network.chainId, transaction.to, [], transaction.data)
        const { opHash } = await relayer.relay(transaction.to, transaction.data, network.chainId, quote)
        return opHash
      } catch (error) {
        lastError = error
      }
    }

    throw lastError
  }
}
