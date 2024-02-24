import { ethers } from 'ethers'

const { defineProperties, resolveProperties } = ethers

export { defineProperties, resolveProperties }

export type Optionals<T extends object> = Omit<
  T,
  Exclude<
    {
      [K in keyof T]: T extends Record<K, T[K]> ? K : never
    }[keyof T],
    undefined
  >
>

export type Mask<T, K> = Omit<T, keyof K>

export type Forbid<T, K extends keyof any> = T & {
  [P in K]?: never
}
