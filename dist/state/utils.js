import { Address, Hex } from 'ox';
import { isSapientSigner } from '../signers/index.js';
export async function getWalletsFor(stateReader, signer) {
    const wallets = await retrieveWallets(stateReader, signer);
    return Object.entries(wallets).map(([wallet, { chainId, payload, signature }]) => {
        Hex.assert(wallet);
        return {
            wallet,
            chainId,
            payload,
            signature,
        };
    });
}
async function retrieveWallets(stateReader, signer) {
    if (isSapientSigner(signer)) {
        const [signerAddress, signerImageHash] = await Promise.all([signer.address, signer.imageHash]);
        if (signerImageHash) {
            return stateReader.getWalletsForSapient(signerAddress, signerImageHash);
        }
        else {
            console.warn('Sapient signer has no imageHash');
            return {};
        }
    }
    else {
        return stateReader.getWallets(await signer.address);
    }
}
export function normalizeAddressKeys(obj) {
    return Object.fromEntries(Object.entries(obj).map(([wallet, signature]) => {
        const checksumAddress = Address.checksum(wallet);
        return [checksumAddress, signature];
    }));
}
