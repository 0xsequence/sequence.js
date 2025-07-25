export function isExplicitSessionSigner(signer) {
    return 'prepareIncrements' in signer;
}
