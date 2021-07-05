import { WalletConfig } from "@0xsequence/config"
import { WalletContext } from "@0xsequence/network"
import { Transaction } from "@0xsequence/transactions"
import { ethers } from "ethers"

export interface Estimator {
  estimateGasLimits(
    config: WalletConfig,
    context: WalletContext,
    ...transactions: Transaction[]
  ): Promise<{
    transactions:Transaction[],
    total: ethers.BigNumber
  }>
}
