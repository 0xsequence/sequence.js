export interface Logger {
  start(text?: string): void
  stop(): void
  succeed(text?: string): void
  fail(text?: string): void
  warn(text?: string): void
  info(text?: string): void
}

export const createLogger = async (): Promise<Logger> => {
  let startText = ''
  return {
    start: function (text: string = '') {
      startText = text
      console.warn(`[start] ${text}`)
    },
    stop: function () {
      console.warn(`[stop] ${startText}`)
      startText = ''
    },
    succeed: function (text: string = '') {
      console.warn(`[success] ${startText} ${text}`)
    },
    fail: function (text: string = '') {
      console.warn(`[fail] ${startText} ${text}`)
    },
    warn: function (text: string = '') {
      console.warn(`[warn] ${startText} ${text}`)
    },
    info: function (text: string = '') {
      console.warn(`[info] ${startText} ${text}`)
    }
  }
}
