import { Constants, Payload } from '@0xsequence/wallet-primitives';
import { AbiFunction, Bytes, TransactionReceipt } from 'ox';
import { decodePrecondition } from '../../preconditions/index.js';
import { erc20BalanceOf, erc20Allowance, erc721OwnerOf, erc721GetApproved, erc1155BalanceOf, erc1155IsApprovedForAll, } from './abi.js';
export class LocalRelayer {
    provider;
    kind = 'relayer';
    type = 'local';
    id = 'local';
    constructor(provider) {
        this.provider = provider;
    }
    isAvailable(_wallet, _chainId) {
        return Promise.resolve(true);
    }
    static createFromWindow(window) {
        const eth = window.ethereum;
        if (!eth) {
            console.warn('Window.ethereum not found, skipping local relayer');
            return undefined;
        }
        return new LocalRelayer(new EIP1193ProviderAdapter(eth));
    }
    static createFromProvider(provider) {
        return new LocalRelayer(new EIP1193ProviderAdapter(provider));
    }
    feeTokens() {
        return Promise.resolve({
            isFeeRequired: false,
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
    async relay(to, data, chainId, quote, preconditions, checkInterval = 5000) {
        // Helper function to check all preconditions
        const checkAllPreconditions = async () => {
            if (!preconditions || preconditions.length === 0) {
                return true;
            }
            for (const precondition of preconditions) {
                const isValid = await this.checkPrecondition(precondition);
                if (!isValid) {
                    return false;
                }
            }
            return true;
        };
        // Check preconditions immediately
        if (await checkAllPreconditions()) {
            // If all preconditions are met, relay the transaction
            const txHash = await this.provider.sendTransaction({
                to,
                data,
            }, chainId);
            // TODO: Return the opHash instead, but solve the `status` function
            // to properly fetch the receipt from an opHash instead of a txHash
            return { opHash: txHash };
        }
        // If not all preconditions are met, set up event listeners and polling
        return new Promise((resolve, reject) => {
            let timeoutId;
            let isResolved = false;
            // Function to check and relay
            const checkAndRelay = async () => {
                try {
                    if (isResolved)
                        return;
                    if (await checkAllPreconditions()) {
                        isResolved = true;
                        clearTimeout(timeoutId);
                        const txHash = await this.provider.sendTransaction({
                            to,
                            data,
                        }, chainId);
                        resolve({ opHash: txHash });
                    }
                    else {
                        // Schedule next check
                        timeoutId = setTimeout(checkAndRelay, checkInterval);
                    }
                }
                catch (error) {
                    isResolved = true;
                    clearTimeout(timeoutId);
                    reject(error);
                }
            };
            // Start checking
            timeoutId = setTimeout(checkAndRelay, checkInterval);
            // Cleanup function
            return () => {
                isResolved = true;
                clearTimeout(timeoutId);
            };
        });
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
    async checkPrecondition(precondition) {
        const decoded = decodePrecondition(precondition);
        if (!decoded) {
            return false;
        }
        switch (decoded.type()) {
            case 'native-balance': {
                const native = decoded;
                const balance = await this.provider.getBalance(native.address.toString());
                if (native.min !== undefined && balance < native.min) {
                    return false;
                }
                if (native.max !== undefined && balance > native.max) {
                    return false;
                }
                return true;
            }
            case 'erc20-balance': {
                const erc20 = decoded;
                const data = AbiFunction.encodeData(erc20BalanceOf, [erc20.address.toString()]);
                const result = await this.provider.call({
                    to: erc20.token.toString(),
                    data,
                });
                const balance = BigInt(result);
                if (erc20.min !== undefined && balance < erc20.min) {
                    return false;
                }
                if (erc20.max !== undefined && balance > erc20.max) {
                    return false;
                }
                return true;
            }
            case 'erc20-approval': {
                const erc20 = decoded;
                const data = AbiFunction.encodeData(erc20Allowance, [erc20.address.toString(), erc20.operator.toString()]);
                const result = await this.provider.call({
                    to: erc20.token.toString(),
                    data,
                });
                const allowance = BigInt(result);
                return allowance >= erc20.min;
            }
            case 'erc721-ownership': {
                const erc721 = decoded;
                const data = AbiFunction.encodeData(erc721OwnerOf, [erc721.tokenId]);
                const result = await this.provider.call({
                    to: erc721.token.toString(),
                    data,
                });
                const owner = '0x' + result.slice(26);
                const isOwner = owner.toLowerCase() === erc721.address.toString().toLowerCase();
                return erc721.owned === undefined ? isOwner : erc721.owned === isOwner;
            }
            case 'erc721-approval': {
                const erc721 = decoded;
                const data = AbiFunction.encodeData(erc721GetApproved, [erc721.tokenId]);
                const result = await this.provider.call({
                    to: erc721.token.toString(),
                    data,
                });
                const approved = '0x' + result.slice(26);
                return approved.toLowerCase() === erc721.operator.toString().toLowerCase();
            }
            case 'erc1155-balance': {
                const erc1155 = decoded;
                const data = AbiFunction.encodeData(erc1155BalanceOf, [erc1155.address.toString(), erc1155.tokenId]);
                const result = await this.provider.call({
                    to: erc1155.token.toString(),
                    data,
                });
                const balance = BigInt(result);
                if (erc1155.min !== undefined && balance < erc1155.min) {
                    return false;
                }
                if (erc1155.max !== undefined && balance > erc1155.max) {
                    return false;
                }
                return true;
            }
            case 'erc1155-approval': {
                const erc1155 = decoded;
                const data = AbiFunction.encodeData(erc1155IsApprovedForAll, [
                    erc1155.address.toString(),
                    erc1155.operator.toString(),
                ]);
                const result = await this.provider.call({
                    to: erc1155.token.toString(),
                    data,
                });
                return BigInt(result) === 1n;
            }
            default:
                return false;
        }
    }
}
export class EIP1193ProviderAdapter {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    async trySwitchChain(chainId) {
        try {
            await this.provider.request({
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
    }
    async sendTransaction(args, chainId) {
        const accounts = await this.provider.request({ method: 'eth_requestAccounts' });
        const from = accounts[0];
        if (!from) {
            console.warn('No account selected, skipping local relayer');
            return undefined;
        }
        await this.trySwitchChain(chainId);
        const tx = await this.provider.request({
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
    }
    async getBalance(address) {
        const balance = await this.provider.request({
            method: 'eth_getBalance',
            params: [address, 'latest'],
        });
        return BigInt(balance);
    }
    async call(args) {
        return await this.provider.request({
            method: 'eth_call',
            params: [args, 'latest'],
        });
    }
    async getTransactionReceipt(txHash, chainId) {
        await this.trySwitchChain(chainId);
        const rpcReceipt = await this.provider.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
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
    }
}
