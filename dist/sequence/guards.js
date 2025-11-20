import { Address, Bytes } from 'ox';
import * as Guard from '@0xsequence/guard';
import { Signers } from '@0xsequence/wallet-core';
import { Config, Constants } from '@0xsequence/wallet-primitives';
export class Guards {
    shared;
    constructor(shared) {
        this.shared = shared;
    }
    getByRole(role) {
        const guardAddress = this.shared.sequence.guardAddresses[role];
        if (!guardAddress) {
            throw new Error(`Guard address for role ${role} not found`);
        }
        return new Signers.Guard(new Guard.Sequence.Guard(this.shared.sequence.guardUrl, guardAddress));
    }
    getByAddress(address) {
        const roles = Object.entries(this.shared.sequence.guardAddresses);
        for (const [role, guardAddress] of roles) {
            if (Address.isEqual(guardAddress, address)) {
                return [role, this.getByRole(role)];
            }
        }
        return undefined;
    }
    topology(role) {
        const guardAddress = this.shared.sequence.guardAddresses[role];
        if (!guardAddress) {
            return undefined;
        }
        const topology = Config.replaceAddress(this.shared.sequence.defaultGuardTopology, Constants.PlaceholderAddress, guardAddress);
        // If the imageHash did not change it means the replacement failed
        if (Bytes.isEqual(Config.hashConfiguration(topology), Config.hashConfiguration(this.shared.sequence.defaultGuardTopology))) {
            throw new Error(`Guard address replacement failed for role ${role}`);
        }
        return topology;
    }
}
