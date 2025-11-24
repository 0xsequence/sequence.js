import { Payload } from '@0xsequence/wallet-primitives';
import { Provider, Address, RpcTransport } from 'ox';
import { UserOperation } from 'ox/erc4337';
export class PimlicoBundler {
    kind = 'bundler';
    id;
    provider;
    bundlerRpcUrl;
    constructor(bundlerRpcUrl, provider) {
        this.id = `pimlico-erc4337-${bundlerRpcUrl}`;
        this.provider = typeof provider === 'string' ? Provider.from(RpcTransport.fromHttp(provider)) : provider;
        this.bundlerRpcUrl = bundlerRpcUrl;
    }
    async isAvailable(entrypoint, chainId) {
        const [bundlerChainId, supportedEntryPoints] = await Promise.all([
            this.bundlerRpc('eth_chainId', []),
            this.bundlerRpc('eth_supportedEntryPoints', []),
        ]);
        if (chainId !== Number(bundlerChainId)) {
            return false;
        }
        return supportedEntryPoints.some((ep) => Address.isEqual(ep, entrypoint));
    }
    async relay(entrypoint, userOperation) {
        const status = await this.bundlerRpc('eth_sendUserOperation', [userOperation, entrypoint]);
        return { opHash: status };
    }
    async estimateLimits(wallet, payload) {
        const gasPrice = await this.bundlerRpc('pimlico_getUserOperationGasPrice', []);
        const dummyOp = Payload.to4337UserOperation(payload, wallet, '0x000010000000000000000000000000000000000000000000');
        const rpcOp = UserOperation.toRpc(dummyOp);
        const est = await this.bundlerRpc('eth_estimateUserOperationGas', [rpcOp, payload.entrypoint]);
        const estimatedFields = {
            callGasLimit: BigInt(est.callGasLimit),
            verificationGasLimit: BigInt(est.verificationGasLimit),
            preVerificationGas: BigInt(est.preVerificationGas),
            paymasterVerificationGasLimit: est.paymasterVerificationGasLimit
                ? BigInt(est.paymasterVerificationGasLimit)
                : payload.paymasterVerificationGasLimit,
            paymasterPostOpGasLimit: est.paymasterPostOpGasLimit
                ? BigInt(est.paymasterPostOpGasLimit)
                : payload.paymasterPostOpGasLimit,
        };
        const passthroughOptions = payload.maxFeePerGas > 0n || payload.maxPriorityFeePerGas > 0n
            ? [this.createEstimateLimitVariation(payload, estimatedFields, undefined, gasPrice.standard)]
            : [];
        return [
            ...passthroughOptions,
            this.createEstimateLimitVariation(payload, estimatedFields, 'slow', gasPrice.slow),
            this.createEstimateLimitVariation(payload, estimatedFields, 'standard', gasPrice.standard),
            this.createEstimateLimitVariation(payload, estimatedFields, 'fast', gasPrice.fast),
        ];
    }
    createEstimateLimitVariation(payload, estimatedFields, speed, feePerGasPair) {
        return {
            speed,
            payload: {
                ...payload,
                ...estimatedFields,
                maxFeePerGas: BigInt(feePerGasPair?.maxFeePerGas ?? payload.maxFeePerGas),
                maxPriorityFeePerGas: BigInt(feePerGasPair?.maxPriorityFeePerGas ?? payload.maxPriorityFeePerGas),
            },
        };
    }
    async status(opHash, _chainId) {
        try {
            let pimlico;
            try {
                pimlico = await this.bundlerRpc('pimlico_getUserOperationStatus', [opHash]);
            }
            catch (_) {
                /* ignore - not Pimlico or endpoint down */
            }
            if (pimlico) {
                switch (pimlico.status) {
                    case 'not_submitted':
                    case 'submitted':
                        return { status: 'pending' };
                    case 'rejected':
                        return { status: 'failed', reason: 'rejected by bundler' };
                    case 'failed':
                    case 'reverted':
                        return {
                            status: 'failed',
                            transactionHash: pimlico.transactionHash ?? undefined,
                            reason: pimlico.status,
                        };
                    case 'included':
                        // fall through to receipt lookup for full info
                        break;
                    case 'not_found':
                    default:
                        return { status: 'unknown' };
                }
            }
            // Fallback to standard method
            const receipt = await this.bundlerRpc('eth_getUserOperationReceipt', [opHash]);
            if (!receipt)
                return { status: 'pending' };
            const txHash = receipt.receipt?.transactionHash ?? receipt.transactionHash ?? undefined;
            const ok = receipt.success === true || receipt.receipt?.status === '0x1' || receipt.receipt?.status === 1;
            return ok
                ? { status: 'confirmed', transactionHash: txHash ?? opHash, data: receipt }
                : {
                    status: 'failed',
                    transactionHash: txHash,
                    reason: receipt.revertReason ?? 'UserOp reverted',
                };
        }
        catch (err) {
            console.error('[PimlicoBundler.status]', err);
            return { status: 'unknown', reason: err?.message ?? 'status lookup failed' };
        }
    }
    async bundlerRpc(method, params) {
        const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
        const res = await fetch(this.bundlerRpcUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body,
        });
        const json = await res.json();
        if (json.error)
            throw new Error(json.error.message ?? 'bundler error');
        return json.result;
    }
}
