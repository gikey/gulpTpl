'use strict';
import gulp from 'gulp';
import sass from 'gulp-sass';
import csso from 'gulp-csso';
import sequence from 'gulp-sequence';
import minify from 'gulp-minify';
import zip from 'gulp-zip';
import del from 'del';
import fs from 'fs-extra';
import swig from 'gulp-swig';
import htmlmin from 'gulp-htmlmin';
import nunjucks from 'nunjucks';
import gulpif from 'gulp-if';
import plumber from 'gulp-plumber';
import browserSync from 'browser-sync';
import sourcemaps from 'gulp-sourcemaps';
import babel from 'gulp-babel';
import postcss from 'gulp-postcss';
import utils from './utils.js';
import rev from 'gulp-rev';
import usemin from 'gulp-usemin';
import revCollector from 'gulp-rev-collector';
import config from './config.json';
import proxy from 'http-proxy-middleware';
import yargs from 'yargs';
import inject from 'gulp-inject-string';
import mergeStream from 'merge-stream';
import imagemin from 'gulp-image';
import px2rem from 'gulp-px2rem-plugin';

const options = {
    build: process.argv[2] === 'build',
    debug: yargs.argv.debug,
    cdn: yargs.argv.cdn,
    uncompress: yargs.argv.uncompress,
}

gulp.task('sass', callback => {
    gulp.src(['src/static/scss/**/*.scss', '!src/static/scss/lib/**/*'])
        .pipe(gulpif(!options.build, plumber()))
        .pipe(gulpif(!options.build, sourcemaps.init()))
        .pipe(sass())
        .on('end', () => utils.logger(`🦊  sass 编译完成 `))
        .pipe(gulpif(!config.remConfig.disabled, px2rem({
            'width_design': config.remConfig.widthDesign,
            'valid_num': config.remConfig.validNum,
            'ignore_px': config.remConfig.ignorePX,
            'ignoreSelector': config.remConfig.ignoreSelector,
            'pieces': config.remConfig.pieces
        })))
        .on('end', () => !config.remConfig.disabled && utils.logger(`🦊  px => rem 完成 `))
        .pipe(postcss(utils.percessors))
        .on('end', () => utils.logger(`🦊  postcss 处理完成 `))
        .pipe(gulpif(options.build, csso()))
        .on('end', () => options.build && utils.logger(`🦊  css 压缩完成 `))
        .pipe(gulpif(!options.build, sourcemaps.write('./')))
        .pipe(gulpif(!options.build, gulp.dest('src/static/css'), gulp.dest('dist/test/app/static/css')))
        .on('end', () => {
            utils.logger(`🦊  css 输出 ${ options.build ? 'dist/test/app/static/css': 'src/static/css'}`);
            callback && callback();
        })
        .pipe(gulpif(!options.build, browserSync.stream({ match: '**/*.css' })))
});

gulp.task('swig', callback => {
    gulp.src(['src/tpls/**/*.swig', '!src/tpls/**/_*.swig', 'src/tpls/**/*.html', '!src/tpls/**/_*.html'])
        .pipe(plumber())
        .pipe(swig({
            defaults: {
                cache: false
            },
            data: {
                'debug': !options.build && options.debug,
                'remConfig': {
                    disabled: config.remConfig.disabled,
                    pieces: config.remConfig.pieces
                }
            }
        }))
        .on('end', () => utils.logger(`🦊  swig 编译完成`))
        .pipe(gulpif(options.build, htmlmin({
            collapseWhitespace: true
        })))
        .on('end', () => options.build && utils.logger(`🦊  html 压缩完成`))
        .pipe(gulpif(!options.build, gulp.dest('src/views'), gulp.dest('dist/test/app/views')))
        .on('end', () => {
            utils.logger(`🦊  html 输出 ${ options.build ? 'dist/test/app/views': 'src/views'}`);
            callback && callback();
        })
});

