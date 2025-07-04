import { Payload } from '@0xsequence/wallet-primitives';
import { Address } from 'ox';
import { Shared } from './manager.js';
import { Transaction, TransactionRequest } from './types/transaction-request.js';
export declare class Transactions {
    private readonly shared;
    constructor(shared: Shared);
    initialize(): void;
    refreshStatus(onlyTxId?: string): Promise<number>;
    list(): Promise<Transaction[]>;
    get(transactionId: string): Promise<Transaction>;
    request(from: Address.Address, chainId: bigint, txs: TransactionRequest[], options?: {
        skipDefineGas?: boolean;
        source?: string;
        noConfigUpdate?: boolean;
        unsafe?: boolean;
        space?: bigint;
    }): Promise<string>;
    define(transactionId: string, changes?: {
        nonce?: bigint;
        space?: bigint;
        calls?: Pick<Payload.Call, 'gasLimit'>[];
    }): Promise<void>;
    selectRelayer(transactionId: string, relayerOptionId: string): Promise<string>;
    relay(transactionOrSignatureId: string): Promise<string>;
    onTransactionsUpdate(cb: (transactions: Transaction[]) => void, trigger?: boolean): () => void;
    onTransactionUpdate(transactionId: string, cb: (transaction: Transaction) => void, trigger?: boolean): () => void;
    delete(transactionId: string): Promise<void>;
}
//# sourceMappingURL=transactions.d.ts.map