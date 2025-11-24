import { Config, Signature } from '@0xsequence/wallet-primitives';
import { Address } from 'ox';
export function isSignature(sig) {
    return typeof sig === 'object' && 'address' in sig && 'signature' in sig && !('imageHash' in sig);
}
export function isSapientSignature(sig) {
    return typeof sig === 'object' && 'signature' in sig && 'imageHash' in sig;
}
export function signatureForLeaf(envelope, leaf) {
    if (Config.isSignerLeaf(leaf)) {
        return envelope.signatures.find((sig) => isSignature(sig) && Address.isEqual(sig.address, leaf.address));
    }
    if (Config.isSapientSignerLeaf(leaf)) {
        return envelope.signatures.find((sig) => isSapientSignature(sig) &&
            sig.imageHash === leaf.imageHash &&
            Address.isEqual(sig.signature.address, leaf.address));
    }
    return undefined;
}
export function weightOf(envelope) {
    const { maxWeight } = Config.getWeight(envelope.configuration, (s) => !!signatureForLeaf(envelope, s));
    return {
        weight: maxWeight,
        threshold: envelope.configuration.threshold,
    };
}
export function reachedThreshold(envelope) {
    const { weight, threshold } = weightOf(envelope);
    return weight >= threshold;
}
export function encodeSignature(envelope) {
    const topology = Signature.fillLeaves(envelope.configuration.topology, (s) => signatureForLeaf(envelope, s)?.signature);
    return {
        noChainId: envelope.chainId === 0,
        configuration: { ...envelope.configuration, topology },
    };
}
export function toSigned(envelope, signatures = []) {
    return {
        ...envelope,
        signatures,
    };
}
export function addSignature(envelope, signature, args) {
    if (isSapientSignature(signature)) {
        // Find if the signature already exists in envelope
        const prev = envelope.signatures.find((sig) => isSapientSignature(sig) &&
            Address.isEqual(sig.signature.address, signature.signature.address) &&
            sig.imageHash === signature.imageHash);
        if (prev) {
            // If the signatures are identical, then we can do nothing
            if (prev.signature.data === signature.signature.data) {
                return;
            }
            // If not and we are replacing, then remove the previous signature
            if (args?.replace) {
                envelope.signatures = envelope.signatures.filter((sig) => sig !== prev);
            }
            else {
                throw new Error('Signature already defined for signer');
            }
        }
        envelope.signatures.push(signature);
    }
    else if (isSignature(signature)) {
        // Find if the signature already exists in envelope
        const prev = envelope.signatures.find((sig) => isSignature(sig) && Address.isEqual(sig.address, signature.address));
        if (prev) {
            // If the signatures are identical, then we can do nothing
            if (prev.signature.type === 'erc1271' && signature.signature.type === 'erc1271') {
                if (prev.signature.data === signature.signature.data) {
                    return;
                }
            }
            else if (prev.signature.type !== 'erc1271' && signature.signature.type !== 'erc1271') {
                if (prev.signature.r === signature.signature.r && prev.signature.s === signature.signature.s) {
                    return;
                }
            }
            // If not and we are replacing, then remove the previous signature
            if (args?.replace) {
                envelope.signatures = envelope.signatures.filter((sig) => sig !== prev);
            }
            else {
                throw new Error('Signature already defined for signer');
            }
        }
        envelope.signatures.push(signature);
    }
    else {
        throw new Error('Unsupported signature type');
    }
}
export function isSigned(envelope) {
    return typeof envelope === 'object' && 'signatures' in envelope;
}
