export function isBundler(relayer) {
    return 'estimateLimits' in relayer && 'relay' in relayer && 'isAvailable' in relayer;
}
