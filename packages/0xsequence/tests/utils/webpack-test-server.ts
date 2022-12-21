import webpack from 'webpack'
import WebpackDevServer from 'webpack-dev-server'
import webpackTestConfig from '../webpack.config'

export const DEFAULT_PORT = 9999

// NOTE: currently not in use, instead we run the server as a separate process via `pnpm test:server`

export const createWebpackTestServer = async (port = DEFAULT_PORT) => {
  const testServer = new WebpackDevServer(
    // @ts-ignore
    webpack(webpackTestConfig),
    {
      clientLogLevel: 'silent',
      open: false,
      host: '0.0.0.0',
      historyApiFallback: true,
      stats: 'errors-only',
      disableHostCheck: true,
      publicPath: '/',
      inline: false,
      hot: false
    }
  )

  await testServer.listen(port, '0.0.0.0', function (err) {
    if (err) {
      console.error(err)
    }
  })
}
