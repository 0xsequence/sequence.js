import { Shared } from './manager.js';
export declare class Cron {
    private readonly shared;
    private jobs;
    private checkInterval?;
    private readonly STORAGE_KEY;
    private isStopping;
    private currentCheckJobsPromise;
    constructor(shared: Shared);
    private start;
    private executeCheckJobsChain;
    stop(): Promise<void>;
    registerJob(id: string, interval: number, handler: () => Promise<void>): void;
    unregisterJob(id: string): void;
    private checkJobs;
    private getStorageState;
    private syncWithStorage;
}
//# sourceMappingURL=cron.d.ts.map