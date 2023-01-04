
import { ethers } from 'ethers'
import { walletContracts } from '@0xsequence/abi'
import { commons } from '..'


export type AddressMember = {
  weight: ethers.BigNumberish,
  address: string,
  signature?: string
}

export type WalletConfig = commons.config.Config & {
  threshold: ethers.BigNumberish,
  signers: AddressMember[]
}

export const ConfigCoder: commons.config.ConfigCoder<WalletConfig> = {
  isWalletConfig: (config: commons.config.Config): config is WalletConfig => {
    return (
      config.version === 1 &&
      (config as WalletConfig).threshold !== undefined &&
      (config as WalletConfig).signers !== undefined
    )
  },

  imageHashOf: (config: WalletConfig): string => {
    return config.signers.reduce(
      (imageHash, signer) => ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['bytes32', 'uint8', 'address'],
          [imageHash, signer.weight, signer.address]
        )
      ),
      ethers.utils.solidityPack(['uint256'], [config.threshold])
    )
  },

  hasSubdigest: (_walletConfig: WalletConfig, _subdigest: string): boolean => {
    // v1 does not support explicit subdigests
    return false
  },

  checkpointOf: (_config: WalletConfig): ethers.BigNumber => {
    return ethers.BigNumber.from(0)
  },

  signersOf: (config: WalletConfig): string[] => {
    return config.signers.map((signer) => signer.address)
  },

  fromSimple: (config: {
    threshold: ethers.BigNumberish
    checkpoint: ethers.BigNumberish
    signers: { address: string; weight: ethers.BigNumberish} []
  }): WalletConfig => {
    if (!ethers.constants.Zero.eq(config.checkpoint)) {
      throw new Error('v1 wallet config does not support checkpoint')
    }

    return {
      version: 1,
      threshold: config.threshold,
      signers: config.signers
    }
  },

  update: {
    isKindUsed: true,

    buildTransaction: (
      wallet: string,
      config: WalletConfig,
      context: commons.context.WalletContext,
      kind?: 'first' | 'later' | undefined
    ): commons.transaction.TransactionBundle => {
      const module = new ethers.utils.Interface([
        ...walletContracts.mainModule.abi,
        ...walletContracts.mainModuleUpgradable.abi
      ])

      const transactions: commons.transaction.Transaction[] = []

      if (!kind || kind === 'first') {
        transactions.push({
          to: wallet,
          data: module.encodeFunctionData(module.getFunction('updateImplementation'), [
            context.mainModuleUpgradable
          ]),
          gasLimit: 0,
          delegateCall: false,
          revertOnError: true,
          value: 0
        })
      }

      transactions.push({
        to: wallet,
        data: module.encodeFunctionData(module.getFunction('updateImageHash'), [
          ConfigCoder.imageHashOf(config)
        ]),
        gasLimit: 0,
        delegateCall: false,
        revertOnError: true,
        value: 0
      })

      return {
        entrypoint: wallet,
        transactions
      }
    },
    decodeTransaction: function (tx: commons.transaction.TransactionBundle): { address: string; newImageHash: string; kind: "first" | "later" | undefined}  {
      throw new Error("Function not implemented.")
    }
  },

  toJSON: function (config: WalletConfig): string {
    const plainMembers = config.signers.map((signer) => {
      return {
        weight: ethers.BigNumber.from(signer.weight).toString(),
        address: signer.address
      }
    })

    return JSON.stringify({
      version: config.version,
      threshold: ethers.BigNumber.from(config.threshold).toString(),
      signers: plainMembers
    })
  },

  fromJSON: function (json: string): WalletConfig {
    const parsed = JSON.parse(json)

    const signers = parsed.signers.map((signer: any) => {
      return {
        weight: ethers.BigNumber.from(signer.weight),
        address: signer.address
      }
    })

    return {
      version: parsed.version,
      threshold: ethers.BigNumber.from(parsed.threshold),
      signers
    }
  },

  editConfig: function (
    config: WalletConfig,
    action: {
      add?: commons.config.SimpleSigner[];
      remove?: string[];
      threshold?: ethers.BigNumberish,
      checkpoint?: ethers.BigNumberish
    }
  ): WalletConfig {
    const newSigners = config.signers.slice()

    if (action.checkpoint && !ethers.constants.Zero.eq(action.checkpoint)) {
      throw new Error('v1 wallet config does not support checkpoint')
    }

    if (action.add) {
      for (const signer of action.add) {
        if (newSigners.find((s) => s.address === signer.address)) {
          continue
        }

        newSigners.push({
          weight: signer.weight,
          address: signer.address
        })
      }
    }

    if (action.remove) {
      for (const address of action.remove) {
        const index = newSigners.findIndex((signer) => signer.address === address)
        if (index >= 0) {
          newSigners.splice(index, 1)
        }
      }
    }

    return {
      version: config.version,
      threshold: action.threshold ?? config.threshold,
      signers: newSigners
    }
  }
}
