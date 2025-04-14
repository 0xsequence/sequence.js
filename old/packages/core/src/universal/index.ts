import { commons, v1, v2 } from '..'

export const ALL_CODERS = [
  { config: v1.config.ConfigCoder, signature: v1.signature.SignatureCoder },
  { config: v2.config.ConfigCoder, signature: v2.signature.SignatureCoder }
]

export function coderFor(version: number) {
  const index = version - 1
  if (index < 0 || index >= ALL_CODERS.length) {
    throw new Error(`No coder for version: ${version}`)
  }

  return ALL_CODERS[index]
}

/**
 *  Same as `coderFor` but returns `generic` coders without versioned types.
 */
export function genericCoderFor(version: number): {
  config: commons.config.ConfigCoder
  signature: commons.signature.SignatureCoder
} {
  return coderFor(version)
}
