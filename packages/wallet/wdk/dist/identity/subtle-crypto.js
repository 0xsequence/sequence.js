'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.WindowSubtleCryptoBackend = exports.getDefaultSubtleCryptoBackend = void 0
exports.isWindowSubtleCryptoAvailable = isWindowSubtleCryptoAvailable
const getDefaultSubtleCryptoBackend = () => {
  if (isWindowSubtleCryptoAvailable()) {
    return new WindowSubtleCryptoBackend()
  } else {
    return undefined
  }
}
exports.getDefaultSubtleCryptoBackend = getDefaultSubtleCryptoBackend
function isWindowSubtleCryptoAvailable() {
  return (
    typeof window === 'object' &&
    typeof window.crypto === 'object' &&
    window.crypto !== null &&
    typeof window.crypto.subtle === 'object'
  )
}
class WindowSubtleCryptoBackend {
  constructor() {
    if (!isWindowSubtleCryptoAvailable()) {
      throw new Error('window.crypto.subtle is not available')
    }
  }
  generateKey(algorithm, extractable, keyUsages) {
    return window.crypto.subtle.generateKey(algorithm, extractable, keyUsages)
  }
  importKey(format, keyData, algorithm, extractable, keyUsages) {
    return window.crypto.subtle.importKey(format, keyData, algorithm, extractable, keyUsages)
  }
  async exportKey(format, key) {
    const keyData = await window.crypto.subtle.exportKey(format, key)
    return new Uint8Array(keyData)
  }
  async digest(algorithm, data) {
    const digest = await window.crypto.subtle.digest(algorithm, data)
    return new Uint8Array(digest)
  }
  async sign(algorithm, key, data) {
    const signature = await window.crypto.subtle.sign(algorithm, key, data)
    return new Uint8Array(signature)
  }
  verify(algorithm, key, signature, data) {
    return window.crypto.subtle.verify(algorithm, key, signature, data)
  }
  getRandomValues(len) {
    const randomValues = new Uint8Array(len)
    return window.crypto.getRandomValues(randomValues)
  }
}
exports.WindowSubtleCryptoBackend = WindowSubtleCryptoBackend
