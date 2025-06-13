import { Address, Hex } from 'ox';
import { Context, Payload } from '@0xsequence/wallet-primitives';
export interface IntentCallsPayload extends Payload.Calls {
    chainId: bigint;
}
export interface OriginTokenParam {
    address: Address.Address;
    chainId: bigint;
}
export interface DestinationTokenParam {
    address: Address.Address;
    chainId: bigint;
    amount: bigint;
}
export declare function hashIntentParams(params: {
    userAddress: Address.Address;
    nonce: bigint;
    originTokens: OriginTokenParam[];
    destinationCalls: Array<IntentCallsPayload>;
    destinationTokens: DestinationTokenParam[];
}): string;
export interface AnypayLifiInfo {
    originToken: Address.Address;
    amount: bigint;
    originChainId: bigint;
    destinationChainId: bigint;
}
export declare function getAnypayLifiInfoHash(lifiInfos: AnypayLifiInfo[], attestationAddress: Address.Address): Hex.Hex;
export declare function calculateIntentConfigurationAddress(mainSigner: Address.Address, calls: IntentCallsPayload[], context: Context.Context, attestationSigner?: Address.Address, lifiInfos?: AnypayLifiInfo[]): Address.Address;
//# sourceMappingURL=intents.d.ts.map