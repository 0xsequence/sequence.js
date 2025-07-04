import { Envelope } from '@0xsequence/wallet-core';
import { Payload } from '@0xsequence/wallet-primitives';
import { Address, Hex } from 'ox';
import { Handler } from '../handlers/handler.js';
export type ActionToPayload = {
    [Actions.Logout]: Payload.ConfigUpdate;
    [Actions.Login]: Payload.ConfigUpdate;
    [Actions.SendTransaction]: Payload.Calls | Payload.Calls4337_07;
    [Actions.SignMessage]: Payload.Message;
    [Actions.SessionUpdate]: Payload.ConfigUpdate;
    [Actions.Recovery]: Payload.Recovery<Payload.Calls>;
    [Actions.AddRecoverySigner]: Payload.ConfigUpdate;
    [Actions.RemoveRecoverySigner]: Payload.ConfigUpdate;
    [Actions.SessionImplicitAuthorize]: Payload.SessionImplicitAuthorize;
};
export declare const Actions: {
    readonly Logout: "logout";
    readonly Login: "login";
    readonly SendTransaction: "send-transaction";
    readonly SignMessage: "sign-message";
    readonly SessionUpdate: "session-update";
    readonly Recovery: "recovery";
    readonly AddRecoverySigner: "add-recovery-signer";
    readonly RemoveRecoverySigner: "remove-recovery-signer";
    readonly SessionImplicitAuthorize: "session-implicit-authorize";
};
export type Action = (typeof Actions)[keyof typeof Actions];
export type BaseSignatureRequest<A extends Action = Action> = {
    id: string;
    wallet: Address.Address;
    origin: string;
    createdAt: string;
    action: A;
    envelope: Envelope.Signed<ActionToPayload[A]>;
    status: 'pending';
} | {
    id: string;
    wallet: Address.Address;
    origin: string;
    createdAt: string;
    action: A;
    envelope: Envelope.Signed<ActionToPayload[A]>;
    status: 'cancelled' | 'completed';
    scheduledPruning: number;
};
export type SignerBase = {
    address: Address.Address;
    imageHash?: Hex.Hex;
};
export type SignerSigned = SignerBase & {
    handler?: Handler;
    status: 'signed';
};
export type SignerUnavailable = SignerBase & {
    handler?: Handler;
    reason: string;
    status: 'unavailable';
};
export type SignerReady = SignerBase & {
    handler: Handler;
    status: 'ready';
    handle: () => Promise<boolean>;
};
export type SignerActionable = SignerBase & {
    handler: Handler;
    status: 'actionable';
    message: string;
    handle: () => Promise<boolean>;
};
export type Signer = SignerSigned | SignerUnavailable | SignerReady | SignerActionable;
export type SignatureRequest = BaseSignatureRequest & {
    weight: bigint;
    threshold: bigint;
    signers: Signer[];
};
//# sourceMappingURL=signature-request.d.ts.map