gulp.task('revCss', callback => {
    gulp.src('dist/test/app/static/css/**/*.css')
        .pipe(rev())
        .on('end', () => utils.logger(`🦊  css 文件名 hash `))
        .pipe(gulp.dest('dist/test/app/static/css'))
        .pipe(rev.manifest())
        .pipe(gulp.dest('dist/rev/css'))
        .on('end', () => {
            utils.logger(`🦊  css manifest 文件输出到 dist/rev/css `);
            callback && callback();
        })
});

gulp.task('revImg', callback => {
    gulp.src('dist/test/app/static/images/*')
        .pipe(rev())
        .on('end', () => utils.logger(`🦊  images 文件名 hash `))
        .pipe(gulp.dest('dist/test/app/static/images'))
        .pipe(rev.manifest())
        .pipe(gulp.dest('dist/rev/images'))
        .on('end', () => {
            utils.logger(`🦊  images manifest 文件输出到 dist/rev/images `);
            callback && callback();
        })
});

gulp.task('revHtml', callback => {
    let revConfig = { replaceReved: true };
    if(options.cdn) {
        revConfig.dirReplacements = {};
        config.staticResource.staticFile.forEach((file) => {
            revConfig.dirReplacements[config.staticResource.staticFilePrefix+file] = `//${config.cdnConfig.cdnHost}/${config.cdnConfig.cdnBucket}/${file}/`
        })
    }
    gulp.src(['dist/rev/**/*.json', 'dist/test/app/views/**/*.html'])
        .pipe(revCollector(revConfig))
        .pipe(gulp.dest('dist/test/app/views'))
        .on('end', function() {
            utils.logger(`🦊  html 外链替换 `);
            callback && callback();
        })
});

gulp.task('revJS', callback => {
    gulp.src('dist/test/app/static/js/**/*.js')
        .pipe(rev())
        .on('end', () => utils.logger(`🦊  js 文件名 hash `))
        .pipe(gulp.dest('dist/test/app/static/js'))
        .pipe(rev.manifest())
        .pipe(gulp.dest('dist/rev/js'))
        .on('end', () => {
            utils.logger(`🦊  js manifest 文件输出到 dist/rev/js `);
            callback && callback();
        })
});

gulp.task('clean', callback => {
    del('dist').then( paths => {
        utils.logger(`🦊  清除 dist 目录`);
        callback && callback()
    });
});

gulp.task('config', callback => {
    let _config = config.app,
    tpl = new nunjucks.Environment(new nunjucks.FileSystemLoader('sce'));
    for(var c in _config) {
        fs.outputFileSync(`dist/${c}/app.yaml`, tpl.render('app.yaml', {
            appId: _config[c]['appId']
        }));
        utils.logger(`🦊  ${c} app.yaml 文件配置完成`);
        fs.outputFileSync(`dist/${c}/conf/nginx_server.inc`, tpl.render('conf/nginx_server.inc', {
            proxys: _config[c].proxys
        }));
        utils.logger(`🦊  ${c} nginx_server.inc 文件配置完成`);
        fs.outputFileSync(`dist/${c}/conf/uwsgi.ini`, tpl.render('conf/uwsgi.ini'));
        utils.logger(`🦊  ${c} uwsgi.ini 文件配置完成`);
    }
    callback && callback();
});

gulp.task('es6', callback => {
    gulp.src(['src/static/es6/**/*.js', '!src/static/es6/lib/**/*'])
        .pipe(gulpif(!options.build, plumber()))
        .pipe(gulpif(!options.build, sourcemaps.init()))
        .pipe(babel({
            presets: ['es2015']
        }))
        .on('end', () => utils.logger(`🦊  es6 编译完成`))
        .pipe(gulpif(options.build, minify({
            ext: {
                min:'.js'
            },
            noSource: true,
            preserveComments: 'some',
            ignoreFiles: ['.min.js', '-min.js']
        })))
        .on('end', () => options.build && utils.logger(`🦊  js 压缩完成 `))
        .pipe(gulpif(!options.build, sourcemaps.write('./')))
        .pipe(gulpif(!options.build, gulp.dest('src/static/js'), gulp.dest('dist/test/app/static/js')))
        .on('end', () => {
            utils.logger(`🦊  js 输出 ${ options.build ? 'dist/test/app/static/js': 'src/static/js'}`);
            callback && callback();
        })
});

