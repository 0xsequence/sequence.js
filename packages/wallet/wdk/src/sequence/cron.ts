import { Shared } from './manager.js'

interface CronJob {
  id: string
  interval: number
  lastRun: number
  handler: () => Promise<void>
}

// Manages scheduled jobs across multiple tabs
export class Cron {
  private jobs: Map<string, CronJob> = new Map()
  private checkInterval?: ReturnType<typeof setInterval>
  private readonly STORAGE_KEY = 'sequence-cron-jobs'

  constructor(private readonly shared: Shared) {
    this.start()
  }

  private start() {
    // Check every minute
    this.checkInterval = setInterval(() => this.checkJobs(), 60 * 1000)
    this.checkJobs()
  }

  // Register a new job with a unique ID and interval in milliseconds
  registerJob(id: string, interval: number, handler: () => Promise<void>) {
    if (this.jobs.has(id)) {
      throw new Error(`Job with ID ${id} already exists`)
    }

    const job: CronJob = {
      id,
      interval,
      lastRun: 0,
      handler,
    }

    this.jobs.set(id, job)
    this.syncWithStorage()
  }

  // Unregister a job by ID
  unregisterJob(id: string) {
    if (this.jobs.delete(id)) {
      this.syncWithStorage()
    }
  }

  private async checkJobs() {
    await navigator.locks.request('sequence-cron-jobs', async (lock: Lock | null) => {
      if (!lock) return

      const now = Date.now()
      const storage = await this.getStorageState()

      for (const [id, job] of this.jobs) {
        const lastRun = storage.get(id)?.lastRun ?? job.lastRun
        const timeSinceLastRun = now - lastRun

        if (timeSinceLastRun >= job.interval) {
          await job.handler()
          job.lastRun = now
          storage.set(id, { lastRun: now })
        }
      }

      await this.syncWithStorage()
    })
  }

  private async getStorageState(): Promise<Map<string, { lastRun: number }>> {
    const state = localStorage.getItem(this.STORAGE_KEY)
    return new Map(state ? JSON.parse(state) : [])
  }

  private async syncWithStorage() {
    const state = Array.from(this.jobs.entries()).map(([id, job]) => [id, { lastRun: job.lastRun }])
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state))
  }
}
