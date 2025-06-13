import { Address } from 'ox';
import { Shared } from './manager.js';
import { Message, MessageRequest } from './types/message-request.js';
export declare class Messages {
    private readonly shared;
    constructor(shared: Shared);
    list(): Promise<Message[]>;
    get(messageOrSignatureId: string): Promise<Message>;
    private getByMessageOrSignatureId;
    request(from: Address.Address, message: MessageRequest, chainId?: bigint, options?: {
        source?: string;
    }): Promise<string>;
    complete(messageOrSignatureId: string): Promise<string>;
    onMessagesUpdate(cb: (messages: Message[]) => void, trigger?: boolean): () => void;
    onMessageUpdate(messageId: string, cb: (message: Message) => void, trigger?: boolean): () => void;
    delete(messageOrSignatureId: string): Promise<void>;
}
//# sourceMappingURL=messages.d.ts.map