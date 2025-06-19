import { EIP6963ProviderInfo, EIP6963ProviderDetail } from 'mipd';
import { LocalRelayer } from './local.js';
export declare class EIP6963Relayer extends LocalRelayer {
    readonly info: EIP6963ProviderInfo;
    constructor(detail: EIP6963ProviderDetail);
}
export declare function getEIP6963Store(): import("mipd").Store;
export declare function getRelayers(): EIP6963Relayer[];
//# sourceMappingURL=eip6963.d.ts.map