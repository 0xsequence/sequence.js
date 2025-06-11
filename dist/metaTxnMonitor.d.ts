import { Relayer } from '@0xsequence/wallet-core';
export type MetaTxn = {
    id: string;
    chainId: string;
    contract?: string | undefined;
    input?: string | undefined;
    walletAddress?: string | undefined;
};
export type MetaTxnStatus = {
    [key: string]: Relayer.OperationStatus;
};
export declare const getMetaTxStatus: (relayer: Relayer.Rpc.RpcRelayer, metaTxId: string, chainId: number) => Promise<Relayer.OperationStatus>;
export declare const useMetaTxnsMonitor: (metaTxns: MetaTxn[] | undefined, getRelayer: (chainId: number) => Relayer.Rpc.RpcRelayer) => MetaTxnStatus;
//# sourceMappingURL=metaTxnMonitor.d.ts.map