#!/usr/bin/env node
/**
 * Comprehensive SSR Safety Test (Runtime Execution)
 * 
 * This script tests that the entire wdk package can be imported and used in a Node.js
 * environment (SSR context) without throwing errors about missing window.
 * 
 * It executes the code at runtime to catch any SSR issues.
 * 
 * Run with: node test-ssr-comprehensive.mjs
 */

import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createRequire } from 'module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)

console.log('Testing SSR safety with runtime execution...\n')

// Ensure we're in a Node.js environment (no window)
if (typeof window !== 'undefined') {
  console.error('ERROR: window is defined! This should not happen in Node.js.')
  process.exit(1)
}

console.log('✓ window is undefined (as expected in Node.js)\n')

const errors = []
const warnings = []

// Read package.json to get package name and exports
let packageJson
try {
  const packageJsonPath = join(__dirname, '..', 'package.json')
  packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))
} catch (err) {
  console.error('Failed to read package.json:', err.message)
  process.exit(1)
}

// Test 1: Import main module via package name
console.log('='.repeat(60))
console.log('Test 1: Importing package via package name')
console.log('='.repeat(60))

let wdk
try {
  // Use the package name from package.json
  const packageName = packageJson.name
  console.log(`Importing ${packageName}...`)
  
  // Try to resolve the package
  const packagePath = require.resolve(packageName)
  console.log(`  Package resolved to: ${packagePath}`)
  
  // Import the package
  wdk = await import(packageName)
  console.log('✓ Successfully imported package')
  console.log('  Top-level exports:', Object.keys(wdk))
  
} catch (error) {
  // Check if it's an SSR-related error
  if (error.message.includes('window is not defined') ||
      error.message.includes('window') ||
      error.message.includes('document is not defined') ||
      error.message.includes('document') ||
      error.message.includes('localStorage') ||
      error.message.includes('sessionStorage')) {
    errors.push(`SSR ERROR: Package accesses browser globals at module load time: ${error.message}`)
    if (error.stack) {
      console.error('\nError stack:')
      console.error(error.stack)
    }
  } else {
    errors.push(`Failed to import package: ${error.message}`)
    if (error.stack) {
      console.error('Stack:', error.stack)
    }
  }
  
  // Don't exit immediately - let the summary show the error
  if (errors.length > 0) {
    // Skip remaining tests if import failed
    wdk = null
  }
}

// Test 2: Recursively access and test all exports
console.log('\n' + '='.repeat(60))
console.log('Test 2: Accessing and testing all exports')
console.log('='.repeat(60))

if (!wdk) {
  console.log('Skipping - package import failed')
} else {
  async function testExports(obj, path = '', depth = 0) {
  if (depth > 5) return // Prevent infinite recursion
  
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key
    
    try {
      // Skip if it's a circular reference or already tested
      if (value === null || value === undefined) {
        continue
      }
      
      // Test accessing the value (this executes any getters)
      const accessed = value
      
      // Test different types
      if (typeof accessed === 'function') {
        // Try to get function properties
        try {
          const props = Object.getOwnPropertyNames(accessed)
          if (props.length > 0 && depth < 3) {
            // Test static properties on functions
            for (const prop of props.slice(0, 3)) {
              try {
                const propValue = accessed[prop]
                if (typeof propValue === 'object' && propValue !== null && depth < 2) {
                  await testExports(propValue, `${currentPath}.${prop}`, depth + 1)
                }
              } catch (err) {
                if (err.message.includes('window') || err.message.includes('document')) {
                  errors.push(`${currentPath}.${prop}: ${err.message}`)
                }
              }
            }
          }
        } catch (err) {
          if (err.message.includes('window') || err.message.includes('document')) {
            errors.push(`${currentPath}: ${err.message}`)
          }
        }
      } else if (typeof accessed === 'object' && accessed !== null) {
        // Test object properties
        if (Array.isArray(accessed)) {
          // Test array elements
          for (let i = 0; i < Math.min(accessed.length, 3); i++) {
            try {
              const item = accessed[i]
              if (typeof item === 'object' && item !== null && depth < 3) {
                await testExports(item, `${currentPath}[${i}]`, depth + 1)
              }
            } catch (err) {
              if (err.message.includes('window') || err.message.includes('document')) {
                errors.push(`${currentPath}[${i}]: ${err.message}`)
              }
            }
          }
        } else {
          // Test object properties recursively
          await testExports(accessed, currentPath, depth + 1)
        }
      }
      
    } catch (error) {
      // Check if it's an SSR-related error
      if (error.message.includes('window is not defined') ||
          error.message.includes('window') ||
          error.message.includes('document is not defined') ||
          error.message.includes('document') ||
          error.message.includes('localStorage') ||
          error.message.includes('sessionStorage')) {
        errors.push(`${currentPath}: ${error.message}`)
      } else {
        // Other errors are warnings (might be expected, like missing dependencies)
        warnings.push(`${currentPath}: ${error.message}`)
      }
    }
  }
}

  // Test all top-level exports
  console.log('Testing all exports recursively...')
  await testExports(wdk)
}

