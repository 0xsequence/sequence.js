export function queryStringFromObject(name: string, obj: any) {
  const k = encodeURIComponent(name)
  const v = encodeURIComponent(JSON.stringify(obj))
  return `${k}=${v}`
}

export function queryStringToObject(qs: string): {[key:string]: any} {
  const p = qs.split('&')
  const o: {[key:string]: any} = {}
  for (const v of p) {
    const z = v.split('=')
    o[decodeURIComponent(z[0])] = JSON.parse(decodeURIComponent(z[1]))
  }
  return o
}
