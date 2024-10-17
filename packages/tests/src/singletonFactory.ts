import { ethers } from 'ethers'
import { Artifact } from './builds'
import { isContract } from './utils'

export const deployment = {
  tx: '0xf9016c8085174876e8008303c4d88080b90154608060405234801561001057600080fd5b50610134806100206000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c80634af63f0214602d575b600080fd5b60cf60048036036040811015604157600080fd5b810190602081018135640100000000811115605b57600080fd5b820183602082011115606c57600080fd5b80359060200191846001830284011164010000000083111715608d57600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600092019190915250929550509135925060eb915050565b604080516001600160a01b039092168252519081900360200190f35b6000818351602085016000f5939250505056fea26469706673582212206b44f8a82cb6b156bfcc3dc6aadd6df4eefd204bc928a4397fd15dacf6d5320564736f6c634300060200331b83247000822470',
  deployer: '0xBb6e024b9cFFACB947A71991E386681B1Cd1477D',
  funding: 24700000000000000n
}

export const address = '0xce0042B868300000d44A59004Da54A005ffdcf9f'

export const abi = [
  {
    constant: false,
    inputs: [
      {
        internalType: 'bytes',
        type: 'bytes'
      },
      {
        internalType: 'bytes32',
        type: 'bytes32'
      }
    ],
    name: 'deploy',
    outputs: [
      {
        internalType: 'address payable',
        type: 'address'
      }
    ],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  }
]

export async function mustExistEIP2470(signer: ethers.Signer): Promise<ethers.Contract> {
  const provider = signer.provider
  if (!provider) throw new Error('signer has no provider')

  if (!(await isContract(provider, address))) {
    const balanceDeployer = await provider.getBalance(deployment.deployer)
    if (balanceDeployer < deployment.funding) {
      await signer
        .sendTransaction({
          to: deployment.deployer,
          value: deployment.funding - balanceDeployer
        })
        .then(tx => tx.wait())
    }

    const res = await provider.broadcastTransaction(deployment.tx)
    await res.wait()

    if (!(await isContract(provider, address))) {
      throw new Error('EIP2470 deployment failed')
    }
  }

  return new ethers.Contract(address, abi, signer)
}

export async function deployContract(
  signer: ethers.Signer,
  artifact: Artifact,
  ...args: any[]
): Promise<[ethers.Contract, Promise<boolean>]> {
  const provider = signer.provider
  if (!provider) throw new Error('signer has no provider')

  const singletonFactory = await mustExistEIP2470(signer)

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode)

  const data = (await factory.getDeployTransaction(...args)).data

  if (!data) throw new Error('no deploy data')

  const address = ethers.getAddress(
    ethers.dataSlice(
      ethers.keccak256(
        ethers.solidityPacked(
          ['bytes1', 'address', 'bytes32', 'bytes32'],
          ['0xff', await singletonFactory.getAddress(), ethers.ZeroHash, ethers.keccak256(data)]
        )
      ),
      12
    )
  )

  if (await isContract(provider, address)) {
    return [new ethers.Contract(address, artifact.abi, signer), Promise.resolve(true)]
  }

  const maxGasLimit = await provider.getBlock('latest').then(b => (b?.gasLimit ? b.gasLimit / 2n : 0n))
  const tx = await singletonFactory.deploy(data, ethers.ZeroHash, { gasLimit: maxGasLimit })

  // if (!(await isContract(provider, address))) {
  //   throw new Error('contract deployment failed')
  // }
  const waitPromise = tx.wait().then(() => isContract(provider, address))

  return [new ethers.Contract(address, artifact.abi, signer), waitPromise]
}
