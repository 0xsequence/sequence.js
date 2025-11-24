import { createStore } from 'mipd';
import { EIP1193ProviderAdapter, LocalRelayer } from './local.js';
export class EIP6963Relayer {
    kind = 'relayer';
    type = 'eip6963';
    id;
    info;
    relayer;
    constructor(detail) {
        this.info = detail.info;
        this.id = detail.info.uuid;
        this.relayer = new LocalRelayer(new EIP1193ProviderAdapter(detail.provider));
    }
    isAvailable(wallet, chainId) {
        return this.relayer.isAvailable(wallet, chainId);
    }
    feeTokens() {
        return this.relayer.feeTokens();
    }
    feeOptions(wallet, chainId, calls) {
        return this.relayer.feeOptions(wallet, chainId, calls);
    }
    async relay(to, data, chainId, _) {
        return this.relayer.relay(to, data, chainId);
    }
    status(opHash, chainId) {
        return this.relayer.status(opHash, chainId);
    }
    async checkPrecondition(precondition) {
        return this.relayer.checkPrecondition(precondition);
    }
}
// Global store instance
let store;
export function getEIP6963Store() {
    if (!store) {
        store = createStore();
    }
    return store;
}
let relayers = new Map();
export function getRelayers() {
    const store = getEIP6963Store();
    const providers = store.getProviders();
    for (const detail of providers) {
        if (!relayers.has(detail.info.uuid)) {
            relayers.set(detail.info.uuid, new EIP6963Relayer(detail));
        }
    }
    return Array.from(relayers.values());
}
