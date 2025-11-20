import { Shared } from './manager.js';
/**
 * Cron manages scheduled jobs, persisting their last run times and ensuring
 * jobs are executed at their specified intervals.
 */
export declare class Cron {
    private readonly shared;
    private jobs;
    private checkInterval?;
    private readonly STORAGE_KEY;
    private isStopping;
    private currentCheckJobsPromise;
    /**
     * Initializes the Cron scheduler and starts the periodic job checker.
     * @param shared Shared context for modules and logging.
     */
    constructor(shared: Shared);
    /**
     * Starts the periodic job checking loop.
     * Does nothing if the Cron is stopping.
     */
    private start;
    /**
     * Chains job checks to ensure sequential execution.
     * Handles errors from previous executions to avoid breaking the chain.
     */
    private executeCheckJobsChain;
    /**
     * Stops the Cron scheduler, clears the interval, and waits for any running job checks to finish.
     */
    stop(): Promise<void>;
    /**
     * Registers a new cron job.
     * @param id Unique job identifier.
     * @param interval Execution interval in milliseconds.
     * @param handler Async function to execute.
     * @throws If a job with the same ID already exists.
     */
    registerJob(id: string, interval: number, handler: () => Promise<void>): void;
    /**
     * Unregisters a cron job by its ID.
     * @param id Job identifier to remove.
     */
    unregisterJob(id: string): void;
    /**
     * Checks all registered jobs and executes those whose interval has elapsed.
     * Updates last run times and persists state.
     * Uses a lock to prevent concurrent execution.
     */
    private checkJobs;
    /**
     * Loads the persisted last run times for jobs from localStorage.
     * @returns Map of job IDs to their last run times.
     */
    private getStorageState;
    /**
     * Persists the current last run times of all jobs to localStorage.
     */
    private syncWithStorage;
}
//# sourceMappingURL=cron.d.ts.map