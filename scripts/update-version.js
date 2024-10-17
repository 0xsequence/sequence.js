const fs = require('fs')
const path = require('path')

const rootPath = path.resolve(__dirname, '../packages/core')
const packagePath = path.join(rootPath, 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
const versionPath = path.join(rootPath, 'src', 'version.ts')

fs.writeFileSync(versionPath, `export const VERSION = '${packageJson.version}'\n`, 'utf8')

console.log(`Updated version to ${packageJson.version}`)
