import { Address, Hex, Secp256k1, TransactionEnvelopeEip1559, TransactionReceipt } from 'ox';
import { LocalRelayer } from './local.js';
export class PkRelayer {
    provider;
    kind = 'relayer';
    type = 'pk';
    id = 'pk';
    relayer;
    constructor(privateKey, provider) {
        this.provider = provider;
        const relayerAddress = Address.fromPublicKey(Secp256k1.getPublicKey({ privateKey }));
        this.relayer = new LocalRelayer({
            sendTransaction: async (args, chainId) => {
                const providerChainId = Number(await this.provider.request({ method: 'eth_chainId' }));
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
            getBalance: async (address) => {
                const balanceHex = await this.provider.request({
                    method: 'eth_getBalance',
                    params: [address, 'latest'],
                });
                return BigInt(balanceHex);
            },
            call: async (args) => {
                const callArgs = { to: args.to, data: args.data };
                return await this.provider.request({ method: 'eth_call', params: [callArgs, 'latest'] });
            },
            getTransactionReceipt: async (txHash, chainId) => {
                Hex.assert(txHash);
                const providerChainId = Number(await this.provider.request({ method: 'eth_chainId' }));
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
    async isAvailable(_wallet, chainId) {
        const providerChainId = Number(await this.provider.request({ method: 'eth_chainId' }));
        return providerChainId === chainId;
    }
    feeTokens() {
        return this.relayer.feeTokens();
    }
    feeOptions(wallet, chainId, calls) {
        return this.relayer.feeOptions(wallet, chainId, calls);
    }
    async relay(to, data, chainId, _) {
        const providerChainId = Number(await this.provider.request({ method: 'eth_chainId' }));
        if (providerChainId !== chainId) {
            throw new Error('Provider chain id does not match relayer chain id');
        }
        return this.relayer.relay(to, data, chainId);
    }
    status(opHash, chainId) {
        return this.relayer.status(opHash, chainId);
    }
    async checkPrecondition(precondition) {
        // TODO: Implement precondition check
        return true;
    }
}
