import { AbiParameters, Address, Bytes, ContractAddress, Hash } from 'ox';
import { Config, Payload } from '@0xsequence/wallet-primitives';
// import { ANYPAY_LIFI_SAPIENT_SIGNER_ADDRESS } from './constants.js'
import { ANYPAY_LIFI_SAPIENT_SIGNER_LITE_ADDRESS } from './constants.js';
export function hashIntentParams(params) {
    if (!params)
        throw new Error('params is nil');
    if (!params.userAddress || params.userAddress === '0x0000000000000000000000000000000000000000')
        throw new Error('UserAddress is zero');
    if (typeof params.nonce !== 'bigint')
        throw new Error('Nonce is not a bigint');
    if (!params.originTokens || params.originTokens.length === 0)
        throw new Error('OriginTokens is empty');
    if (!params.destinationCalls || params.destinationCalls.length === 0)
        throw new Error('DestinationCalls is empty');
    if (!params.destinationTokens || params.destinationTokens.length === 0)
        throw new Error('DestinationTokens is empty');
    for (let i = 0; i < params.destinationCalls.length; i++) {
        const currentCall = params.destinationCalls[i];
        if (!currentCall)
            throw new Error(`DestinationCalls[${i}] is nil`);
        if (!currentCall.calls || currentCall.calls.length === 0) {
            throw new Error(`DestinationCalls[${i}] has no calls`);
        }
    }
    const originTokensForAbi = params.originTokens.map((token) => ({
        address: token.address,
        chainId: token.chainId,
    }));
    let cumulativeCallsHashBytes = Bytes.from(new Uint8Array(32));
    for (let i = 0; i < params.destinationCalls.length; i++) {
        const callPayload = params.destinationCalls[i];
        const currentDestCallPayloadHashBytes = Payload.hash(Address.from('0x0000000000000000000000000000000000000000'), callPayload.chainId, callPayload);
        cumulativeCallsHashBytes = Hash.keccak256(Bytes.concat(cumulativeCallsHashBytes, currentDestCallPayloadHashBytes), {
            as: 'Bytes',
        });
    }
    const cumulativeCallsHashHex = Bytes.toHex(cumulativeCallsHashBytes);
    const destinationTokensForAbi = params.destinationTokens.map((token) => ({
        address: token.address,
        chainId: token.chainId,
        amount: token.amount,
    }));
    const abiSchema = [
        { type: 'address' },
        { type: 'uint256' },
        {
            type: 'tuple[]',
            components: [
                { name: 'address', type: 'address' },
                { name: 'chainId', type: 'uint256' },
            ],
        },
        {
            type: 'tuple[]',
            components: [
                { name: 'address', type: 'address' },
                { name: 'chainId', type: 'uint256' },
                { name: 'amount', type: 'uint256' },
            ],
        },
        { type: 'bytes32' },
    ];
    const encodedHex = AbiParameters.encode(abiSchema, [
        params.userAddress,
        params.nonce,
        originTokensForAbi,
        destinationTokensForAbi,
        cumulativeCallsHashHex,
    ]);
    function bigintReplacer(_key, value) {
        return typeof value === 'bigint' ? value.toString() : value;
    }
    const encodedBytes = Bytes.fromHex(encodedHex);
    const hashBytes = Hash.keccak256(encodedBytes);
    const hashHex = Bytes.toHex(hashBytes);
    return hashHex;
}
export function getAnypayLifiInfoHash(lifiInfos, attestationAddress) {
    if (!lifiInfos || lifiInfos.length === 0) {
        throw new Error('lifiInfos is empty');
    }
    if (!attestationAddress || attestationAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error('attestationAddress is zero');
    }
    const anypayLifiInfoComponents = [
        { name: 'originToken', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'originChainId', type: 'uint256' },
        { name: 'destinationChainId', type: 'uint256' },
    ];
    const lifiInfosForAbi = lifiInfos.map((info) => ({
        originToken: info.originToken,
        amount: info.amount,
        originChainId: info.originChainId,
        destinationChainId: info.destinationChainId,
    }));
    const abiSchema = [
        {
            type: 'tuple[]',
            name: 'lifiInfos',
            components: anypayLifiInfoComponents,
        },
        { type: 'address', name: 'attestationAddress' },
    ];
    const encodedHex = AbiParameters.encode(abiSchema, [lifiInfosForAbi, attestationAddress]);
    const encodedBytes = Bytes.fromHex(encodedHex);
    const hashBytes = Hash.keccak256(encodedBytes);
    return Bytes.toHex(hashBytes);
}
export function calculateIntentConfigurationAddress(mainSigner, calls, context, attestationSigner, lifiInfos) {
    const config = createIntentConfiguration(mainSigner, calls, attestationSigner, lifiInfos);
    // Calculate the image hash of the configuration
    const imageHash = Config.hashConfiguration(config);
    // Calculate the counterfactual address using the image hash and context
    return ContractAddress.fromCreate2({
        from: context.factory,
        bytecodeHash: Hash.keccak256(Bytes.concat(Bytes.from(context.creationCode), Bytes.padLeft(Bytes.from(context.stage1), 32)), { as: 'Bytes' }),
        salt: imageHash,
    });
}
function createIntentConfiguration(mainSigner, calls, attestationSigner, lifiInfos) {
    const mainSignerLeaf = {
        type: 'signer',
        address: mainSigner,
        weight: 1n,
    };
    const subdigestLeaves = calls.map((call) => {
        const digest = Payload.hash(Address.from('0x0000000000000000000000000000000000000000'), call.chainId, call);
        console.log('digest:', Bytes.toHex(digest));
        return {
            type: 'any-address-subdigest',
            digest: Bytes.toHex(digest),
        };
    });
    let otherLeaves = [...subdigestLeaves];
    if (lifiInfos && lifiInfos.length > 0) {
        if (attestationSigner) {
            const lifiConditionLeaf = {
                type: 'sapient-signer',
                // address: ANYPAY_LIFI_SAPIENT_SIGNER_ADDRESS,
                address: ANYPAY_LIFI_SAPIENT_SIGNER_LITE_ADDRESS,
                weight: 1n,
                imageHash: getAnypayLifiInfoHash(lifiInfos, attestationSigner),
            };
            otherLeaves.push(lifiConditionLeaf);
        }
    }
    if (otherLeaves.length === 0) {
        throw new Error('Intent configuration must have at least one call or LiFi information.');
    }
    let secondaryTopologyNode;
    if (otherLeaves.length === 1) {
        secondaryTopologyNode = otherLeaves[0];
    }
    else {
        secondaryTopologyNode = buildMerkleTreeFromMembers(otherLeaves);
    }
    return {
        threshold: 1n,
        checkpoint: 0n,
        topology: [mainSignerLeaf, secondaryTopologyNode],
    };
}
// Renamed and generalized from createSubdigestTree
function buildMerkleTreeFromMembers(members) {
    if (members.length === 0) {
        throw new Error('Cannot create a tree from empty members');
    }
    if (members.length === 1) {
        return members[0]; // Returns a single Leaf or a Node
    }
    let currentLevel = [...members];
    while (currentLevel.length > 1) {
        const nextLevel = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            if (i + 1 < currentLevel.length) {
                const right = currentLevel[i + 1];
                nextLevel.push([left, right]);
            }
            else {
                // Odd one out, carries over to the next level
                nextLevel.push(left);
            }
        }
        currentLevel = nextLevel;
    }
    return currentLevel[0];
}
