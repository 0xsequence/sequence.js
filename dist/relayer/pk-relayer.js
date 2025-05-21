import { Address, Hex, Secp256k1, TransactionEnvelopeEip1559, TransactionReceipt } from 'ox';
import { LocalRelayer } from './local.js';
export class PkRelayer {
    provider;
    id = 'pk';
    relayer;
    constructor(privateKey, provider) {
        this.provider = provider;
        const relayerAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey }));
        this.relayer = new LocalRelayer({
            sendTransaction: async (args, chainId) => {
                const providerChainId = BigInt(await this.provider.request({ method: 'eth_chainId' }));
                if (providerChainId !== chainId) {
                    throw new Error('Provider chain id does not match relayer chain id');
                }
                const oxArgs = { ...args, to: args.to, data: args.data };
                // Estimate gas with a safety buffer
                const estimatedGas = BigInt(await this.provider.request({ method: 'eth_estimateGas', params: [oxArgs] }));
                const safeGasLimit = estimatedGas > 21000n ? (estimatedGas * 12n) / 10n : 50000n;
                // Get base fee and priority fee
                const baseFee = BigInt(await this.provider.request({ method: 'eth_gasPrice' }));
                const priorityFee = 100000000n; // 0.1 gwei priority fee
                const maxFeePerGas = baseFee + priorityFee;
                // Check sender have enough balance
                const senderBalance = BigInt(await this.provider.request({ method: 'eth_getBalance', params: [relayerAddress, 'latest'] }));
                if (senderBalance < maxFeePerGas * safeGasLimit) {
                    console.log('Sender balance:', senderBalance.toString(), 'wei');
                    throw new Error('Sender has insufficient balance to pay for gas');
                }
                const nonce = BigInt(await this.provider.request({
                    method: 'eth_getTransactionCount',
                    params: [relayerAddress, 'latest'],
                }));
                // Build the relay envelope
                const relayEnvelope = TransactionEnvelopeEip1559.from({
                    chainId: Number(chainId),
                    type: 'eip1559',
                    from: relayerAddress,
                    to: oxArgs.to,
                    data: oxArgs.data,
                    gas: safeGasLimit,
                    maxFeePerGas: maxFeePerGas,
                    maxPriorityFeePerGas: priorityFee,
                    nonce: nonce,
                    value: 0n,
                });
                const relayerSignature = Secp256k1.sign({
                    payload: TransactionEnvelopeEip1559.getSignPayload(relayEnvelope),
                    privateKey: privateKey,
                });
                const signedRelayEnvelope = TransactionEnvelopeEip1559.from(relayEnvelope, {
                    signature: relayerSignature,
                });
                const tx = await this.provider.request({
                    method: 'eth_sendRawTransaction',
                    params: [TransactionEnvelopeEip1559.serialize(signedRelayEnvelope)],
                });
                return tx;
            },
            getTransactionReceipt: async (txHash, chainId) => {
                Hex.assert(txHash);
                const providerChainId = BigInt(await this.provider.request({ method: 'eth_chainId' }));
                if (providerChainId !== chainId) {
                    throw new Error('Provider chain id does not match relayer chain id');
                }
                const rpcReceipt = await this.provider.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
                if (!rpcReceipt) {
                    return 'unknown';
                }
                const receipt = TransactionReceipt.fromRpc(rpcReceipt);
                return receipt.status === 'success' ? 'success' : 'failed';
            },
        });
    }
    feeOptions(wallet, chainId, calls) {
        return this.relayer.feeOptions(wallet, chainId, calls);
    }
    async relay(to, data, chainId, _) {
        const providerChainId = BigInt(await this.provider.request({ method: 'eth_chainId' }));
        if (providerChainId !== chainId) {
            throw new Error('Provider chain id does not match relayer chain id');
        }
        return this.relayer.relay(to, data, chainId);
    }
    status(opHash, chainId) {
        return this.relayer.status(opHash, chainId);
    }
}
