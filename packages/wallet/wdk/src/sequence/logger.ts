import { Shared } from './manager.js'

export class Logger {
  constructor(private readonly shared: Shared) {}

  log(...args: any[]) {
    if (this.shared.verbose) {
      console.log(...args)
    }
  }
}
