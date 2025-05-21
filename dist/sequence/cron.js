export class Cron {
    shared;
    jobs = new Map();
    checkInterval;
    STORAGE_KEY = 'sequence-cron-jobs';
    isStopping = false;
    currentCheckJobsPromise = Promise.resolve();
    constructor(shared) {
        this.shared = shared;
        this.start();
    }
    start() {
        if (this.isStopping)
            return;
        this.executeCheckJobsChain();
        this.checkInterval = setInterval(() => this.executeCheckJobsChain(), 60 * 1000);
    }
    // Wraps checkJobs to chain executions and manage currentCheckJobsPromise
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
    registerJob(id, interval, handler) {
        if (this.jobs.has(id)) {
            throw new Error(`Job with ID ${id} already exists`);
        }
        const job = { id, interval, lastRun: 0, handler };
        this.jobs.set(id, job);
        // No syncWithStorage needed here, it happens in checkJobs
    }
    unregisterJob(id) {
        this.jobs.delete(id);
    }
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
                            else {
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
    async getStorageState() {
        if (this.isStopping)
            return new Map();
        const state = localStorage.getItem(this.STORAGE_KEY);
        return new Map(state ? JSON.parse(state) : []);
    }
    async syncWithStorage() {
        if (this.isStopping)
            return;
        const state = Array.from(this.jobs.entries()).map(([id, job]) => [id, { lastRun: job.lastRun }]);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    }
}
