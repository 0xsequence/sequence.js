import { sequenceTxAbiEncode, Transaction } from '@0xsequence/transactions'
import { Interface } from '@ethersproject/abi'
import { BigNumber } from '@ethersproject/bignumber'
import { BlockTag, JsonRpcProvider } from '@ethersproject/providers'
import { gethCall } from './geth-call'

const simulatorArtifact = require('@0xsequence/wallet-contracts/artifacts/contracts/modules/MainModuleGasEstimation.sol/MainModuleGasEstimation.json')
const simulatorInterface = new Interface(simulatorArtifact.abi)
const simulatorBytecode = simulatorArtifact.deployedBytecode

export async function simulate(
  provider: JsonRpcProvider,
  wallet: string,
  transactions: Transaction[],
  block?: BlockTag
): Promise<Result[]> {
  const encodedTransactions = sequenceTxAbiEncode(transactions)
  const data = simulatorInterface.encodeFunctionData('simulateExecute', [encodedTransactions])
  const transaction = { to: wallet, data }
  const overrides = { [wallet]: { code: simulatorBytecode } }
  const result = await gethCall(provider, transaction, block, overrides)
  return simulatorInterface.decodeFunctionResult('simulateExecute', result)[0]
}

export interface Result {
  executed: boolean
  succeeded: boolean
  result: string
  gasUsed: BigNumber
}
