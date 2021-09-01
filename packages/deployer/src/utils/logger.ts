import { isNode } from '@0xsequence/utils'

export interface Logger {
  start(text?: string): void
  stop(): void
  succeed(text?: string): void
  fail(text?: string): void
  warn(text?: string): void
  info(text?: string): void
}

const loadOra = () => import('ora')

export const createLogger = async (): Promise<Logger> => {
  if (isNode()) {
    // dynamically import ora package only for nodejs
    return (await loadOra()).default({ discardStdin: true })
  } else {
    // returns a noop ora-compatible logger
    const debug = false
    let startText = ''
    return {
      start: function (text: string = '') {
        startText = text
        if (debug) console.log(`start ${text}`)
      },
      stop: function () {
        if (debug) console.log(`stop ${startText}`)
        startText = ''
      },
      succeed: function (text: string = '') {
        if (debug) console.log(`success ${startText} ${text}`)
      },
      fail: function (text: string = '') {
        if (debug) console.log(`fail ${startText} ${text}`)
        throw `fail: ${startText} ${text}`
      },
      warn: function (text: string = '') {
        if (debug) console.log(`warn ${startText} ${text}`)
      },
      info: function (text: string = '') {
        if (debug) console.log(`info ${startText} ${text}`)
      }
    }
  }
}
