import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
const POLL_INTERVAL = 3_000; // 3 seconds
export const getMetaTxStatus = async (relayer, metaTxId, chainId) => {
    return relayer.status(metaTxId, BigInt(chainId));
};
export const useMetaTxnsMonitor = (metaTxns, getRelayer) => {
    const results = useQueries({
        queries: (metaTxns || []).map((metaTxn) => {
            const opHashToPoll = metaTxn.id;
            return {
                queryKey: ['metaTxnStatus', metaTxn.chainId, metaTxn.id],
                queryFn: async () => {
                    const relayer = getRelayer(parseInt(metaTxn.chainId));
                    if (!opHashToPoll) {
                        return {
                            status: 'failed',
                            reason: 'Missing operation hash for monitoring.',
                        };
                    }
                    if (!relayer) {
                        return {
                            status: 'failed',
                            reason: `Relayer not available for chain ${metaTxn.chainId}.`,
                        };
                    }
                    const opStatus = await relayer.status(opHashToPoll, BigInt(metaTxn.chainId));
                    let newStatusEntry;
                    if (opStatus.status === 'confirmed') {
                        newStatusEntry = {
                            status: 'confirmed',
                            transactionHash: opStatus.transactionHash,
                            data: opStatus.data,
                        };
                    }
                    else if (opStatus.status === 'failed') {
                        newStatusEntry = {
                            status: 'failed',
                            reason: opStatus.reason,
                            data: opStatus.data,
                        };
                    }
                    else if (opStatus.status === 'pending') {
                        newStatusEntry = { status: 'pending' };
                    }
                    else if (opStatus.status === 'unknown') {
                        newStatusEntry = { status: 'unknown' };
                    }
                    else {
                        const originalStatus = opStatus.status;
                        console.warn(`⚠️ Unexpected relayer status "${originalStatus}" for ${opHashToPoll}:`, opStatus);
                        newStatusEntry = { status: 'unknown' };
                    }
                    return newStatusEntry;
                },
                refetchInterval: (query) => {
                    const data = query.state.data;
                    if (!data)
                        return POLL_INTERVAL;
                    if (data.status === 'confirmed')
                        return false;
                    return POLL_INTERVAL;
                },
                enabled: !!metaTxn && !!metaTxn.id && !!metaTxn.chainId,
                retry: (failureCount, error) => {
                    if (failureCount >= 30) {
                        console.error(`❌ Giving up on transaction ${opHashToPoll} after 3 failed API attempts:`, error);
                        return false;
                    }
                    return true;
                },
            };
        }),
    });
    const statuses = useMemo(() => {
        const newStatuses = {};
        (metaTxns || []).forEach((metaTxn, index) => {
            const operationKey = `${metaTxn.chainId}-${metaTxn.id}`;
            const queryResult = results[index];
            if (queryResult) {
                if (queryResult.isLoading && queryResult.fetchStatus !== 'idle' && !queryResult.data) {
                    newStatuses[operationKey] = { status: 'pending' };
                }
                else if (queryResult.isError) {
                    newStatuses[operationKey] = {
                        status: 'failed',
                        reason: queryResult.error?.message || 'An unknown error occurred',
                    };
                }
                else if (queryResult.data) {
                    newStatuses[operationKey] = queryResult.data;
                }
                else {
                    newStatuses[operationKey] = { status: 'unknown' };
                }
            }
            else {
                newStatuses[operationKey] = {
                    status: 'failed',
                    reason: 'Query result unexpectedly missing',
                };
            }
        });
        return newStatuses;
    }, [metaTxns, results]);
    return statuses;
};
