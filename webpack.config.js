const path = require('path');
const CompressionPlugin = require('compression-webpack-plugin');
const BrotliPlugin = require('brotli-webpack-plugin');
const webpack = require('webpack');

module.exports = {
    entry: './src/main.js',

    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'wavelet-gas-estimate.umd.js',
        library: 'wavelet-gas-estimate',
        libraryTarget: 'commonjs2',
        umdNamedDefine: true,
        globalObject: 'window'
    },
    mode: 'development',
    target: 'web',
    node: {
        fs: "empty"
    },
    module: {
        rules: [
            {
                test: /\.wasm$/,
                loaders: ['arraybuffer-loader'],
                type: "javascript/auto"
            }
        ]
    },

    plugins: [
        // new webpack.ProvidePlugin({
        //     window: 'window',
        //     // ...
        // })
        //     new BrotliPlugin(),
        //     new CompressionPlugin()
    ],
};