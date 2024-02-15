import { ethers } from 'ethers'

// Makes all properties in T optionally deferrable
export type Deferrable<T> = {
  [K in keyof T]: T[K] | Promise<T[K]>
}

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
