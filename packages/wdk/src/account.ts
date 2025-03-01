import { Address } from 'ox'

export class Account {
  constructor(public readonly address: Address.Address) {}

  static async create(address: Address.Address) {}
}
