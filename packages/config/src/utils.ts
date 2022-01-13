
export async function PromiseAny <T>(promises: Promise<T>[]): Promise<T> {
  let errors = 0

  return new Promise<T>((resolve, reject) => {
    promises.forEach((promise) => {
      promise.then(resolve).catch((error) => {
        errors++

        if (errors === promises.length) {
          reject(error)
        }
      })
    })
  })
}

export async function PromiseSome <T>(promises: Promise<T | undefined>[]): Promise<T | undefined> {
  let ignoring = 0

  return new Promise<T | undefined>((resolve) => {
    const ignore = () => {
      ignoring++

      if (ignoring === promises.length) {
        resolve(undefined)
      }
    }

    promises.forEach((promise) => {
      promise.then((res) => {
        if (res !== undefined) {
          resolve(res)
        } else {
          ignore()
        }
      }).catch(ignore)
    })
  })
}