import { BigNumber, ContractFactory, Signer, ethers } from 'ethers'
import { UNIVERSAL_DEPLOYER_2_ADDRESS } from '../constants'

export const addressOf = async <T extends ContractFactory>(
	signer: Signer,
    contractFactory: new (signer: Signer) => T,
    contractInstance: number | BigNumber,
    ...args: Parameters<T['deploy']>
  ): Promise<string> => {
    const factory = new contractFactory(signer)
    const deployTx = await factory.getDeployTransaction(...args)
    const deployData = deployTx.data
  
    const codeHash = ethers.utils.keccak256(
      ethers.utils.solidityPack(['bytes'], [deployData])
    )

    const salt = ethers.utils.solidityPack(['uint256'], [contractInstance])

    const hash = ethers.utils.keccak256(
      ethers.utils.solidityPack(['bytes1', 'address', 'bytes32', 'bytes32'], ['0xff', UNIVERSAL_DEPLOYER_2_ADDRESS, salt, codeHash])
    )

    return ethers.utils.getAddress(ethers.utils.hexDataSlice(hash, 12))
  }
