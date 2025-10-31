import { ETHTxnStatus, Relayer as Service } from '../rpc-relayer/relayer.gen.js';
import { Payload } from '@0xsequence/wallet-primitives';
import { AbiFunction, Address, Bytes, Hex } from 'ox';
export class SequenceRelayer {
    kind = 'relayer';
    type = 'sequence';
    id = 'sequence';
    service;
    constructor(host) {
        this.service = new Service(host, fetch);
    }
    async isAvailable(_wallet, _chainId) {
        return true;
    }
    async feeTokens() {
        const { isFeeRequired, tokens, paymentAddress } = await this.service.feeTokens();
        if (isFeeRequired) {
            Address.assert(paymentAddress);
            return {
                isFeeRequired,
                tokens,
                paymentAddress,
            };
        }
        // Not required
        return {
            isFeeRequired,
        };
    }
    async feeOptions(wallet, _chainId, calls) {
        const to = wallet; // TODO: this might be the guest module
        const execute = AbiFunction.from('function execute(bytes calldata _payload, bytes calldata _signature)');
        const payload = Payload.encode({ type: 'call', space: 0n, nonce: 0n, calls }, to);
        const signature = '0x0001'; // TODO: use a stub signature
        const data = AbiFunction.encodeData(execute, [Bytes.toHex(payload), signature]);
        const { options, quote } = await this.service.feeOptions({ wallet, to, data });
        return {
            options,
            quote: quote ? { _tag: 'FeeQuote', _quote: quote } : undefined,
        };
    }
    async checkPrecondition(precondition) {
        // TODO: implement
        return false;
    }
    async relay(to, data, _chainId, quote) {
        const walletAddress = to; // TODO: pass wallet address or stop requiring it
        const { txnHash } = await this.service.sendMetaTxn({
            call: { walletAddress, contract: to, input: data },
            quote: quote && quote._quote,
        });
        return { opHash: `0x${txnHash}` };
    }
    async status(opHash, _chainId) {
        try {
            const { receipt: { status, revertReason, txnReceipt }, } = await this.service.getMetaTxnReceipt({ metaTxID: opHash });
            switch (status) {
                case ETHTxnStatus.UNKNOWN:
                    return { status: 'unknown' };
                case ETHTxnStatus.DROPPED:
                    return { status: 'failed', reason: revertReason ?? status };
                case ETHTxnStatus.QUEUED:
                    return { status: 'pending' };
                case ETHTxnStatus.SENT:
                    return { status: 'pending' };
                case ETHTxnStatus.SUCCEEDED: {
                    const receipt = JSON.parse(txnReceipt);
                    const transactionHash = receipt.transactionHash;
                    Hex.assert(transactionHash);
                    return { status: 'confirmed', transactionHash };
                }
                case ETHTxnStatus.PARTIALLY_FAILED:
                    return { status: 'failed', reason: revertReason ?? status };
                case ETHTxnStatus.FAILED:
                    return { status: 'failed', reason: revertReason ?? status };
                default:
                    throw new Error(`unknown transaction status '${status}'`);
            }
        }
        catch {
            return { status: 'pending' };
        }
    }
}
