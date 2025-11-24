import { Payload } from '@0xsequence/wallet-primitives';
import { Address, Hex } from 'ox';
import { Kinds } from './types/signer.js';
export function isWitnessExtraSignerKind(extra) {
    return typeof extra === 'object' && extra !== null && 'signerKind' in extra;
}
function toKnownKind(kind) {
    if (Object.values(Kinds).includes(kind)) {
        return kind;
    }
    console.warn(`Unknown signer kind: ${kind}`);
    return Kinds.Unknown;
}
// Signers is in charge to know (or figure out) the "kind" of each signer
// i.e., when a signature is requested, we only get address and imageHash (if sapient)
// this module takes care of figuring out the kind of signer (e.g., device, passkey, recovery, etc.)
export class Signers {
    shared;
    constructor(shared) {
        this.shared = shared;
    }
    async kindOf(wallet, address, imageHash) {
        // // The device may be among the local devices, in that case it is a local device
        // // TODO: Maybe signers shouldn't be getting in the way of devices, it feels like a
        // //      different concern
        // if (await this.devices.has(address)) {
        //   return Kinds.LocalDevice
        // }
        // Some signers are known by the configuration of the wallet development kit, specifically
        // some of the sapient signers, who always share the same address
        if (Address.isEqual(this.shared.sequence.extensions.recovery, address)) {
            return Kinds.Recovery;
        }
        if (Array.from(Object.values(this.shared.sequence.guardAddresses)).some((guardAddress) => Address.isEqual(guardAddress, address))) {
            return Kinds.Guard;
        }
        // We need to use the state provider (and witness) this will tell us the kind of signer
        // NOTICE: This looks expensive, but this operation should be cached by the state provider
        const witness = await (imageHash
            ? this.shared.sequence.stateProvider.getWitnessForSapient(wallet, address, imageHash)
            : this.shared.sequence.stateProvider.getWitnessFor(wallet, address));
        if (!witness) {
            return undefined;
        }
        // Parse the payload, it may have the kind of signer
        if (!Payload.isMessage(witness.payload)) {
            return undefined;
        }
        try {
            const message = JSON.parse(Hex.toString(witness.payload.message));
            if (isWitnessExtraSignerKind(message)) {
                return toKnownKind(message.signerKind);
            }
        }
        catch { }
        return undefined;
    }
    async resolveKinds(wallet, signers) {
        return Promise.all(signers.map(async (signer) => {
            if (typeof signer === 'string') {
                const kind = await this.kindOf(wallet, signer);
                return {
                    address: signer,
                    kind,
                };
            }
            else {
                const kind = await this.kindOf(wallet, signer.address, signer.imageHash);
                return {
                    address: signer.address,
                    imageHash: signer.imageHash,
                    kind,
                };
            }
        }));
    }
}
