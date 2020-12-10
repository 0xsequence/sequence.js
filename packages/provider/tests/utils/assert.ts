const testResults = []

;(window as any).__testResults = testResults

export const test = async (title: string, run: () => void) => {
  const entry = {
    title: title, pass: null, startTime: performance.now(),
    error: null, stack: null
  }
  testResults.push(entry)

  try {
    await run()
    entry.pass = true
  } catch (err) {
    entry.error = err.message
    entry.stack = err.stack
    // throw Error(`case '${title}' failed due to ${err.message}`)
    // throw err
    err.message = `case '${title}' failed due to ${err.message}`
    throw err
  }
}

export const assert = {
  true: function(cond: boolean, msg?: string) {
    if (cond !== true) {
      if (msg) {
        throw Error(`invalid condition, '${msg}'`)
      } else {
        throw Error(`invalid condition`)
      }
    }
  },

  equal: function(actual: any, expected: any, msg?: string) {
    if (actual !== expected) {
      if (msg) {
        throw Error(`expected '${expected}' but got '${actual}', '${msg}'`)
      } else {
        throw Error(`expected '${expected}' but got '${actual}'`)
      }
    }
  }
}

export const sleep = (time: number) => {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, time)
  })
}
