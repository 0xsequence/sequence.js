
export type Config = {
  version: number
}

export interface ConfigCoder<T extends Config> {
  imageHashOf: (config: T) => string
  hasSubdigest: (config: T, subdigest: string) => boolean

  // isValid: (config: T) => boolean
}
