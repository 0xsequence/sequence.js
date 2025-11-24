export class Logger {
    shared;
    constructor(shared) {
        this.shared = shared;
    }
    log(...args) {
        if (this.shared.verbose) {
            console.log(...args);
        }
    }
}
