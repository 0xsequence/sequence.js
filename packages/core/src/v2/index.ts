
export * as config from "./config"
export * as signature from "./signature"
export * as context from './context'
export * as chained from './chained'

import { ConfigCoder } from "./config"
import { SignatureCoder } from "./signature"

export const coders = {
  config: ConfigCoder,
  signature: SignatureCoder,
}
