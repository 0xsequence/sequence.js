import { Network } from '@0xsequence/wallet-primitives';
type JsonReplacer = (key: string, value: any) => any;
type JsonReviver = (key: string, value: any) => any;
export declare const jsonRevivers: JsonReviver;
export declare const jsonReplacers: JsonReplacer;
export declare const getNetwork: (chainId: Network.ChainId | bigint | number) => Network.Network;
export declare const getRpcUrl: (chainId: Network.ChainId | bigint | number, nodesUrl: string, projectAccessKey: string) => string;
export declare const getRelayerUrl: (chainId: Network.ChainId | bigint | number, relayerUrl: string) => string;
export declare const getExplorerUrl: (chainId: Network.ChainId | bigint | number, txHash: string) => string;
export {};
//# sourceMappingURL=index.d.ts.map