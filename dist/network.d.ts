export declare enum NetworkType {
    MAINNET = "mainnet",
    TESTNET = "testnet"
}
export type BlockExplorerConfig = {
    name?: string;
    url: string;
};
export interface Network {
    chainId: bigint;
    type: NetworkType;
    name: string;
    title?: string;
    rpcUrl: string;
    logoUrl?: string;
    blockExplorer?: BlockExplorerConfig;
    nativeCurrency: {
        symbol: string;
        name: string;
        decimals: number;
    };
    ensAddress?: string;
    deprecated?: true;
}
export declare const ChainId: {
    readonly MAINNET: 1n;
    readonly SEPOLIA: 11155111n;
    readonly POLYGON: 137n;
    readonly POLYGON_ZKEVM: 1101n;
    readonly POLYGON_AMOY: 80002n;
    readonly BSC: 56n;
    readonly BSC_TESTNET: 97n;
    readonly OPTIMISM: 10n;
    readonly OPTIMISM_SEPOLIA: 11155420n;
    readonly ARBITRUM: 42161n;
    readonly ARBITRUM_SEPOLIA: 421614n;
    readonly ARBITRUM_NOVA: 42170n;
    readonly AVALANCHE: 43114n;
    readonly AVALANCHE_TESTNET: 43113n;
    readonly GNOSIS: 100n;
    readonly BASE: 8453n;
    readonly BASE_SEPOLIA: 84532n;
    readonly HOMEVERSE_TESTNET: 40875n;
    readonly HOMEVERSE: 19011n;
    readonly XAI: 660279n;
    readonly XAI_SEPOLIA: 37714555429n;
    readonly TELOS: 40n;
    readonly TELOS_TESTNET: 41n;
    readonly B3: 8333n;
    readonly B3_SEPOLIA: 1993n;
    readonly APECHAIN: 33139n;
    readonly APECHAIN_TESTNET: 33111n;
    readonly BLAST: 81457n;
    readonly BLAST_SEPOLIA: 168587773n;
    readonly SKALE_NEBULA: 1482601649n;
    readonly SKALE_NEBULA_TESTNET: 37084624n;
    readonly SONEIUM_MINATO: 1946n;
    readonly SONEIUM: 1868n;
    readonly TOY_TESTNET: 21000000n;
    readonly IMMUTABLE_ZKEVM: 13371n;
    readonly IMMUTABLE_ZKEVM_TESTNET: 13473n;
    readonly ROOT_NETWORK: 7668n;
    readonly ROOT_NETWORK_PORCINI: 7672n;
    readonly LAOS: 6283n;
    readonly LAOS_SIGMA_TESTNET: 62850n;
    readonly ETHERLINK: 42793n;
    readonly ETHERLINK_TESTNET: 128123n;
    readonly MOONBEAM: 1284n;
    readonly MOONBASE_ALPHA: 1287n;
    readonly MONAD_TESTNET: 10143n;
    readonly SOMNIA_TESTNET: 50312n;
    readonly SOMNIA: 5031n;
    readonly INCENTIV_TESTNET: 11690n;
    readonly SEI: 1329n;
    readonly SEI_TESTNET: 1328n;
};
export type ChainId = (typeof ChainId)[keyof typeof ChainId];
export declare const ALL: Network[];
export declare function getNetworkFromName(networkName: string): Network | undefined;
export declare function getNetworkFromChainId(chainId: ChainId | bigint | number | string): Network | undefined;
//# sourceMappingURL=network.d.ts.map