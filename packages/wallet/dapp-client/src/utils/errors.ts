export class InitializationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InitializationError'
  }
}

export class SigningError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SigningError'
  }
}

export class TransactionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TransactionError'
  }
}

export class ModifyExplicitSessionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ModifyExplicitSessionError'
  }
}

export class ConnectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConnectionError'
  }
}

export class AddExplicitSessionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AddExplicitSessionError'
  }
}

export class FeeOptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FeeOptionError'
  }
}

export class WalletRedirectError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WalletRedirectError'
  }
}

export class SessionConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SessionConfigError'
  }
}
