import { Relayer as GenRelayer, FeeTokenType, ETHTxnStatus, } from './relayer.gen.js';
import { Address, Hex, Bytes, AbiFunction } from 'ox';
import { Constants, Payload, Network } from '@0xsequence/wallet-primitives';
import { decodePrecondition } from '../../preconditions/index.js';
import { erc20BalanceOf, erc20Allowance, erc721OwnerOf, erc721GetApproved, erc1155BalanceOf, erc1155IsApprovedForAll, } from '../standard/abi.js';
import { createPublicClient, http } from 'viem';
import * as chains from 'viem/chains';
/**
 * Convert a Sequence Network to a viem Chain
 */
const networkToChain = (network) => {
    return {
        id: network.chainId,
        name: network.title || network.name,
        nativeCurrency: {
            name: network.nativeCurrency.name,
            symbol: network.nativeCurrency.symbol,
            decimals: network.nativeCurrency.decimals,
        },
        rpcUrls: {
            default: {
                http: [network.rpcUrl],
            },
        },
        blockExplorers: network.blockExplorer
            ? {
                default: {
                    name: network.blockExplorer.name || 'Explorer',
                    url: network.blockExplorer.url,
                },
            }
            : undefined,
        contracts: network.ensAddress
            ? {
                ensUniversalResolver: {
                    address: network.ensAddress,
                },
            }
            : undefined,
    };
};
export const getChain = (chainId) => {
    // First try to get the chain from Sequence's network configurations
    const sequenceNetwork = Network.getNetworkFromChainId(chainId);
    if (sequenceNetwork) {
        return networkToChain(sequenceNetwork);
    }
    // Fall back to viem's built-in chains
    const viemChain = Object.values(chains).find((c) => typeof c === 'object' && 'id' in c && c.id === chainId);
    if (viemChain) {
        return viemChain;
    }
    throw new Error(`Chain with id ${chainId} not found in Sequence networks or viem chains`);
};
export class RpcRelayer {
    kind = 'relayer';
    type = 'rpc';
    id;
    chainId;
    client;
    fetch;
    provider;
    projectAccessKey;
    constructor(hostname, chainId, rpcUrl, fetchImpl, projectAccessKey) {
        this.id = `rpc:${hostname}`;
        this.chainId = chainId;
        this.projectAccessKey = projectAccessKey;
        const effectiveFetch = fetchImpl || (typeof window !== 'undefined' ? window.fetch.bind(window) : undefined);
        if (!effectiveFetch) {
            throw new Error('Fetch implementation is required but not available in this environment.');
        }
        this.fetch = effectiveFetch;
        this.client = new GenRelayer(hostname, this.fetch);
        // Get the chain from the chainId
        const chain = getChain(chainId);
        // Create viem PublicClient with the provided RPC URL
        this.provider = createPublicClient({
            chain,
            transport: http(rpcUrl),
        });
    }
    isAvailable(_wallet, chainId) {
        return Promise.resolve(this.chainId === chainId);
    }
    async feeTokens() {
        try {
            const { isFeeRequired, tokens, paymentAddress } = await this.client.feeTokens();
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
        catch (e) {
            console.warn('RpcRelayer.feeTokens failed:', e);
            return { isFeeRequired: false };
        }
    }
    async feeOptions(wallet, chainId, calls) {
        const callsStruct = { type: 'call', space: 0n, nonce: 0n, calls: calls };
        const data = Payload.encode(callsStruct);
        try {
            const result = await this.client.feeOptions({
                wallet: wallet,
                to: wallet,
                data: Bytes.toHex(data),
            }, { ...(this.projectAccessKey ? { 'X-Access-Key': this.projectAccessKey } : undefined) });
            const quote = result.quote ? { _tag: 'FeeQuote', _quote: result.quote } : undefined;
            const options = result.options.map((option) => ({
                token: {
                    ...option.token,
                    contractAddress: this.mapRpcFeeTokenToAddress(option.token),
                },
                to: option.to,
                value: option.value,
                gasLimit: option.gasLimit,
            }));
            return { options, quote };
        }
        catch (e) {
            console.warn('RpcRelayer.feeOptions failed:', e);
            return { options: [] };
        }
    }
    async sendMetaTxn(walletAddress, to, data, chainId, quote, preconditions) {
        console.log('sendMetaTxn', walletAddress, to, data, chainId, quote, preconditions);
        const rpcCall = {
            walletAddress: walletAddress,
            contract: to,
            input: data,
        };
        const result = await this.client.sendMetaTxn({
            call: rpcCall,
            quote: quote ? JSON.stringify(quote._quote) : undefined,
            preconditions: preconditions,
        }, { ...(this.projectAccessKey ? { 'X-Access-Key': this.projectAccessKey } : undefined) });
        if (!result.status) {
            console.error('RpcRelayer.relay failed', result);
            throw new Error(`Relay failed: TxnHash ${result.txnHash}`);
        }
        return { opHash: Hex.fromString(result.txnHash) };
    }
    async relay(to, data, chainId, quote, preconditions) {
        console.log('relay', to, data, chainId, quote, preconditions);
        const rpcCall = {
            walletAddress: to,
            contract: to,
            input: data,
        };
        const result = await this.client.sendMetaTxn({
            call: rpcCall,
            quote: quote ? JSON.stringify(quote._quote) : undefined,
            preconditions: preconditions,
        }, { ...(this.projectAccessKey ? { 'X-Access-Key': this.projectAccessKey } : undefined) });
        if (!result.status) {
            console.error('RpcRelayer.relay failed', result);
            throw new Error(`Relay failed: TxnHash ${result.txnHash}`);
        }
        return { opHash: `0x${result.txnHash}` };
    }
    async status(opHash, chainId) {
        try {
            const cleanedOpHash = opHash.startsWith('0x') ? opHash.substring(2) : opHash;
            const result = await this.client.getMetaTxnReceipt({ metaTxID: cleanedOpHash });
            const receipt = result.receipt;
            if (!receipt) {
                console.warn(`RpcRelayer.status: receipt not found for opHash ${opHash}`);
                return { status: 'unknown' };
            }
            if (!receipt.status) {
                console.warn(`RpcRelayer.status: receipt status not found for opHash ${opHash}`);
                return { status: 'unknown' };
            }
            switch (receipt.status) {
                case ETHTxnStatus.QUEUED:
                case ETHTxnStatus.PENDING_PRECONDITION:
                case ETHTxnStatus.SENT:
                    return { status: 'pending' };
                case ETHTxnStatus.SUCCEEDED:
                    return { status: 'confirmed', transactionHash: receipt.txnHash, data: result };
                case ETHTxnStatus.FAILED:
                case ETHTxnStatus.PARTIALLY_FAILED:
                    return {
                        status: 'failed',
                        transactionHash: receipt.txnHash ? receipt.txnHash : undefined,
                        reason: receipt.revertReason || 'Relayer reported failure',
                        data: result,
                    };
                case ETHTxnStatus.DROPPED:
                    return { status: 'failed', reason: 'Transaction dropped' };
                case ETHTxnStatus.UNKNOWN:
                default:
                    return { status: 'unknown' };
            }
        }
        catch (error) {
            console.error(`RpcRelayer.status failed for opHash ${opHash}:`, error);
            return { status: 'failed', reason: 'Failed to fetch status' };
        }
    }
    async checkPrecondition(precondition) {
        const decoded = decodePrecondition(precondition);
        if (!decoded) {
            return false;
        }
        switch (decoded.type()) {
            case 'native-balance': {
                const native = decoded;
                try {
                    const balance = await this.provider.getBalance({ address: native.address.toString() });
                    const minWei = native.min !== undefined ? BigInt(native.min) : undefined;
                    const maxWei = native.max !== undefined ? BigInt(native.max) : undefined;
                    if (minWei !== undefined && maxWei !== undefined) {
                        return balance >= minWei && balance <= maxWei;
                    }
                    if (minWei !== undefined) {
                        return balance >= minWei;
                    }
                    if (maxWei !== undefined) {
                        return balance <= maxWei;
                    }
                    // If no min or max specified, this is an invalid precondition
                    console.warn('Native balance precondition has neither min nor max specified');
                    return false;
                }
                catch (error) {
                    console.error('Error checking native balance:', error);
                    return false;
                }
            }
            case 'erc20-balance': {
                const erc20 = decoded;
                try {
                    const data = AbiFunction.encodeData(erc20BalanceOf, [erc20.address.toString()]);
                    const result = await this.provider.call({
                        to: erc20.token.toString(),
                        data: data,
                    });
                    const balance = BigInt(result.toString());
                    const minWei = erc20.min !== undefined ? BigInt(erc20.min) : undefined;
                    const maxWei = erc20.max !== undefined ? BigInt(erc20.max) : undefined;
                    if (minWei !== undefined && maxWei !== undefined) {
                        return balance >= minWei && balance <= maxWei;
                    }
                    if (minWei !== undefined) {
                        return balance >= minWei;
                    }
                    if (maxWei !== undefined) {
                        return balance <= maxWei;
                    }
                    console.warn('ERC20 balance precondition has neither min nor max specified');
                    return false;
                }
                catch (error) {
                    console.error('Error checking ERC20 balance:', error);
                    return false;
                }
            }
            case 'erc20-approval': {
                const erc20 = decoded;
                try {
                    const data = AbiFunction.encodeData(erc20Allowance, [erc20.address.toString(), erc20.operator.toString()]);
                    const result = await this.provider.call({
                        to: erc20.token.toString(),
                        data: data,
                    });
                    const allowance = BigInt(result.toString());
                    const minAllowance = BigInt(erc20.min);
                    return allowance >= minAllowance;
                }
                catch (error) {
                    console.error('Error checking ERC20 approval:', error);
                    return false;
                }
            }
            case 'erc721-ownership': {
                const erc721 = decoded;
                try {
                    const data = AbiFunction.encodeData(erc721OwnerOf, [erc721.tokenId]);
                    const result = await this.provider.call({
                        to: erc721.token.toString(),
                        data: data,
                    });
                    const resultHex = result.toString();
                    const owner = resultHex.slice(-40);
                    const isOwner = owner.toLowerCase() === erc721.address.toString().slice(2).toLowerCase();
                    const expectedOwnership = erc721.owned !== undefined ? erc721.owned : true;
                    return isOwner === expectedOwnership;
                }
                catch (error) {
                    console.error('Error checking ERC721 ownership:', error);
                    return false;
                }
            }
            case 'erc721-approval': {
                const erc721 = decoded;
                try {
                    const data = AbiFunction.encodeData(erc721GetApproved, [erc721.tokenId]);
                    const result = await this.provider.call({
                        to: erc721.token.toString(),
                        data: data,
                    });
                    const resultHex = result.toString();
                    const approved = resultHex.slice(-40);
                    return approved.toLowerCase() === erc721.operator.toString().slice(2).toLowerCase();
                }
                catch (error) {
                    console.error('Error checking ERC721 approval:', error);
                    return false;
                }
            }
            case 'erc1155-balance': {
                const erc1155 = decoded;
                try {
                    const data = AbiFunction.encodeData(erc1155BalanceOf, [erc1155.address.toString(), erc1155.tokenId]);
                    const result = await this.provider.call({
                        to: erc1155.token.toString(),
                        data: data,
                    });
                    const balance = BigInt(result.toString());
                    const minWei = erc1155.min !== undefined ? BigInt(erc1155.min) : undefined;
                    const maxWei = erc1155.max !== undefined ? BigInt(erc1155.max) : undefined;
                    if (minWei !== undefined && maxWei !== undefined) {
                        return balance >= minWei && balance <= maxWei;
                    }
                    if (minWei !== undefined) {
                        return balance >= minWei;
                    }
                    if (maxWei !== undefined) {
                        return balance <= maxWei;
                    }
                    console.warn('ERC1155 balance precondition has neither min nor max specified');
                    return false;
                }
                catch (error) {
                    console.error('Error checking ERC1155 balance:', error);
                    return false;
                }
            }
            case 'erc1155-approval': {
                const erc1155 = decoded;
                try {
                    const data = AbiFunction.encodeData(erc1155IsApprovedForAll, [
                        erc1155.address.toString(),
                        erc1155.operator.toString(),
                    ]);
                    const result = await this.provider.call({
                        to: erc1155.token.toString(),
                        data: data,
                    });
                    return BigInt(result.toString()) === 1n;
                }
                catch (error) {
                    console.error('Error checking ERC1155 approval:', error);
                    return false;
                }
            }
            default:
                return false;
        }
    }
    mapRpcFeeTokenToAddress(rpcToken) {
        if (rpcToken.type === FeeTokenType.ERC20_TOKEN && rpcToken.contractAddress) {
            return Address.from(rpcToken.contractAddress);
        }
        return Constants.ZeroAddress; // Default to zero address for native token or unsupported types
    }
}
