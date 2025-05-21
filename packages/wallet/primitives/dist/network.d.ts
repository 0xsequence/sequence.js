export type Network = {
    name: string;
    rpc: string;
    chainId: bigint;
    explorer: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
};
export declare const Arbitrum: Network;
export declare const ArbitrumSepolia: Network;
export declare const All: Network[];
//# sourceMappingURL=network.d.ts.map