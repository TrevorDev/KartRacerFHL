// https://webpack.js.org/guides/typescript/
var nodeExternals = require('webpack-node-externals');
var glob = require("glob")
const path = require('path');


module.exports = [{
  entry: './server.ts',
  mode: 'development',
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
    extensions: [ '.tsx', '.ts', '.js' ]
  },
  output: {
    filename: 'server.js',
    path: path.resolve(__dirname, 'dist')
  }
},
{
  entry: "./kartRacer/app.ts",
  mode: 'development',
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
    extensions: [ '.tsx', '.ts', '.js' ]
  },
  output: {
    filename: 'kartRacer.js',
    path: path.resolve(__dirname, 'public/dist')
  }
}
];