gulp.task('copy', callback => {
    gulp.src('dist/test/**/*')
        .pipe(gulp.dest('dist/prod'))
        .on('end', () => {
            utils.logger(`🦊  拷贝 test 目录到 prod`);
            callback && callback();
        })
});

gulp.task('copyLib', callback => {
    gulp.src('src/static/**/lib/*')
        .pipe(gulp.dest('dist/test/app/static'))
        .on('end', () => {
            utils.logger(`🦊 拷贝 lib 目录到 test/app/static`);
            callback &&  callback();
        })
});

gulp.task('imageMin', callback => {
    gulp.src('src/static/images/**/*')
        .pipe(gulpif(!options.uncompress, imagemin({
            pngquant: true,
            optipng: false,
            zopflipng: true,
            jpegRecompress: false,
            mozjpeg: true,
            guetzli: false,
            gifsicle: true,
            svgo: true,
            concurrent: 10
        })))
        .on('end', () => !options.uncompress && utils.logger(`🦊  图片压缩完成`))
        .pipe(gulp.dest('dist/test/app/static/images'))
        .on('end', () => {
            utils.logger(`🦊  图片输出到 test/app/static/images`);
            callback &&  callback();
        })
})

gulp.task('usemin', callback => {
    gulp.src('dist/test/app/views/*.html')
        .pipe(usemin())
        .pipe(gulp.dest('dist/test/app/views'))
        .on('end', () => {
            utils.logger(`🦊  静态文件合并完成`);
            callback && callback();
        })
});

gulp.task('zip', () => {
    let folders = ['test', 'prod'],
        cdnTasks = [],
        tasks = folders.map( element  => {
            return gulp.src(`dist/${element}/**`)
                .pipe(zip(`${element}-${+new Date}.zip`))
                .pipe(gulp.dest('dist'))
                .on('end', () => utils.logger(`🦊  ${element} 打包完成`))
        })
    if(options.cdn) {
        cdnTasks = folders.map( element => {
            return gulp.src(`dist/${element}/app/static/**`)
                .pipe(zip(`${element}-cdn-${+new Date}.zip`))
                .pipe(gulp.dest('dist'))
                .on('end', () => utils.logger(`🦊  ${element} cdn 文件打包完成`))
        })
    }
    return mergeStream(tasks.concat(cdnTasks))
});

gulp.task('debug', () => {
    if ( 'false' == options.debug ) return;
    let folders = options.debug == 'prod' ? ['test', 'prod'] : ['test'],
        tasks = folders.map( element => {
            return gulp.src(`dist/${element}/app/views/*.html`)
                .pipe(inject.before('</body>', '<script src="//res.wx.qq.com/mmbizwap/zh_CN/htmledition/js/vconsole/2.5.1/vconsole.min.js"></script>\n'))
                .pipe(gulp.dest(`dist/${element}/app/views`))
                .on('end', () => {
                    utils.logger(`🦊  ${element} 添加 vconsole `);
                })
        })
    return mergeStream(tasks)
});

gulp.task('dev', ['sass', 'es6', 'swig'], () => {
    browserSync.init({
        server: config.server.root || './',
        port: config.server.port || '3030',
        host: config.server.host || '127.0.0.1',
        open: config.server.open || 'local',
        startPath: config.server.startPath || './',
        browser: config.server.browser,
        notify: config.server.notify,
        middleware: utils.proxys,
    }, () => utils.logger(`🦊  服务启动...`));
    gulp.watch('src/static/scss/**/*.scss', ['sass']);
    gulp.watch('src/static/es6/**/*.js', ['es6']);
    gulp.watch('src/tpls/**/*', ['swig']);
    gulp.watch(['src/**/*', '!src/static/scss', '!src/static/css']).on('change', browserSync.reload);
});

gulp.task('build', sequence('clean', ['sass', 'es6', 'swig'], ['copyLib', 'imageMin'], 'usemin', ['revCss', 'revJS', 'revImg'], 'revHtml', 'copy', ['debug', 'config'], 'zip'));

gulp.task('default', () => {
    utils.logger('😊  Nothing to do');
});
