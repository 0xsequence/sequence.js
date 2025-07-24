export interface Precondition {
  type(): string
  isValid(): Error | undefined
}

export class NativeBalancePrecondition implements Precondition {
  constructor(
    public readonly address: Address.Checksummed,
    public readonly min?: bigint,
    public readonly max?: bigint,
  ) {}

  type(): string {
    return 'native-balance'
  }

  isValid(): Error | undefined {
    if (!this.address) {
      return new Error('address is required')
    }
    if (this.min !== undefined && this.max !== undefined && this.min > this.max) {
      return new Error('min balance cannot be greater than max balance')
    }
    return undefined
  }
}

export class Erc20BalancePrecondition implements Precondition {
  constructor(
    public readonly address: Address.Checksummed,
    public readonly token: Address.Checksummed,
    public readonly min?: bigint,
    public readonly max?: bigint,
  ) {}

  type(): string {
    return 'erc20-balance'
  }

  isValid(): Error | undefined {
    if (!this.address) {
      return new Error('address is required')
    }
    if (!this.token) {
      return new Error('token address is required')
    }
    if (this.min !== undefined && this.max !== undefined && this.min > this.max) {
      return new Error('min balance cannot be greater than max balance')
    }
    return undefined
  }
}

export class Erc20ApprovalPrecondition implements Precondition {
  constructor(
    public readonly address: Address.Checksummed,
    public readonly token: Address.Checksummed,
    public readonly operator: Address.Checksummed,
    public readonly min: bigint,
  ) {}

  type(): string {
    return 'erc20-approval'
  }

  isValid(): Error | undefined {
    if (!this.address) {
      return new Error('address is required')
    }
    if (!this.token) {
      return new Error('token address is required')
    }
    if (!this.operator) {
      return new Error('operator address is required')
    }
    if (this.min === undefined) {
      return new Error('min approval amount is required')
    }
    return undefined
  }
}

export class Erc721OwnershipPrecondition implements Precondition {
  constructor(
    public readonly address: Address.Checksummed,
    public readonly token: Address.Checksummed,
    public readonly tokenId: bigint,
    public readonly owned?: boolean,
  ) {}

  type(): string {
    return 'erc721-ownership'
  }

  isValid(): Error | undefined {
    if (!this.address) {
      return new Error('address is required')
    }
    if (!this.token) {
      return new Error('token address is required')
    }
    if (this.tokenId === undefined) {
      return new Error('tokenId is required')
    }
    return undefined
  }
}

export class Erc721ApprovalPrecondition implements Precondition {
  constructor(
    public readonly address: Address.Checksummed,
    public readonly token: Address.Checksummed,
    public readonly tokenId: bigint,
    public readonly operator: Address.Checksummed,
  ) {}

  type(): string {
    return 'erc721-approval'
  }

  isValid(): Error | undefined {
    if (!this.address) {
      return new Error('address is required')
    }
    if (!this.token) {
      return new Error('token address is required')
    }
    if (this.tokenId === undefined) {
      return new Error('tokenId is required')
    }
    if (!this.operator) {
      return new Error('operator address is required')
    }
    return undefined
  }
}

export class Erc1155BalancePrecondition implements Precondition {
  constructor(
    public readonly address: Address.Checksummed,
    public readonly token: Address.Checksummed,
    public readonly tokenId: bigint,
    public readonly min?: bigint,
    public readonly max?: bigint,
  ) {}

  type(): string {
    return 'erc1155-balance'
  }

  isValid(): Error | undefined {
    if (!this.address) {
      return new Error('address is required')
    }
    if (!this.token) {
      return new Error('token address is required')
    }
    if (this.tokenId === undefined) {
      return new Error('tokenId is required')
    }
    if (this.min !== undefined && this.max !== undefined && this.min > this.max) {
      return new Error('min balance cannot be greater than max balance')
    }
    return undefined
  }
}

export class Erc1155ApprovalPrecondition implements Precondition {
  constructor(
    public readonly address: Address.Checksummed,
    public readonly token: Address.Checksummed,
    public readonly tokenId: bigint,
    public readonly operator: Address.Checksummed,
    public readonly min: bigint,
  ) {}

  type(): string {
    return 'erc1155-approval'
  }

  isValid(): Error | undefined {
    if (!this.address) {
      return new Error('address is required')
    }
    if (!this.token) {
      return new Error('token address is required')
    }
    if (this.tokenId === undefined) {
      return new Error('tokenId is required')
    }
    if (!this.operator) {
      return new Error('operator address is required')
    }
    if (this.min === undefined) {
      return new Error('min approval amount is required')
    }
    return undefined
  }
}
