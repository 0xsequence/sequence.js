export interface Store {
  get(key: string): Promise<string | null>
  set(key: string, value: string | null): Promise<void>
}

export class StoreObj<T extends string | undefined> {
  constructor(
    private readonly store: Store,
    private readonly key: string,
    private readonly defaultValue: T
  ) {}

  async get(): Promise<T> {
    const value = await this.store.get(this.key)
    return value ? (value as T) : this.defaultValue
  }

  async set(value: T): Promise<void> {
    if (value) {
      await this.store.set(this.key, value)
    } else {
      await this.store.set(this.key, null)
    }
  }
}

export class LocalStore implements Store {
  constructor() {
    if (!window.localStorage) {
      throw new Error('No localStorage')
    }
  }

  async get(key: string): Promise<string | null> {
    return window.localStorage.getItem(key)
  }

  async set(key: string, value: string | null): Promise<void> {
    if (!value) {
      window.localStorage.removeItem(key)
    } else {
      window.localStorage.setItem(key, value)
    }
  }
}
