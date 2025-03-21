export class Logger {
  constructor(public readonly verbose: boolean) {}

  log(...args: any[]) {
    if (this.verbose) {
      console.log(...args)
    }
  }
}
