import { Base64 } from 'js-base64'

export const jwtDecodeClaims =  <T = any>(jwt: string) => {
  const parts = jwt.split('.')
  if (parts.length !== 3) {
    throw new Error('invalid jwt')
  }
  const claims = JSON.parse(Base64.decode(parts[1])) as T
  return claims
}
