export function isExplicitSessionSigner(signer) {
    return 'prepareIncrements' in signer;
}
export function isImplicitSessionSigner(signer) {
    return 'identitySigner' in signer;
}
