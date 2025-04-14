const path = require('path')
const fs = require('fs')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')

const port = process.env['PORT'] || 9999

const appDirectory = fs.realpathSync(process.cwd())
const resolveCwd = (relativePath) => path.resolve(appDirectory, relativePath)

const resolvePackages = () => {
  const pkgs = path.resolve(fs.realpathSync(process.cwd()), '..')
  return fs.readdirSync(pkgs).reduce((list, dir) => {
    const p = path.join(pkgs, dir, 'src')
    if (fs.existsSync(p)) {
      list.push(p)
    }
    return list
  }, [])
}

// Include extra sources for compilation.
//
// NOTE: if you experience an error in your webpack builder such as, 
// Module parse failed: Unexpected token (11:20)
// You may need an appropriate loader to handle this file type, currently no loaders are
// configured to process this file. See https://webpack.js.org/concepts#loaders
//
// The above error is due to not passing the TypeScript files to the module.rules for
// babel below. The solution is to include the path to the source files below, and
// the error will go away.
const resolveExtras = [
  // resolveCwd('../wallet/tests/utils'),
  resolveCwd('../../node_modules/@0xsequence/wallet-contracts/gen')
]

const resolveTestEntries = (location) => {
  return fs.readdirSync(location).reduce((list, f) => {
    const n = path.join(location, f)
    if (fs.lstatSync(n).isDirectory()) {
      list.push(...resolveTestEntries(n))
    } else {
      if (n.endsWith(".test.ts") > 0) list.push(n)
    }
    return list
  }, [])
}

const resolveEntry = () => {
  const browserTestRoot = fs.realpathSync(path.join(process.cwd(), 'tests', 'browser'))
  const entry = { 'lib': './src/index.ts' }
  const testEntries = resolveTestEntries(browserTestRoot)
  testEntries.forEach(v => entry[v.slice(browserTestRoot.length+1, v.length-3)] = v)
  return entry
}

const resolveHtmlPlugins = (entry) => {
  const plugins = []
  for (let k in entry) {
    if (k === 'lib') continue
    plugins.push(new HtmlWebpackPlugin({
      inject: false,
      filename: `${k}.html`,
      templateContent: htmlTemplate(k)
    }))
  }
  return plugins
}

const htmlTemplate = (k) => `<!doctype html>
<html lang="">
<head>
  <meta charset="utf-8">
  <title>test</title>
</head>
<body>
  <h1>${k}</h1>

  <div>
    <button id="testButton">TEST</button>
  </div>
</body>

<script src="/lib.js"></script>
<script src="/${k}.js"></script>
<script>
  const testButton = document.getElementById('testButton')
  testButton.onclick = async (e) => {
    e.preventDefault()
    if (lib.tests) {
      await lib.tests()
      console.table(window.__testResults)
    } else {
      console.warn('=> tests() is undefined. skipping..')
    }
  }
</script>
</html>
`

const entry = resolveEntry()

module.exports = {
  mode: 'none',
  context: process.cwd(),
  entry: entry,
  output: {
    library: 'lib',
    libraryTarget: 'umd'
  },
  watch: false,
  plugins: [...resolveHtmlPlugins(entry)],
  module: {
    rules: [
      {
        test: /\.(js|mjs|ts)$/,
        include: [...resolvePackages(), resolveCwd('./tests'), ...resolveExtras],
        loader: require.resolve('babel-loader'),
        options: {
          presets: ['@babel/preset-typescript'],
          plugins: [
            [require.resolve('@babel/plugin-transform-class-properties'), { loose: true }]
          ],
          cacheCompression: false,
          compact: false,
        },
      },
      {
        test: /\.(jpe?g|png|gif|svg)$/i,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 8192000
            }
          }
        ]
      }
    ]
  },
  resolve: {
    modules: ['node_modules', resolveCwd('node_modules')],
    extensions: ['.ts', '.js', '.png', '.jpg', '.d.ts'],
    alias: {},
    fallback: {
      fs: false,
      stream: false,
      readline: false,
      assert: false
    }
  },
  devServer: {
    clientLogLevel: 'silent',
    open: false,
    host: '0.0.0.0',
    port: port,
    historyApiFallback: true,
    stats: 'errors-only',
    disableHostCheck: true,
    contentBase: path.resolve(process.cwd(), 'tests/browser'),
    publicPath: '/',
    inline: false,
    hot: false
  }
}
