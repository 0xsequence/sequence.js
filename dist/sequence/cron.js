/**
 * Cron manages scheduled jobs, persisting their last run times and ensuring
 * jobs are executed at their specified intervals.
 */
export class Cron {
    shared;
    jobs = new Map();
    checkInterval;
    STORAGE_KEY = 'sequence-cron-jobs';
    isStopping = false;
    currentCheckJobsPromise = Promise.resolve();
    /**
     * Initializes the Cron scheduler and starts the periodic job checker.
     * @param shared Shared context for modules and logging.
     */
    constructor(shared) {
        this.shared = shared;
        this.start();
    }
    /**
     * Starts the periodic job checking loop.
     * Does nothing if the Cron is stopping.
     */
    start() {
        if (this.isStopping)
            return;
        this.executeCheckJobsChain();
        this.checkInterval = setInterval(() => this.executeCheckJobsChain(), 60 * 1000);
    }
    /**
     * Chains job checks to ensure sequential execution.
     * Handles errors from previous executions to avoid breaking the chain.
     */
    executeCheckJobsChain() {
        this.currentCheckJobsPromise = this.currentCheckJobsPromise
            .catch(() => { }) // Ignore errors from previous chain link for sequencing
            .then(() => {
            if (!this.isStopping) {
                return this.checkJobs();
            }
            return Promise.resolve();
        });
    }
    /**
     * Stops the Cron scheduler, clears the interval, and waits for any running job checks to finish.
     */
    async stop() {
        this.isStopping = true;
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = undefined;
            this.shared.modules.logger.log('Cron: Interval cleared.');
        }
        // Wait for the promise of the last (or current) checkJobs execution
        await this.currentCheckJobsPromise.catch((err) => {
            console.error('Cron: Error during currentCheckJobsPromise settlement in stop():', err);
        });
    }
    /**
     * Registers a new cron job.
     * @param id Unique job identifier.
     * @param interval Execution interval in milliseconds.
     * @param handler Async function to execute.
     * @throws If a job with the same ID already exists.
     */
    registerJob(id, interval, handler) {
        if (this.jobs.has(id)) {
            throw new Error(`Job with ID ${id} already exists`);
        }
        const job = { id, interval, lastRun: 0, handler };
        this.jobs.set(id, job);
        // No syncWithStorage needed here, it happens in checkJobs
    }
    /**
     * Unregisters a cron job by its ID.
     * @param id Job identifier to remove.
     */
    unregisterJob(id) {
        this.jobs.delete(id);
    }
    /**
     * Checks all registered jobs and executes those whose interval has elapsed.
     * Updates last run times and persists state.
     * Uses a lock to prevent concurrent execution.
     */
    async checkJobs() {
        if (this.isStopping) {
            return;
        }
        try {
            await navigator.locks.request('sequence-cron-jobs', async (lock) => {
                if (this.isStopping) {
                    return;
                }
                if (!lock) {
                    return;
                }
                const now = Date.now();
                const storage = await this.getStorageState();
                for (const [id, job] of this.jobs) {
                    if (this.isStopping) {
                        break;
                    }
                    const lastRun = storage.get(id)?.lastRun ?? job.lastRun;
                    const timeSinceLastRun = now - lastRun;
                    if (timeSinceLastRun >= job.interval) {
                        try {
                            await job.handler();
                            if (!this.isStopping) {
                                job.lastRun = now;
                                storage.set(id, { lastRun: now });
                            }
                        }
                        catch (error) {
                            if (error instanceof DOMException && error.name === 'AbortError') {
                                this.shared.modules.logger.log(`Cron: Job ${id} was aborted.`);
                            }
                            else {
                                console.error(`Cron job ${id} failed:`, error);
                            }
                        }
                    }
                }
                if (!this.isStopping) {
                    await this.syncWithStorage();
                }
            });
        }
        catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                this.shared.modules.logger.log('Cron: navigator.locks.request was aborted.');
            }
            else {
                console.error('Cron: Error in navigator.locks.request:', error);
            }
        }
    }
    /**
     * Loads the persisted last run times for jobs from localStorage.
     * @returns Map of job IDs to their last run times.
     */
    async getStorageState() {
        if (this.isStopping)
            return new Map();
        const state = localStorage.getItem(this.STORAGE_KEY);
        return new Map(state ? JSON.parse(state) : []);
    }
    /**
     * Persists the current last run times of all jobs to localStorage.
     */
    async syncWithStorage() {
        if (this.isStopping)
            return;
        const state = Array.from(this.jobs.entries()).map(([id, job]) => [id, { lastRun: job.lastRun }]);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    }
}
