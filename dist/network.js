export const Arbitrum = {
    name: 'Arbitrum',
    rpc: 'https://nodes.sequence.app/arbitrum',
    chainId: 42161n,
    explorer: 'https://arbiscan.io/',
    nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18,
    },
};
export const ArbitrumSepolia = {
    name: 'Arbitrum Sepolia',
    rpc: 'https://nodes.sequence.app/arbitrum-sepolia',
    chainId: 421614n,
    explorer: 'https://sepolia.arbiscan.io/',
    nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18,
    },
};
export const All = [Arbitrum, ArbitrumSepolia];
//# sourceMappingURL=network.js.map