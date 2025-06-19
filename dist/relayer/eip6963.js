import { createStore } from 'mipd';
import { EIP1193ProviderAdapter, LocalRelayer } from './local.js';
export class EIP6963Relayer extends LocalRelayer {
    info;
    constructor(detail) {
        super(new EIP1193ProviderAdapter(detail.provider));
        this.info = detail.info;
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
