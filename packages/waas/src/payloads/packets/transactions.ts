import { ethers } from "ethers"
import { BasePacket } from ".."
import { useLifespan } from "./utils";

export type TransactionsPacket = BasePacket & {
  wallet: string;
  network: string;
  identifier: string;

  transactions: TransactionSubpacket[]
}

export type TransactionSubpacket =
  RawTransactionSubpacket |
  SendERC20Subpacket |
  SendERC721Subpacket |
  SendERC1155Subpacket |
  DelayedEncodeSubpacket


export type RawTransactionSubpacket = {
  type: 'transaction',
  to: string,
  value: string,
  data: string
}

export type SendERC20Subpacket = {
  type: 'erc20send',
  token: string,
  to: string,
  value: string
}

export type SendERC721Subpacket = {
  type: 'erc721send',
  token: string,
  to: string,
  id: string,
  safe?: boolean,
  data?: string
}

export type SendERC1155Subpacket = {
  type: 'erc1155send',
  token: string,
  to: string,
  vals: {
    id: string,
    amount: string
  }[],
  data?: string
}

export type DelayedEncodeData = {
  abi: string,
  func: string,
  args: (string | DelayedEncodeData)[] | { [key: string]: (string | DelayedEncodeData) }
}

export type DelayedEncodeSubpacket = {
  type: 'delayedEncode',
  to: string,
  value: string,
  data: DelayedEncodeData
}

export type SendTransactionsArgs = {
  transactions: ethers.providers.TransactionRequest[],
  chainId: number,
}

export type SendERC20Args = {
  chainId: number,
  token: string,
  to: string,
  value: ethers.BigNumberish,
}

export type SendERC721Args = {
  chainId: number,
  token: string,
  to: string,
  id: string,
  safe?: boolean,
  data?: string,
}

export type SendERC1155Args = {
  chainId: number,
  token: string,
  to: string,
  values: {
    id: string,
    amount: ethers.BigNumberish
  }[],
  data?: string,
}

export type SendDelayedEncodeArgs = {
  chainId: number,
  to: string,
  value: ethers.BigNumberish,
  abi: string,
  func: string,
  args: string[] | { [key: string]: string },
}

export function sendTransactions({
  wallet,
  transactions,
  chainId,
  lifespan,
  identifier
}: SendTransactionsArgs & {
  wallet: string,
  lifespan: number,
  identifier: string
}): TransactionsPacket {
  return {
    ...useLifespan(lifespan),
    identifier,
    code: 'sendTransaction',
    wallet,
    network: chainId.toString(),
    transactions: transactions.map(tx => {
      if (!tx.to || tx.to === ethers.constants.AddressZero) {
        throw new Error('Contract creation not supported')
      }

      return {
        type: 'transaction',
        to: tx.to,
        value: ethers.BigNumber.from(tx.value || 0).toHexString(),
        data: ethers.utils.hexlify(tx.data || [])
      }
    })
  }
}

export function sendERC20({
  wallet,
  token,
  to,
  value,
  chainId,
  lifespan,
  identifier
}: SendERC20Args & {
  wallet: string,
  lifespan: number,
  identifier: string
}): TransactionsPacket {
  return {
    ...useLifespan(lifespan),
    identifier,
    code: 'sendTransaction',
    wallet,
    network: chainId.toString(),
    transactions: [
      {
        type: 'erc20send',
        token,
        to,
        value: ethers.BigNumber.from(value).toString()
      }
    ]
  }
}

export function sendERC721({
  wallet,
  token,
  to,
  id,
  chainId,
  lifespan,
  identifier,
  safe,
  data
}: SendERC721Args & {
  wallet: string,
  lifespan: number,
  identifier: string,
}): TransactionsPacket {
  return {
    ...useLifespan(lifespan),
    identifier,
    code: 'sendTransaction',
    wallet,
    network: chainId.toString(),
    transactions: [
      {
        type: 'erc721send',
        token,
        to,
        id,
        safe,
        data
      }
    ]
  }
}

export function sendERC1155({
  wallet,
  token,
  to,
  values,
  chainId,
  lifespan,
  identifier,
  data
}: SendERC1155Args & {
  wallet: string,
  lifespan: number,
  identifier: string,
}): TransactionsPacket {
  return {
    ...useLifespan(lifespan),
    identifier,
    code: 'sendTransaction',
    wallet,
    network: chainId.toString(),
    transactions: [
      {
        type: 'erc1155send',
        token,
        to,
        vals: values.map(v => ({
          id: v.id,
          amount: ethers.BigNumber.from(v.amount).toString()
        })),
        data
      }
    ]
  }
}

export function sendDelayedEncode({
  wallet,
  to,
  value,
  abi,
  func,
  args,
  chainId,
  lifespan,
  identifier
}: SendDelayedEncodeArgs & {
  wallet: string,
  lifespan: number,
  identifier: string
}): TransactionsPacket {
  return {
    ...useLifespan(lifespan),
    identifier,
    code: 'sendTransaction',
    wallet,
    network: chainId.toString(),
    transactions: [
      {
        type: 'delayedEncode',
        to,
        value: ethers.BigNumber.from(value).toString(),
        data: {
          abi,
          func,
          args
        }
      }
    ]
  }
}

export function combinePackets(
  packets: TransactionsPacket[]
): TransactionsPacket {
  if (packets.length === 0) {
    throw new Error('No packets provided')
  }

  // Ensure that all packets are for the same network and wallet
  const network = packets[0].network
  const wallet = packets[0].wallet
  const lifespan = packets[0].expires - packets[0].issued
  const identifier = packets[0].identifier

  if (!packets.every(p => p.network === network)) {
    throw new Error('All packets must have the same chainId')
  }

  if (!packets.every(p => p.wallet === wallet)) {
    throw new Error('All packets must have the same wallet')
  }

  return {
    ...useLifespan(lifespan),
    identifier,
    code: 'sendTransaction',
    network,
    wallet,
    transactions: packets.reduce((acc, p) => acc.concat(p.transactions), [] as TransactionSubpacket[])
  }
}
