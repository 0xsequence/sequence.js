/// <reference types="jest" />

import { jest, describe, it, expect } from '@jest/globals'
import { anypayWallet } from '.'

describe('anypayWallet', () => {
  it('should return true and log Hello World', () => {
    // Mock console.log
    const consoleSpy = jest.spyOn(console, 'log')

    // Call the function
    const result = anypayWallet()

    // Verify the result
    expect(result).toBe(true)
    expect(consoleSpy).toHaveBeenCalledWith('Hello World')

    // Cleanup
    consoleSpy.mockRestore()
  })
})
