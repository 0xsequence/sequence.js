export declare enum NetworkType {
    MAINNET = "mainnet",
    TESTNET = "testnet"
}
export type BlockExplorerConfig = {
    name?: string;
    url: string;
};
export interface Network {
    chainId: number;
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
    readonly NONE: 0;
    readonly MAINNET: 1;
    readonly SEPOLIA: 11155111;
    readonly POLYGON: 137;
    readonly POLYGON_ZKEVM: 1101;
    readonly POLYGON_AMOY: 80002;
    readonly BSC: 56;
    readonly BSC_TESTNET: 97;
    readonly OPTIMISM: 10;
    readonly OPTIMISM_SEPOLIA: 11155420;
    readonly ARBITRUM: 42161;
    readonly ARBITRUM_SEPOLIA: 421614;
    readonly ARBITRUM_NOVA: 42170;
    readonly AVALANCHE: 43114;
    readonly AVALANCHE_TESTNET: 43113;
    readonly GNOSIS: 100;
    readonly BASE: 8453;
    readonly BASE_SEPOLIA: 84532;
    readonly HOMEVERSE_TESTNET: 40875;
    readonly HOMEVERSE: 19011;
    readonly XAI: 660279;
    readonly XAI_SEPOLIA: 37714555429;
    readonly TELOS: 40;
    readonly TELOS_TESTNET: 41;
    readonly B3: 8333;
    readonly B3_SEPOLIA: 1993;
    readonly APECHAIN: 33139;
    readonly APECHAIN_TESTNET: 33111;
    readonly BLAST: 81457;
    readonly BLAST_SEPOLIA: 168587773;
    readonly SKALE_NEBULA: 1482601649;
    readonly SKALE_NEBULA_TESTNET: 37084624;
    readonly SONEIUM_MINATO: 1946;
    readonly SONEIUM: 1868;
    readonly TOY_TESTNET: 21000000;
    readonly IMMUTABLE_ZKEVM: 13371;
    readonly IMMUTABLE_ZKEVM_TESTNET: 13473;
    readonly ETHERLINK: 42793;
    readonly ETHERLINK_TESTNET: 128123;
    readonly MOONBEAM: 1284;
    readonly MOONBASE_ALPHA: 1287;
    readonly MONAD: 143;
    readonly MONAD_TESTNET: 10143;
    readonly SOMNIA_TESTNET: 50312;
    readonly SOMNIA: 5031;
    readonly INCENTIV_TESTNET_V2: 28802;
    readonly KATANA: 747474;
    readonly SANDBOX_TESTNET: 6252;
    readonly ARC_TESTNET: 5042002;
};
export type ChainId = (typeof ChainId)[keyof typeof ChainId];
export declare const ALL: Network[];
export declare function getNetworkFromName(networkName: string): Network | undefined;
export declare function getNetworkFromChainId(chainId: ChainId | number | bigint | string): Network | undefined;
//# sourceMappingURL=network.d.ts.map