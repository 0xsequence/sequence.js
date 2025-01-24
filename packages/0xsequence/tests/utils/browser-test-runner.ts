import test from 'ava'
import * as puppeteer from 'puppeteer'

export const runBrowserTests = async (title: string, path: string) => {
  test.serial(title, browserContext, async (t, page: puppeteer.Page) => {
    await page.goto('http://localhost:9999/' + path, {
      waitUntil: 'networkidle0',
      timeout: 30000
    })

    // confirm
    t.true((await page.title()) === 'test')

    // debugging
    page.on('console', msg => console.log(`console: ${msg.text()}`))

    // catch uncaught errors
    page.on('pageerror', err => {
      page.close()
      t.fail(`${err}`)
    })

    // run the test
    try {
      const timeout = setTimeout(() => {
        throw `Test runner timed out after 60s!`
      }, 60000) // 60 seconds to run the tests

      const testResults = await page.evaluate(async () => {
        // @ts-ignore
        await lib.tests()

        // @ts-ignore
        return window.__testResults
      })

      clearTimeout(timeout)

      for (let i = 0; i < testResults.length; i++) {
        const result = testResults[i]
        if (result.pass === true) {
          t.log(`${result.title}: \x1b[32mPASS\x1b[0m`)
        } else {
          t.log(`${result.title}: \x1b[31mFAIL\x1b[0m`)
          if (result.error) {
            t.fail(`WHOOPS! case '${result.title}' failed due to ${result.error} !`)
          } else {
            t.fail(`WHOOPS! case '${result.title}' failed !`)
          }
        }
      }
    } catch (err) {
      t.fail(`${err}`)
    }
  })
}

export const browserContext = async (t, run) => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  const page = await browser.newPage()
  try {
    await run(t, page)
  } finally {
    await page.close()
    await browser.close()
  }
}

// const getChromePath = (): string | undefined => {
//   if (process.env['NIX_PATH']) {
//     // nixos users are unable to use the chrome bin packaged with puppeteer,
//     // so instead we use the locally installed chrome or chromium binary.
//     for (const bin of ['google-chrome-stable', 'chromium']) {
//       const out = spawnSync('which', [bin])
//       if (out.status === 0) {
//         const executablePath = out.stdout.toString().trim()
//         return executablePath
//       }
//     }
//     console.error('Unable to find `google-chrome-stable` or `chromium` binary on your NixOS system.')
//     process.exit(1)
//   } else {
//     // undefined will use the chrome version packaged with puppeteer npm package
//     return undefined
//   }
// }
