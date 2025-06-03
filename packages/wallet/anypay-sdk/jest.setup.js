// This file is used to set up the test environment
import { TextEncoder, TextDecoder } from 'node:util'

global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
