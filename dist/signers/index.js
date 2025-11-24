export * as Pk from './pk/index.js';
export * as Passkey from './passkey.js';
export * as Session from './session/index.js';
export * from './session-manager.js';
export * from './guard.js';
export function isSapientSigner(signer) {
    return 'signSapient' in signer;
}
export function isSigner(signer) {
    return 'sign' in signer;
}
