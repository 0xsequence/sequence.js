const { TextEncoder, TextDecoder } = require('util')
const fetch = require('node-fetch')

global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
global.fetch = fetch

const { JSDOM } = require('jsdom')

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
})

global.window = dom.window
global.document = dom.window.document
global.navigator = dom.window.navigator
global.localStorage = dom.window.localStorage
global.sessionStorage = dom.window.sessionStorage
global.ethereum = undefined // Mock ethereum as undefined since we're in a test environment
