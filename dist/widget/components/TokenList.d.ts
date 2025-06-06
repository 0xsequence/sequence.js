import React from 'react';
import { SequenceIndexerGateway } from '@0xsequence/indexer';
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
interface TokenListProps {
    onContinue: (selectedToken: Token) => void;
    onBack: () => void;
    indexerGatewayClient: SequenceIndexerGateway;
}
export declare const TokenList: React.FC<TokenListProps>;
export default TokenList;
//# sourceMappingURL=TokenList.d.ts.map