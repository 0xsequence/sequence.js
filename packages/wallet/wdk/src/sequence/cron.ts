import { Shared } from './manager.js'

interface CronJob {
  id: string
  interval: number
  lastRun: number
  handler: () => Promise<void>
}

/**
 * Cron manages scheduled jobs, persisting their last run times and ensuring
 * jobs are executed at their specified intervals.
 */
export class Cron {
  private jobs: Map<string, CronJob> = new Map()
  private checkInterval?: ReturnType<typeof setInterval>
  private readonly STORAGE_KEY = 'sequence-cron-jobs'
  private isStopping: boolean = false
  private currentCheckJobsPromise: Promise<void> = Promise.resolve()
  private readonly env: Shared['env']

  /**
   * Initializes the Cron scheduler and starts the periodic job checker.
   * @param shared Shared context for modules and logging.
   */
  constructor(private readonly shared: Shared) {
    this.env = shared.env
    this.start()
  }

  /**
   * Starts the periodic job checking loop.
   * Does nothing if the Cron is stopping.
   */
  private start() {
    if (this.isStopping) return
    this.executeCheckJobsChain()
    const setIntervalFn = this.env.timers?.setInterval ?? (globalThis as any).setInterval
    if (!setIntervalFn) {
      return
    }
    this.checkInterval = setIntervalFn(() => this.executeCheckJobsChain(), 60 * 1000)
  }

  /**
   * Chains job checks to ensure sequential execution.
   * Handles errors from previous executions to avoid breaking the chain.
   */
  private executeCheckJobsChain(): void {
    this.currentCheckJobsPromise = this.currentCheckJobsPromise
      .catch(() => {}) // Ignore errors from previous chain link for sequencing
      .then(() => {
        if (!this.isStopping) {
          return this.checkJobs()
        }
        return Promise.resolve()
      })
  }

  /**
   * Stops the Cron scheduler, clears the interval, and waits for any running job checks to finish.
   */
  public async stop(): Promise<void> {
    this.isStopping = true

    if (this.checkInterval) {
      const clearIntervalFn = this.env.timers?.clearInterval ?? (globalThis as any).clearInterval
      if (clearIntervalFn) {
        clearIntervalFn(this.checkInterval)
      }
      this.checkInterval = undefined
      this.shared.modules.logger.log('Cron: Interval cleared.')
    }

    // Wait for the promise of the last (or current) checkJobs execution
    await this.currentCheckJobsPromise.catch((err) => {
      console.error('Cron: Error during currentCheckJobsPromise settlement in stop():', err)
    })
  }

  /**
   * Registers a new cron job.
   * @param id Unique job identifier.
   * @param interval Execution interval in milliseconds.
   * @param handler Async function to execute.
   * @throws If a job with the same ID already exists.
   */
  registerJob(id: string, interval: number, handler: () => Promise<void>) {
    if (this.jobs.has(id)) {
      throw new Error(`Job with ID ${id} already exists`)
    }
    const job: CronJob = { id, interval, lastRun: 0, handler }
    this.jobs.set(id, job)
    // No syncWithStorage needed here, it happens in checkJobs
  }

  /**
   * Unregisters a cron job by its ID.
   * @param id Job identifier to remove.
   */
  unregisterJob(id: string) {
    this.jobs.delete(id)
  }

  /**
   * Checks all registered jobs and executes those whose interval has elapsed.
   * Updates last run times and persists state.
   * Uses a lock to prevent concurrent execution.
   */
  private async checkJobs(): Promise<void> {
    if (this.isStopping) {
      return
    }

    try {
      const locks = this.env.locks ?? (globalThis as any).navigator?.locks
      if (locks?.request) {
        await locks.request('sequence-cron-jobs', async (lock: Lock | null) => {
          if (this.isStopping) {
            return
          }
          if (!lock) {
            return
          }
          await this.runJobs()
        })
      } else {
        await this.runJobs()
      }
    } catch (error) {
      if (this.isAbortError(error)) {
        this.shared.modules.logger.log('Cron: navigator.locks.request was aborted.')
      } else {
        console.error('Cron: Error in navigator.locks.request:', error)
      }
    }
  }

  private async runJobs(): Promise<void> {
    const now = Date.now()
    const storage = await this.getStorageState()

    for (const [id, job] of this.jobs) {
      if (this.isStopping) {
        break
      }

      const lastRun = storage.get(id)?.lastRun ?? job.lastRun
      const timeSinceLastRun = now - lastRun

      if (timeSinceLastRun >= job.interval) {
        try {
          await job.handler()
          if (!this.isStopping) {
            job.lastRun = now
            storage.set(id, { lastRun: now })
          }
        } catch (error) {
          if (this.isAbortError(error)) {
            this.shared.modules.logger.log(`Cron: Job ${id} was aborted.`)
          } else {
            console.error(`Cron job ${id} failed:`, error)
          }
        }
      }
    }

    if (!this.isStopping) {
      await this.syncWithStorage()
    }
  }

  /**
   * Loads the persisted last run times for jobs from localStorage.
   * @returns Map of job IDs to their last run times.
   */
  private async getStorageState(): Promise<Map<string, { lastRun: number }>> {
    if (this.isStopping) return new Map()
    const storage = this.env.storage
    if (!storage) {
      return new Map()
    }
    const state = storage.getItem(this.STORAGE_KEY)
    return new Map(state ? JSON.parse(state) : [])
  }

  /**
   * Persists the current last run times of all jobs to localStorage.
   */
  private async syncWithStorage() {
    if (this.isStopping) return
    const storage = this.env.storage
    if (!storage) {
      return
    }
    const state = Array.from(this.jobs.entries()).map(([id, job]) => [id, { lastRun: job.lastRun }])
    storage.setItem(this.STORAGE_KEY, JSON.stringify(state))
  }

  private isAbortError(error: unknown): boolean {
    const domException = (globalThis as any).DOMException
    if (domException && error instanceof domException) {
      return (error as DOMException).name === 'AbortError'
    }
    return (error as any)?.name === 'AbortError'
  }
}
