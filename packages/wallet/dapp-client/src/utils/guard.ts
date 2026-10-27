import { Config } from '@0xsequence/wallet-primitives'
import { Address } from 'ox'

function findModuleGuardLeaf(topology: Config.Topology, moduleAddress: Address.Address): Config.Topology | undefined {
  if (Config.isNode(topology)) {
    return findModuleGuardLeaf(topology[0], moduleAddress) ?? findModuleGuardLeaf(topology[1], moduleAddress)
  }

  if (Config.isNestedLeaf(topology)) {
    // Modules with a guard are nested leaves of the form [module sapient leaf, guard leaf]
    if (
      Config.isNode(topology.tree) &&
      Config.isSapientSignerLeaf(topology.tree[0]) &&
      Address.isEqual(topology.tree[0].address, moduleAddress)
    ) {
      return topology.tree[1]
    }
    return findModuleGuardLeaf(topology.tree, moduleAddress)
  }

  return undefined
}

/**
 * Returns the guard addresses to ask for a co-signature of a module (e.g. sessions) signature.
 *
 * The guard address cached when the dapp connected is used as long as the wallet configuration still
 * references it. Once the wallet has moved to a new guard (guard rotation), the cached address is stale,
 * so the signers of the module's guard leaf in the current configuration are returned instead, in order.
 */
export function getModuleGuardCandidates(
  configuration: Config.Config,
  moduleAddress: Address.Address,
  cachedGuard?: Address.Address,
): Address.Address[] {
  const guardLeaf = findModuleGuardLeaf(configuration.topology, moduleAddress)
  if (!guardLeaf) {
    return cachedGuard ? [cachedGuard] : []
  }

  const signers = Config.getSigners(guardLeaf).signers
  if (cachedGuard && signers.some((signer) => Address.isEqual(signer, cachedGuard))) {
    return [cachedGuard]
  }

  return signers
}
