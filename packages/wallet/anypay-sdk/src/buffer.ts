import { Buffer as BufferPolyfill } from 'buffer'

// Polyfill Buffer globally if it doesn't exist.
// Buffer is required by some 0xsequence packages.
// This is a temporary solution.
if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = BufferPolyfill
}

export { BufferPolyfill as Buffer }
