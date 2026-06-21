import { describe, expect, it, vi } from 'vitest'
import { Cron } from '../src/sequence/cron.js'

describe('Cron persistence', () => {
  it('correctly persists and does not overwrite lastRun with 0', async () => {
    // 1. Setup mock storage with an existing run timestamp
    // Say the job ran 5 minutes ago (300,000 ms ago).
    const now = Date.now()
    const fiveMinutesAgo = now - 5 * 60 * 1000
    const jobInterval = 10 * 60 * 1000 // 10 minutes interval

    const storageMap = new Map<string, string>()
    storageMap.set(
      'sequence-cron-jobs',
      JSON.stringify([['test-job', { lastRun: fiveMinutesAgo }]])
    )

    const mockStorage = {
      getItem: (key: string) => storageMap.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storageMap.set(key, value)
      },
    } as any

    const mockLogger = {
      log: vi.fn(),
    }

    const mockShared = {
      verbose: false,
      env: {
        storage: mockStorage,
        timers: {
          setTimeout: (cb: any, ms: number) => setTimeout(cb, ms),
          clearTimeout: (id: any) => clearTimeout(id),
          setInterval: vi.fn(), // Prevent auto polling
          clearInterval: vi.fn(),
        },
      },
      modules: {
        logger: mockLogger,
      },
    } as any

    // 2. Instantiate Cron (recreating WDK reload)
    const cron = new Cron(mockShared)

    // Register the job with interval 10 minutes
    const handler = vi.fn().mockResolvedValue(undefined)
    cron.registerJob('test-job', jobInterval, handler)

    // 3. Manually trigger the first check
    // This will load the storage state: lastRun = fiveMinutesAgo.
    // Time elapsed is 5 minutes, which is less than the 10-minute interval.
    // Therefore, handler should NOT run.
    // AND, importantly, the fix should ensure we don't overwrite localStorage with 0.
    await (cron as any).currentCheckJobsPromise

    // Verify handler was not called
    expect(handler).not.toHaveBeenCalled()

    // Verify localStorage was NOT overwritten with 0!
    // The storage should still contain the fiveMinutesAgo timestamp.
    const persistedState = JSON.parse(storageMap.get('sequence-cron-jobs')!)
    const testJobState = persistedState.find(([id]: any) => id === 'test-job')
    expect(testJobState).toBeDefined()
    expect(testJobState[1].lastRun).toBe(fiveMinutesAgo)

    // 4. Test that the job runs when the interval HAS elapsed
    // Let's modify the storage to make the last run 15 minutes ago.
    const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000
    storageMap.set(
      'sequence-cron-jobs',
      JSON.stringify([['test-job', { lastRun: fifteenMinutesAgo }]])
    )

    // Trigger check again
    await (cron as any).executeCheckJobsChain()
    await (cron as any).currentCheckJobsPromise

    // Verify handler WAS called this time
    expect(handler).toHaveBeenCalledTimes(1)

    // Verify storage was updated with the new run time (which should be close to now)
    const updatedState = JSON.parse(storageMap.get('sequence-cron-jobs')!)
    const updatedJobState = updatedState.find(([id]: any) => id === 'test-job')
    expect(updatedJobState[1].lastRun).toBeGreaterThanOrEqual(now)
  })
})
