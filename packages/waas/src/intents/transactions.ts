import {Intent, makeIntent} from "./base";
import {
    IntentDataSendTransaction,
    TransactionERC1155,
    TransactionERC20,
    TransactionERC721,
    TransactionRaw
} from "../clients/intent.gen";
import {ethers} from "ethers";

interface BaseArgs {
    lifespan: number,
    wallet: string,
    identifier: string,
    chainId: number,
}

export type SendTransactionsArgs = BaseArgs & {
    transactions: Transaction[],
}

export function sendTransactions({
    lifespan,
    wallet,
    identifier,
    chainId,
    transactions,
}: SendTransactionsArgs): Intent<IntentDataSendTransaction> {
    return makeIntent('sendTransaction', lifespan, {
        identifier,
        wallet,
        network: chainId.toString(),
        transactions: transactions.map(tx => {
            if (!tx.to || tx.to === ethers.constants.AddressZero) {
                throw new Error('Contract creation not supported')
            }

            if (!isEthersTx(tx)) {
                return tx
            }

            return {
                type: 'transaction',
                to: tx.to,
                value: ethers.BigNumber.from(tx.value || 0).toHexString(),
                data: ethers.utils.hexlify(tx.data || [])
            }
        })
    })
}

export type SendERC20Args = BaseArgs & Omit<TransactionERC20, 'type'>

export function sendERC20({
    tokenAddress, to, value,
    ...args
}: SendERC20Args): Intent<IntentDataSendTransaction> {
    return sendTransactions({
        transactions: [erc20({ tokenAddress, to, value })],
        ...args
    })
}

export type SendERC721Args = BaseArgs & Omit<TransactionERC721, 'type'>

export function sendERC721({
    tokenAddress, to, id, safe, data,
    ...args
}: SendERC721Args): Intent<IntentDataSendTransaction> {
    return sendTransactions({
        transactions: [erc721({ tokenAddress, to, id, data, safe })],
        ...args
    })
}

type ERC1155Args = Omit<TransactionERC1155, 'type'|'vals'> & { values: { id: string, amount: ethers.BigNumberish }[] }
export type SendERC1155Args = BaseArgs & ERC1155Args

export function sendERC1155({
    tokenAddress, to, values, data,
    ...args
}: SendERC1155Args): Intent<IntentDataSendTransaction> {
    return sendTransactions({
        transactions: [erc1155({ tokenAddress, to, values, data })],
        ...args
    })
}

// TODO: sendDelayedEncode

// TODO: TransactionDelayedEncode
export type Transaction = ethers.providers.TransactionRequest | TransactionRaw | TransactionERC20 | TransactionERC721 | TransactionERC1155

export function transaction(data: Omit<TransactionRaw, 'type'>): Transaction {
    return { type: 'transaction', ...data }
}

export function erc20(data: Omit<TransactionERC20, 'type'>): Transaction {
    return { type: 'erc20send', ...data }
}

export function erc721(data: Omit<TransactionERC721, 'type'>): Transaction {
    return { type: 'erc720send', ...data }
}

export function erc1155({ values, ...data }: ERC1155Args): Transaction {
    return {
        type: 'erc1155send',
        vals: values.map(v => ({
            id: v.id,
            amount: ethers.BigNumber.from(v.amount).toString(),
        })),
        ...data
    }
}

// TODO: delayedEncode

export function combineTransactionIntents(intents: Intent<IntentDataSendTransaction>[]): Intent<IntentDataSendTransaction> {
    if (intents.length === 0) {
        throw new Error('No packets provided')
    }

    // Ensure that all packets are for the same network and wallet
    const network = intents[0].data.network
    const wallet = intents[0].data.wallet
    const lifespan = intents[0].expiresAt - intents[0].issuedAt
    const identifier = intents[0].data.identifier

    if (!intents.every(intent => intent.data.network === network)) {
        throw new Error('All packets must have the same chainId')
    }

    if (!intents.every(intent => intent.data.wallet === wallet)) {
        throw new Error('All packets must have the same wallet')
    }

    return makeIntent('sendTransaction', lifespan, {
        network,
        wallet,
        identifier,
        transactions: intents.flatMap(intent => intent.data.transactions)
    })
}

function isEthersTx(tx: Transaction): tx is ethers.providers.TransactionRequest {
    return !['transaction', 'erc20send', 'erc721send', 'erc1155send'].includes(tx.type as any)
}
