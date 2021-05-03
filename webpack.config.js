const path = require('path')
const webpack = require('webpack')
const nodeExternals = require('webpack-node-externals')

const SERVER_PATH = './app.ys.js';

module.exports = (env, argv) => {
  return ({
    entry: {
      server: SERVER_PATH
    },
    output: {
      path: path.join(__dirname, 'dist'),
      publicPath: '/',
      filename: '[name].js'
    },
    mode: argv.mode,
    target: 'node',
    node: {
      // Need this when working with express, otherwise the build fails
      __dirname: false, // if you don't put this is, __dirname
      __filename: false // and __filename return blank or /
    },
    externals: [nodeExternals()], // Need this to avoid error when working with Express
    module: {
      rules: [
        {
          // или как вы там подписываете свои скрипты, епта
          test: /\.ys\.js$/,
          exclude: /node_modules/,
          use: {
            loader: './yopta-loader'
          }
        },
      ]
    }
  })
}
