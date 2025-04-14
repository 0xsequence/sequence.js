export class NoPrivateKeyError extends Error {
  constructor() {
    super('No private key found')
    this.name = 'NoPrivateKeyError'
  }
}
