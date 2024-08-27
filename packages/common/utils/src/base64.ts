import { Base64 } from 'js-base64'

export const base64Encode = (val: string): string => {
  return Base64.encode(val, true)
}

export const base64EncodeObject = (obj: any): string => {
  return Base64.encode(JSON.stringify(obj), true)
}

export const base64Decode = (encodedString: string): string | undefined => {
  if (encodedString === null || encodedString === undefined) {
    return undefined
  }
  return Base64.decode(encodedString)
}

export const base64DecodeObject = <T = any>(encodedObject: string | null): T | undefined => {
  if (encodedObject === null || encodedObject === undefined) {
    return undefined
  }
  return JSON.parse(Base64.decode(encodedObject)) as T
}
