import { Deferrable, defineReadOnly, getStatic, resolveProperties, checkProperties, shallowCopy, deepCopy } from '@ethersproject/properties'

export type { Deferrable }

export {
  defineReadOnly, getStatic, resolveProperties, checkProperties, shallowCopy, deepCopy
}

export type Optionals<T extends object> = Omit<T, Exclude<{
  [K in keyof T]: T extends Record<K, T[K]>
    ? K
    : never
}[keyof T], undefined>>

export type Mask<T, K> = Omit<T, keyof K>

export type Forbid<T, K extends keyof any> = T & {
  [P in K]?: never;
}
