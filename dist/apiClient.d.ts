import { SequenceAPIClient } from '@0xsequence/api';
export type APIClientConfig = {
    apiUrl?: string;
    projectAccessKey?: string;
    jwt?: string;
};
export declare function getAPIClient(config: APIClientConfig): SequenceAPIClient;
export declare const useAPIClient: (config?: APIClientConfig) => SequenceAPIClient;
//# sourceMappingURL=apiClient.d.ts.map