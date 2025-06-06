export async function relayerSendMetaTx(relayer, metaTx, preconditions) {
    const { opHash } = await relayer.sendMetaTxn(metaTx.walletAddress, metaTx.contract, metaTx.input, BigInt(metaTx.chainId), undefined, preconditions);
    return opHash;
}
