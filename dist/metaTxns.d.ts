import { IntentPrecondition } from '@0xsequence/api';
import { Relayer } from '@0xsequence/wallet-core';
import { Hex } from 'viem';
import { MetaTxn } from './metaTxnMonitor.js';
export declare function relayerSendMetaTx(relayer: Relayer.Rpc.RpcRelayer, metaTx: MetaTxn, preconditions: IntentPrecondition[]): Promise<Hex>;
//# sourceMappingURL=metaTxns.d.ts.map