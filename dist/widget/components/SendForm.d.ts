import React from 'react';
import { type Account } from 'viem';
interface Token {
    id: number;
    name: string;
    symbol: string;
    balance: string;
    imageUrl: string;
    chainId: number;
    contractAddress: string;
    contractInfo?: {
        decimals: number;
        symbol: string;
        name: string;
    };
}
interface SendFormProps {
    selectedToken: Token;
    onSend: (amount: string, recipient: string) => void;
    onBack: () => void;
    onConfirm: () => void;
    onComplete: () => void;
    account: Account;
    sequenceApiKey: string;
    apiUrl: string;
    env?: 'local' | 'cors-anywhere' | 'dev' | 'prod';
}
export declare const SendForm: React.FC<SendFormProps>;
export default SendForm;
//# sourceMappingURL=SendForm.d.ts.map