interface UnrealInjectedWindow {
  ue?: {
    sequencewallettransport?: {
      logfromjs: (message: string) => void
      warnfromjs: (message: string) => void
      errorfromjs: (message: string) => void
    }
  }
  logsOverriddenForUnreal?: boolean
}
declare const window: Window & typeof globalThis & UnrealInjectedWindow

/**
 * This will redirect console logs from Sequence.js & the wallet to the Unreal console, for debugging purposes.
 */
export function overrideLogs(side: 'dapp' | 'wallet') {
  if (window.ue?.sequencewallettransport && !window.logsOverriddenForUnreal) {
    const t = window.ue?.sequencewallettransport
    console.log = (...args: unknown[]) => {
      t.logfromjs(`${side}: ${stringify(args)}`)
    }
    console.warn = (...args: unknown[]) => {
      t.warnfromjs(`${side}: ${stringify(args)}`)
    }
    console.error = (...args: unknown[]) => {
      t.errorfromjs(`${side}: ${stringify(args)}`)
    }
    window.logsOverriddenForUnreal = true
  }
}

function stringify(things: unknown[]): string {
  return things
    .map(a => (typeof a === 'object' ? (a instanceof Error ? a.message : JSON.stringify(a)) : String(a)))
    .join(' ')
}
