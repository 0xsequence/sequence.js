import { Payload, SessionConfig, Signature as SignatureTypes } from '@0xsequence/wallet-primitives';
import { Address, Hex, Provider } from 'ox';
import * as State from '../state/index.js';
import { Wallet } from '../wallet.js';
import { SapientSigner } from './index.js';
import { Explicit, Implicit, SessionSigner } from './session/index.js';
export type SessionManagerOptions = {
    sessionManagerAddress: Address.Address;
    stateProvider?: State.Provider;
    implicitSigners: Implicit[];
    explicitSigners: Explicit[];
    provider?: Provider.Provider;
};
export declare const DefaultSessionManagerOptions: SessionManagerOptions;
export declare class SessionManager implements SapientSigner {
    readonly wallet: Wallet;
    readonly stateProvider: State.Provider;
    readonly address: Address.Address;
    private readonly _implicitSigners;
    private readonly _explicitSigners;
    private readonly _provider?;
    constructor(wallet: Wallet, options?: Partial<SessionManagerOptions>);
    get imageHash(): Promise<Hex.Hex | undefined>;
    getImageHash(): Promise<Hex.Hex | undefined>;
    get topology(): Promise<SessionConfig.SessionsTopology>;
    getTopology(): Promise<SessionConfig.SessionsTopology>;
    withProvider(provider: Provider.Provider): SessionManager;
    withImplicitSigner(signer: Implicit): SessionManager;
    withExplicitSigner(signer: Explicit): SessionManager;
    findSignersForCalls(wallet: Address.Address, chainId: bigint, calls: Payload.Call[]): Promise<SessionSigner[]>;
    prepareIncrement(wallet: Address.Address, chainId: bigint, calls: Payload.Call[]): Promise<Payload.Call | null>;
    signSapient(wallet: Address.Address, chainId: bigint, payload: Payload.Parented, imageHash: Hex.Hex): Promise<SignatureTypes.SignatureOfSapientSignerLeaf>;
    isValidSapientSignature(wallet: Address.Address, chainId: bigint, payload: Payload.Parented, signature: SignatureTypes.SignatureOfSapientSignerLeaf): Promise<boolean>;
}
//# sourceMappingURL=session-manager.d.ts.map