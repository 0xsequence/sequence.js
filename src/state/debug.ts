import { Hex } from 'ox'

// JSON.stringify replacer for args/results
function stringifyReplacer(_key: string, value: any): any {
  if (typeof value === 'bigint') {
    return value.toString()
  }
  if (value instanceof Uint8Array) {
    return Hex.fromBytes(value)
  }
  return value
}

function stringify(value: any): string {
  return JSON.stringify(value, stringifyReplacer, 2)
}

// Normalize for deep comparison
function normalize(value: any): any {
  if (typeof value === 'bigint') {
    return value.toString()
  }
  if (value instanceof Uint8Array) {
    return Hex.fromBytes(value)
  }
  if (typeof value === 'string') {
    return value.toLowerCase()
  }
  if (Array.isArray(value)) {
    return value.map(normalize)
  }
  if (value && typeof value === 'object') {
    const out: [string, any][] = []
    // ignore undefined, sort keys
    for (const key of Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort()) {
      out.push([key.toLowerCase(), normalize(value[key])])
    }
    return out
  }
  return value
}

function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))
}

export function multiplex<T extends object>(reference: T, candidates: Record<string, T>): T {
  const handler: ProxyHandler<T> = {
    get(_target, prop, _receiver) {
      const orig = (reference as any)[prop]
      if (typeof orig !== 'function') {
        // non-method properties passthrough
        return Reflect.get(reference, prop)
      }

      return async (...args: any[]): Promise<any> => {
        const methodName = String(prop)
        const argsStr = stringify(args)

        let refResult: any
        try {
          refResult = await orig.apply(reference, args)
        } catch (err) {
          const id = Math.floor(1000000 * Math.random())
            .toString()
            .padStart(6, '0')
          console.trace(
            `[${id}] calling ${methodName}: ${argsStr}\n[${id}] warning: reference ${methodName} threw:`,
            err,
          )
          throw err
        }

        const refResultStr = stringify(refResult)

        // invoke all candidates in parallel
        await Promise.all(
          Object.entries(candidates).map(async ([name, cand]) => {
            const method = (cand as any)[prop]
            if (typeof method !== 'function') {
              const id = Math.floor(1000000 * Math.random())
                .toString()
                .padStart(6, '0')
              console.trace(
                `[${id}] calling ${methodName}: ${argsStr}\n[${id}] reference returned: ${refResultStr}\n[${id}] warning: ${name} has no ${methodName}`,
              )
              return
            }
            let candRes: any
            try {
              candRes = method.apply(cand, args)
              candRes = await Promise.resolve(candRes)
            } catch (err) {
              const id = Math.floor(1000000 * Math.random())
                .toString()
                .padStart(6, '0')
              console.trace(
                `[${id}] calling ${methodName}: ${argsStr}\n[${id}] reference returned: ${refResultStr}\n[${id}] warning: ${name} ${methodName} threw:`,
                err,
              )
              return
            }
            const id = Math.floor(1000000 * Math.random())
              .toString()
              .padStart(6, '0')
            if (deepEqual(refResult, candRes)) {
              console.trace(
                `[${id}] calling ${methodName}: ${argsStr}\n[${id}] reference returned: ${refResultStr}\n[${id}] ${name} returned: ${stringify(candRes)}`,
              )
            } else {
              console.trace(
                `[${id}] calling ${methodName}: ${argsStr}\n[${id}] reference returned: ${refResultStr}\n[${id}] ${name} returned: ${stringify(candRes)}\n[${id}] warning: ${name} ${methodName} does not match reference`,
              )
            }
          }),
        )

        return refResult
      }
    },
  }

  return new Proxy(reference, handler)
}
