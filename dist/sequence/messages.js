import { Envelope, Wallet } from '@0xsequence/wallet-core';
import { Payload } from '@0xsequence/wallet-primitives';
import { Hex, Provider, RpcTransport } from 'ox';
import { v7 as uuidv7 } from 'uuid';
export class Messages {
    shared;
    constructor(shared) {
        this.shared = shared;
    }
    async list() {
        return this.shared.databases.messages.list();
    }
    async get(messageOrSignatureId) {
        return this.getByMessageOrSignatureId(messageOrSignatureId);
    }
    async getByMessageOrSignatureId(messageOrSignatureId) {
        const messages = await this.list();
        const message = messages.find((m) => m.id === messageOrSignatureId || m.signatureId === messageOrSignatureId);
        if (!message) {
            throw new Error(`Message ${messageOrSignatureId} not found`);
        }
        return message;
    }
    async request(from, message, chainId, options) {
        const wallet = new Wallet(from, { stateProvider: this.shared.sequence.stateProvider });
        // Prepare message payload
        const envelope = await wallet.prepareMessageSignature(message, chainId ?? 0);
        // Prepare signature request
        const signatureRequest = await this.shared.modules.signatures.request(envelope, 'sign-message', {
            origin: options?.source,
        });
        const id = uuidv7();
        await this.shared.databases.messages.set({
            id,
            wallet: from,
            message,
            envelope,
            source: options?.source ?? 'unknown',
            status: 'requested',
            signatureId: signatureRequest,
        });
        return signatureRequest;
    }
    async complete(messageOrSignatureId) {
        const message = await this.getByMessageOrSignatureId(messageOrSignatureId);
        if (message.status === 'signed') {
            // Return the message signature
            return message.messageSignature;
        }
        const messageId = message.id;
        const signature = await this.shared.modules.signatures.get(message.signatureId);
        if (!signature) {
            throw new Error(`Signature ${message.signatureId} not found for message ${messageId}`);
        }
        if (!Payload.isMessage(message.envelope.payload) || !Payload.isMessage(signature.envelope.payload)) {
            throw new Error(`Message ${messageId} is not a message payload`);
        }
        if (!Envelope.isSigned(signature.envelope)) {
            throw new Error(`Message ${messageId} is not signed`);
        }
        const signatureEnvelope = signature.envelope;
        const { weight, threshold } = Envelope.weightOf(signatureEnvelope);
        if (weight < threshold) {
            throw new Error(`Message ${messageId} has insufficient weight`);
        }
        // Get the provider for the message chain
        let provider;
        if (message.envelope.chainId !== 0) {
            const network = this.shared.sequence.networks.find((network) => network.chainId === message.envelope.chainId);
            if (!network) {
                throw new Error(`Network not found for ${message.envelope.chainId}`);
            }
            const transport = RpcTransport.fromHttp(network.rpcUrl);
            provider = Provider.from(transport);
        }
        const wallet = new Wallet(message.wallet, { stateProvider: this.shared.sequence.stateProvider });
        const messageSignature = Hex.from(await wallet.buildMessageSignature(signatureEnvelope, provider));
        await this.shared.databases.messages.set({
            ...message,
            envelope: signature.envelope,
            status: 'signed',
            messageSignature,
        });
        await this.shared.modules.signatures.complete(signature.id);
        return messageSignature;
    }
    onMessagesUpdate(cb, trigger) {
        const undo = this.shared.databases.messages.addListener(() => {
            this.list().then((l) => cb(l));
        });
        if (trigger) {
            this.list().then((l) => cb(l));
        }
        return undo;
    }
    onMessageUpdate(messageId, cb, trigger) {
        const undo = this.shared.databases.messages.addListener(() => {
            this.get(messageId).then((t) => cb(t));
        });
        if (trigger) {
            this.get(messageId).then((t) => cb(t));
        }
        return undo;
    }
    async delete(messageOrSignatureId) {
        try {
            const message = await this.getByMessageOrSignatureId(messageOrSignatureId);
            await this.shared.databases.signatures.del(message.signatureId);
            await this.shared.databases.messages.del(message.id);
        }
        catch (error) {
            // Ignore
        }
    }
}
