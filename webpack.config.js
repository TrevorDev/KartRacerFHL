// https://webpack.js.org/guides/typescript/

const nodeExternals = require('webpack-node-externals');
const path = require('path');

module.exports = [
  {
    mode: 'development',
    entry: './server.ts',
    devtool: "inline-source-map",
    target: "node",
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        }
      ]
    },
    externals: [nodeExternals()],
    resolve: {
      extensions: ['.tsx', '.ts', '.js']
    },
    output: {
      filename: 'server.js',
      path: path.resolve(__dirname, 'dist')
    }
  },
  {
    mode: 'development',
    entry: "./kartRacer/app.ts",
    devtool: "inline-source-map",
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        }
      ]
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js']
    },
    output: {
      filename: 'kartRacer.js',
      path: path.resolve(__dirname, 'public/dist')
    }
  }
];