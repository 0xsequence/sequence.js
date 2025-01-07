import { ethers } from 'ethers'
import { v2 } from '../builds'
import { deployContract } from '../singletonFactory'
import { v2 as coreV2 } from '@0xsequence/core'

export async function deployV2Context(signer: ethers.Signer): Promise<coreV2.context.WalletContext> {
  const { chainId } = await signer.provider!.getNetwork()
  console.log(`[${chainId}] [v2]: Deploying context...`)

  // See if signer's provider has the contracts already deployed

  const deploymentResults: boolean[][] = []

  const [factory, waitForFactoryDeployment] = await deployContract(signer, v2.factory)
  const [mainModuleUpgradable, waitForMainModuleUpgradable] = await deployContract(signer, v2.mainModuleUpgradable)

  deploymentResults.push(await Promise.all([waitForFactoryDeployment, waitForMainModuleUpgradable]))

  const [mainModule, waitForMainModule] = await deployContract(
    signer,
    v2.mainModule,
    await factory.getAddress(),
    await mainModuleUpgradable.getAddress()
  )

  deploymentResults.push(await Promise.all([waitForMainModule]))

  const [guestModule, waitForGuestModule] = await deployContract(signer, v2.guestModule)
  const [universalSigValidator, waitForUniversalSigValidator] = await deployContract(signer, v2.universalSigValidator)

  deploymentResults.push(await Promise.all([waitForGuestModule, waitForUniversalSigValidator]))

  if (deploymentResults.flat().some(r => !r)) {
    throw new Error('Failed to deploy V2 context!')
  }

  return {
    version: 2,

    factory: await factory.getAddress(),
    mainModule: await mainModule.getAddress(),
    mainModuleUpgradable: await mainModuleUpgradable.getAddress(),
    guestModule: await guestModule.getAddress(),
    universalSigValidator: await universalSigValidator.getAddress(),

    walletCreationCode: '0x603a600e3d39601a805130553df3363d3d373d3d3d363d30545af43d82803e903d91601857fd5bf3',
    proxyImplementationHook: '0x1f56dbAD5e8319F0DE9a323E24A31b5077dEB1a4'
  }
}
