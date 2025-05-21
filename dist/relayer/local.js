import { Constants, Payload } from '@0xsequence/wallet-primitives';
import { AbiFunction, Bytes, Hex, TransactionReceipt } from 'ox';
export class LocalRelayer {
    provider;
    id = 'local';
    constructor(provider) {
        this.provider = provider;
    }
    static createFromWindow(window) {
        const eth = window.ethereum;
        if (!eth) {
            console.warn('Window.ethereum not found, skipping local relayer');
            return undefined;
        }
        const trySwitchChain = async (chainId) => {
            try {
                await eth.request({
                    method: 'wallet_switchEthereumChain',
                    params: [
                        {
                            chainId: `0x${chainId.toString(16)}`,
                        },
                    ],
                });
            }
            catch (error) {
                // Log and continue
                console.error('Error switching chain', error);
            }
        };
        return new LocalRelayer({
            sendTransaction: async (args, chainId) => {
                const accounts = await eth.request({ method: 'eth_requestAccounts' });
                const from = accounts[0];
                if (!from) {
                    console.warn('No account selected, skipping local relayer');
                    return undefined;
                }
                await trySwitchChain(chainId);
                const tx = await eth.request({
                    method: 'eth_sendTransaction',
                    params: [
                        {
                            from,
                            to: args.to,
                            data: args.data,
                        },
                    ],
                });
                return tx;
            },
            getTransactionReceipt: async (txHash, chainId) => {
                await trySwitchChain(chainId);
                const rpcReceipt = await eth.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
                if (rpcReceipt) {
                    const receipt = TransactionReceipt.fromRpc(rpcReceipt);
                    if (receipt?.status === 'success') {
                        return 'success';
                    }
                    else if (receipt?.status === 'reverted') {
                        return 'failed';
                    }
                }
                return 'unknown';
            },
        });
    }
    feeOptions(wallet, chainId, calls) {
        return Promise.resolve({ options: [] });
    }
    decodeCalls(data) {
        const executeSelector = AbiFunction.getSelector(Constants.EXECUTE);
        let packedPayload;
        if (data.startsWith(executeSelector)) {
            const decode = AbiFunction.decodeData(Constants.EXECUTE, data);
            packedPayload = decode[0];
        }
        else {
            packedPayload = data;
        }
        return Payload.decode(Bytes.fromHex(packedPayload));
    }
    async relay(to, data, chainId, _) {
        const txHash = await this.provider.sendTransaction({
            to,
            data,
        }, chainId);
        Hex.assert(txHash);
        return { opHash: txHash };
    }
    async status(opHash, chainId) {
        const receipt = await this.provider.getTransactionReceipt(opHash, chainId);
        if (receipt === 'unknown') {
            // Could be pending but we don't know
            return { status: 'unknown' };
        }
        return receipt === 'success'
            ? { status: 'confirmed', transactionHash: opHash }
            : { status: 'failed', reason: 'failed' };
    }
}
