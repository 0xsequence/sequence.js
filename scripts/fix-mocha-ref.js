// "mocha" package registers a global type which has proven to be next to impossible
// to exclude. As a result, `<reference types="mocha" />` is included in some random
// declarations, causing for applications which depend on our package to require
// @types/mocha package, which is super annoying / ridiculous. This script will
// search through dist/ folder for .d.ts files and remove any references.

const fs = require('fs')
const path = require('path')

const root = fs.realpathSync(process.cwd())

const getAllFiles = function(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath)

  arrayOfFiles = arrayOfFiles || []

  files.forEach(function(file) {
    if (file === 'node_modules') {
      return
    }

    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles)
    } else if (file.endsWith('.d.ts')) {
      arrayOfFiles.push(path.join(dirPath, "/", file))
    }
  })

  return arrayOfFiles
}

const garbage = `/// <reference types="mocha" />`

const files = getAllFiles(root)

files.forEach(function(file) {
  let data = fs.readFileSync(file, 'utf8')
  if (data.indexOf(garbage) < 0) {
    return
  }
  data = data.replace(garbage, '')
  fs.writeFileSync(file, data)
})
