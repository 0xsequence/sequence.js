export function isStandardRelayerOption(relayerOption) {
    return relayerOption.kind === 'standard';
}
export function isERC4337RelayerOption(relayerOption) {
    return relayerOption.kind === 'erc4337';
}
