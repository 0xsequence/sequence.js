import { commons as v2commons } from '@0xsequence/v2core'
import { Signers as V3Signers } from '@0xsequence/wallet-core'
import { Context as V3Context } from '@0xsequence/wallet-primitives'
import { ethers } from 'ethers'
import { Address, Hex, Provider, Secp256k1 } from 'ox'

export type MultiSigner = {
  pk: Hex.Hex
  address: Address.Address
  v2: ethers.Signer
  v3: V3Signers.Pk.Pk
}

export const createMultiSigner = (pk: Hex.Hex, provider: ethers.Provider): MultiSigner => {
  const v2Signer = new ethers.Wallet(pk, provider)
  // Override the v2.getAddress() to return the address lower cased for v1 Orchestrator compatibility
  const v2: any = v2Signer
  v2.getAddress = async () => {
    return v2Signer.address.toLowerCase()
  }
  return {
    pk,
    address: Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey: pk })),
    v2,
    v3: new V3Signers.Pk.Pk(pk),
  }
}

export const createAnvilSigner = async (
  v2Provider: ethers.Provider,
  v3Provider: Provider.Provider,
): Promise<MultiSigner> => {
  const anvilSigner = createMultiSigner(Secp256k1.randomPrivateKey(), v2Provider)
  await v3Provider.request({
    method: 'anvil_impersonateAccount',
    params: [anvilSigner.address],
  })
  await v3Provider.request({
    method: 'anvil_setBalance',
    params: [anvilSigner.address, '0x1000000000000000000000000000000000000000'],
  })
  return anvilSigner
}

export const convertV2ContextToV3Context = (context: v2commons.context.WalletContext): V3Context.Context => {
  Hex.assert(context.walletCreationCode)
  return {
    // Close enough
    factory: Address.from(context.factory),
    stage1: Address.from(context.mainModule),
    stage2: Address.from(context.mainModuleUpgradable),
    creationCode: context.walletCreationCode,
  }
}
