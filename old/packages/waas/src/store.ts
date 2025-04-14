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
  private readonly store: Store

  constructor() {
    if (WindowLocalStorage.isAvailable()) {
      this.store = new WindowLocalStorage()
    } else {
      this.store = new MemoryStore()
    }
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key)
  }

  async set(key: string, value: string | null): Promise<void> {
    return this.store.set(key, value)
  }
}

export class WindowLocalStorage implements Store {
  static isAvailable(): boolean {
    return typeof window === 'object' && typeof window.localStorage === 'object'
  }

  constructor() {
    if (!WindowLocalStorage.isAvailable()) {
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

export class MemoryStore implements Store {
  private store: Record<string, string> = {}

  constructor() {
    this.store = {}
  }

  async get(key: string): Promise<string | null> {
    return this.store[key] || null
  }

  async set(key: string, value: string | null): Promise<void> {
    if (value) {
      this.store[key] = value
    } else {
      delete this.store[key]
    }
  }
}
