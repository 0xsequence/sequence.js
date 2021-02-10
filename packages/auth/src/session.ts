import { SequenceUtilsFinder, sortConfig, WalletConfig } from "@0xsequence/config"
import { NetworkConfig, WalletContext } from "@0xsequence/network"
import { Account } from "@0xsequence/wallet"
import { ethers, Signer } from "ethers"

export type Session = {
  config: WalletConfig
  context: WalletContext
}

export async function newSession(args: {
  context: WalletContext,
  networks: NetworkConfig[],
  referenceSigner: string,
  signers: { signer: Signer, weight: ethers.BigNumberish }[],
  thershold: ethers.BigNumberish,
  deepSearch?: boolean,
  knownConfigs?: WalletConfig[],
  noIndex?: boolean
}): Promise<Account> {
  const { context, networks, referenceSigner, signers, thershold, deepSearch, knownConfigs, noIndex } = args

  const authChain = networks.find((n) => n.isAuthChain)
  if (!authChain) throw Error('Auth chain not found')

  const authProvider = new ethers.providers.JsonRpcProvider(authChain.rpcUrl)
  const configFinder = new SequenceUtilsFinder(authProvider)

  const normalizedSigners = Promise.all(signers.map(async (s) => ({
    address: ethers.utils.getAddress(await s.signer.getAddress()),
    weight: ethers.BigNumber.from(s.weight).toNumber()
  })))

  const existingWallet = (await configFinder.findLastWalletOfInitialSigner({
    signer: referenceSigner,
    context: context,
    provider: authProvider,
    requireIndex: deepSearch ? false : true
  })).wallet

  if (existingWallet) {
    // Find prev configuration
    const config = (await configFinder.findCurrentConfig({
      address: existingWallet,
      provider: authProvider,
      context: context,
      knownConfigs
    })).config

    if (!config) throw Error('Wallet config not found')

    // Load prev account
    const account = new Account({
      initialConfig: config,
      networks: networks,
      context: context
    }, ...signers.map((s) => s.signer))

    // Generate and update configuration
    const prevConfigAddresses = config.signers.map((s) => ethers.utils.getAddress(s.address))

    const [newConfig, tx] = await account.updateConfig(
      sortConfig({
        address: config.address,
        threshold: ethers.BigNumber.from(thershold).toNumber(),
        signers: [
          ...config.signers,
          ...(await normalizedSigners).filter((s) => prevConfigAddresses.indexOf(s.address) === -1)
        ]
      }), noIndex ? false : true
    )

    // TODO: Maybe we can return the transaction
    // and let the wallet continue login without this tx confirmed?
    await tx.wait(2)

    return new Account({
      initialConfig: newConfig,
      networks: networks,
      context: context
    }, ...signers.map((s) => s.signer))
  }

  const config = sortConfig({
    threshold: ethers.BigNumber.from(thershold).toNumber(),
    signers: await normalizedSigners
  })

  const account = new Account({
    initialConfig: config,
    networks: networks,
    context: context
  }, ...signers.map((s) => s.signer))

  const tx = await account.publishConfig(noIndex ? false : true)

  // TODO: Same here, maybe return pending tx
  await tx.wait(2)

  return account
}

export function dumpSession(account: Account): Session {
  return {
    config: { ...account.mainWallet().wallet.config, address: account.address },
    context: account.mainWallet().wallet.context
  }
}

export function loadSession(args: {
  dump: Session,
  signers: Signer[],
  networks: NetworkConfig[]
}) {
  const { dump, signers, networks } = args
 
  return new Account({
    initialConfig: dump.config,
    context: dump.context,
    networks: networks
  }, ...signers)
}
