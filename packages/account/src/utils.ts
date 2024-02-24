function isPromise(value: any): value is Promise<any> {
  return !!value && typeof value.then === 'function'
}
