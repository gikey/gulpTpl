import chalk from 'chalk';
import proxy from 'http-proxy-middleware';
import config from './config.json';

module.exports = {
    logger(info) {
        console.log(chalk.keyword('orange')(info))
    },
    percessors: [
        require('autoprefixer')(),
        require('postcss-triangle')()
    ],
    proxys: (() => {
        let proxyArr = [];
        config.server.proxys.forEach( p => {
            proxyArr.push( proxy( p.api, {
                target: p.target,
                changeOrigin: p.changeOrigin || true,
                pathRewrite: p.pathRewrite
            }))
        })
        return proxyArr;
    })()
}
