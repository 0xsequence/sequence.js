
export async function safeSolve<T>(promise: Promise<T>, def: T): Promise<T> {
  try {
    return await promise
  } catch (e) {
    console.warn(`Error solving promise ${e} - default: ${def}`)
    return def
  }
}

export function flatten<T>(array: T[][]): T[] {
  return ([] as T[]).concat(...array)
}