// Test 3: Try to access specific critical exports and use them
console.log('\n' + '='.repeat(60))
console.log('Test 3: Testing critical exports with actual usage')
console.log('='.repeat(60))

if (!wdk) {
  console.log('Skipping - package import failed')
} else {
  // Test ManagerOptionsDefaults
  try {
  if (wdk.Sequence?.ManagerOptionsDefaults) {
    console.log('Testing ManagerOptionsDefaults...')
    const defaults = wdk.Sequence.ManagerOptionsDefaults
    
    // Access all properties
    Object.keys(defaults).forEach(key => {
      try {
        const value = defaults[key]
        console.log(`  ✓ ${key}: ${typeof value}`)
        
        // If it's a function, try calling it
        if (typeof value === 'function' && key === 'relayers') {
          const result = value()
          console.log(`    Called ${key}(), returned:`, Array.isArray(result) ? `${result.length} items` : typeof result)
        }
      } catch (err) {
        if (err.message.includes('window') || err.message.includes('document')) {
          errors.push(`ManagerOptionsDefaults.${key}: ${err.message}`)
        }
      }
    })
  }
} catch (err) {
  if (err.message.includes('window') || err.message.includes('document')) {
    errors.push(`ManagerOptionsDefaults: ${err.message}`)
  }
}

// Test applyManagerOptionsDefaults function
try {
  if (wdk.Sequence?.applyManagerOptionsDefaults) {
    console.log('Testing applyManagerOptionsDefaults...')
    const result = wdk.Sequence.applyManagerOptionsDefaults()
    console.log('  ✓ Function executed successfully')
    console.log('  Result keys:', Object.keys(result).slice(0, 5).join(', '), '...')
  }
} catch (err) {
    if (err.message.includes('window') || err.message.includes('document')) {
      errors.push(`applyManagerOptionsDefaults: ${err.message}`)
    }
  }
}

// Test 4: Try importing sub-modules that might be imported separately
console.log('\n' + '='.repeat(60))
console.log('Test 4: Testing sub-module imports')
console.log('='.repeat(60))

if (!wdk) {
  console.log('Skipping - package import failed')
} else {
  // Get the package path and try importing from dist
  try {
  const packagePath = require.resolve(packageJson.name)
  const packageDir = dirname(packagePath)
  
  // Try to import from the exports field if available
  if (packageJson.exports) {
    for (const [exportPath, exportConfig] of Object.entries(packageJson.exports)) {
      if (exportPath === '.') {
        const modulePath = exportConfig.default || exportConfig.types
        if (modulePath) {
          try {
            const fullPath = join(packageDir, '..', modulePath)
            console.log(`Testing import from ${exportPath}...`)
            const subModule = await import(fullPath)
            console.log(`  ✓ Imported successfully`)
            
            // Test accessing exports
            const subExports = Object.keys(subModule)
            if (subExports.length > 0) {
              console.log(`  Exports: ${subExports.slice(0, 5).join(', ')}${subExports.length > 5 ? '...' : ''}`)
            }
          } catch (err) {
            if (err.message.includes('window') || err.message.includes('document')) {
              errors.push(`Import ${exportPath}: ${err.message}`)
            } else if (!err.message.includes('Cannot find module')) {
              warnings.push(`Import ${exportPath}: ${err.message}`)
            }
          }
        }
      }
    }
  }
  } catch (err) {
    warnings.push(`Could not test sub-modules: ${err.message}`)
  }
}

// Summary
console.log('\n' + '='.repeat(60))
console.log('Test Summary')
console.log('='.repeat(60))

if (errors.length === 0) {
  console.log('\n✅ All SSR Safety Tests PASSED!')
  console.log('The package can be safely imported and used in a Node.js/SSR environment.')
  if (warnings.length > 0) {
    console.log(`\n⚠️  ${warnings.length} warning(s) (non-SSR related):`)
    warnings.slice(0, 5).forEach(warn => console.log(`  - ${warn}`))
    if (warnings.length > 5) {
      console.log(`  ... and ${warnings.length - 5} more`)
    }
  }
  process.exit(0)
} else {
  console.log('\n❌ ERRORS FOUND:')
  errors.forEach(err => console.log(`  - ${err}`))
  console.log('\n❌ SSR Safety Test FAILED!')
  if (warnings.length > 0) {
    console.log(`\n⚠️  ${warnings.length} warning(s):`)
    warnings.slice(0, 5).forEach(warn => console.log(`  - ${warn}`))
  }
  process.exit(1)
}
