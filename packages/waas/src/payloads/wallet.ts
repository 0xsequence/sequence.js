import { ethers } from "ethers"

export type TransactionsPayload = {
  wallet: string;
  chainId: number;

  transaction: ethers.providers.TransactionRequest[];

  signer: {
    address: string;
    signature: string;
  }
}

export function hashTransactionsPayload(wallet: string, transactions: ethers.providers.TransactionRequest[], chainId: number): string {
  const txHashes = transactions.map(transaction => 
    ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['address', 'uint256', 'bytes', 'uint256'],
        [transaction.to, transaction.value, transaction.data]
      )
    )
  )

  const preimage = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['bytes32[]'],
      [[
        ethers.utils.defaultAbiCoder.encode(['uint256'], [chainId]),
        ethers.utils.defaultAbiCoder.encode(['address'], [wallet]),
        ...txHashes
      ]]
    )
  )

  return preimage
}

export async function sendTransactions(
  signer: ethers.Wallet,
  wallet: string,
  transactions: ethers.providers.TransactionRequest[],
  chainId: number
): Promise<TransactionsPayload> {
  const hash = hashTransactionsPayload(wallet, transactions, chainId)
  const signature = await signer.signMessage(ethers.utils.arrayify(hash))

  return {
    wallet,
    chainId,

    transaction: transactions,

    signer: {
      address: signer.address,
      signature
    }
  }
}
