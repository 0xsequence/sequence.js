export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'DISABLED'

enum logLevel {
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  DISABLED = 5
}

export interface LoggerConfig {
  logLevel: LogLevel
  silence?: boolean

  onwarn?: (message: any, ...optionalParams: any[]) => void
  onerror?: (message: any, ...optionalParams: any[]) => void
}

export class Logger {
  logLevel: logLevel

  constructor(private config: LoggerConfig) {
    this.configure(config)
  }

  configure(config: Partial<LoggerConfig>) {
    this.config = { ...this.config, ...config}
    switch (this.config.logLevel) {
      case 'DEBUG':
        this.logLevel = logLevel.DEBUG
        break
      case 'INFO':
        this.logLevel = logLevel.INFO
        break
      case 'WARN':
        this.logLevel = logLevel.WARN
        break
      case 'ERROR':
        this.logLevel = logLevel.ERROR
        break
      case 'DISABLED':
        this.logLevel = logLevel.DISABLED
        break
      default:
        this.logLevel = logLevel.INFO
        break
    }

    // undefined silence value will disable the default silence flag
    if (this.config.silence === undefined) {
      this.config.silence = false
    }
  }

  debug(message: any, ...optionalParams: any[]) {
    if (this.config.silence === true) return
    if (this.logLevel === logLevel.DEBUG) {
      console.log(message, ...optionalParams)
    }
  }

  info(message: any, ...optionalParams: any[]) {
    if (this.config.silence === true) return
    if (this.logLevel <= logLevel.INFO) {
      console.log(message, ...optionalParams)
    }
  }

  warn(message: any, ...optionalParams: any[]) {
    if (this.config.silence === true) return
    if (this.logLevel <= logLevel.WARN) {
      console.warn(message, ...optionalParams)
      if (this.config.onwarn) {
        this.config.onwarn(message, optionalParams)
      }
    }
  }

  error(message: any, ...optionalParams: any[]) {
    if (this.config.silence === true) return
    if (this.logLevel <= logLevel.ERROR) {
      console.error(message, ...optionalParams)
      if (this.config.onerror) {
        this.config.onerror(message, optionalParams)
      }
    }
  }
}

export const logger = new Logger({
  logLevel: 'INFO',

  // By default we silence the logger. In tests we should call `configureLogger`
  // below to set silence: false.
  silence: true 
})

export const configureLogger = (config: Partial<LoggerConfig>) => logger.configure(config)
