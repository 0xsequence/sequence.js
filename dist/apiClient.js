import { SequenceAPIClient } from '@0xsequence/api';
import { useMemo } from 'react';
import { useConfig } from '@0xsequence/hooks';
export function getAPIClient(config) {
    return new SequenceAPIClient(config.apiUrl, config.projectAccessKey, config.jwt);
}
export const useAPIClient = (config) => {
    const { projectAccessKey, jwt, env } = useConfig();
    const apiClient = useMemo(() => {
        return getAPIClient({
            apiUrl: config?.apiUrl ?? env.apiUrl,
            projectAccessKey: config?.projectAccessKey ?? projectAccessKey,
            jwt: config?.jwt ?? jwt,
        });
    }, [projectAccessKey, jwt, env.apiUrl, config]);
    return apiClient;
};
