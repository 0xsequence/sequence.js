type JsonReplacer = (key: string, value: any) => any;
type JsonReviver = (key: string, value: any) => any;
export declare const jsonReplacers: JsonReplacer;
export declare const jsonRevivers: JsonReviver;
export declare const getNetwork: (chainId: number) => import("@0xsequence/network").NetworkConfig;
export declare const getRpcUrl: (chainId: number) => string;
export declare const getRelayerUrl: (chainId: number) => string;
export declare const getExplorerUrl: (chainId: number, txHash: string) => string;
export {};
//# sourceMappingURL=index.d.ts.map