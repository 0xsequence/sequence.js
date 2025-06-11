import { Relayer } from '@0xsequence/wallet-core';
export type RelayerOperationStatus = Relayer.OperationStatus;
export type Relayer = Relayer.Rpc.RpcRelayer;
export type RelayerConfig = {
    hostname: string;
    chainId: number;
    rpcUrl: string;
};
export type RelayerEnvConfig = {
    env?: 'local' | 'cors-anywhere' | 'dev' | 'prod';
    useV3Relayers?: boolean;
};
export declare function getBackupRelayer(chainId: number): Relayer.Rpc.RpcRelayer | undefined;
export declare function getRelayer(config: RelayerEnvConfig, chainId: number): Relayer.Rpc.RpcRelayer;
export declare function useRelayers(config: RelayerEnvConfig): {
    relayers: Map<number, Relayer.Rpc.RpcRelayer>;
    getRelayer: (chainId: number) => Relayer.Rpc.RpcRelayer;
    getBackupRelayer: (chainId: number) => Relayer.Rpc.RpcRelayer | undefined;
};
export type { Relayer };
//# sourceMappingURL=relayer.d.ts.map