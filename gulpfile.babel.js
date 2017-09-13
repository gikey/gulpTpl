import gulp from 'gulp';
import sass from 'gulp-sass';
import csso from 'gulp-csso';
import sequence from 'gulp-sequence';
import uglify from 'gulp-uglify';
import zip from 'gulp-zip';
import del from 'del';
import fs from 'fs-extra';
import swig from 'gulp-swig';
import htmlmin from 'gulp-htmlmin';
import nunjucks from 'nunjucks';
import gulpif from 'gulp-if';
import px2rem from 'gulp-px2rem-plugin';
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


let build = process.argv[2] === 'build';

gulp.task('sass', callback => {
    gulp.src(['src/static/scss/**/*.scss', '!src/static/scss/lib/**/*'])
        .pipe(gulpif(!build, plumber()))
        .pipe(gulpif(!build, sourcemaps.init()))
        .pipe(sass())
        .on('end', () => {
            utils.logger(`🦊  sass 编译完成 `);
        })
        .pipe(postcss(utils.percessors))
        .on('end', () => {
            utils.logger(`🦊  postcss 处理完成 `);
        })
        .pipe(gulpif(build, csso()))
        .on('end', () => {
            build && utils.logger(`🦊  css 压缩完成 `);
        })
        .pipe(gulpif(!build, sourcemaps.write('./')))
        .pipe(gulpif(!build, gulp.dest('src/static/css'), gulp.dest('dist/dev/app/static/css')))
        .on('end', () => {
            utils.logger(`🦊  css 输出 ${ build ? 'dist/dev/app/static/css': 'src/static/css'}`);
            callback && callback();
        })
        .pipe(gulpif(!build, browserSync.stream({ match: '**/*.css' })))
});

gulp.task('swig', callback => {
    gulp.src(['src/tpls/**/*.swig', '!src/tpls/**/_*.swig', 'src/tpls/**/*.html', '!src/tpls/**/_*.html'])
        .pipe(plumber())
        .pipe(swig({
            defaults: {
                cache: false
            }
        }))
        .on('end', () => {
            utils.logger(`🦊  swig 编译完成`);
        })
        .pipe(gulpif(build, htmlmin({
            collapseWhitespace: true
        })))
        .on('end', () => {
            build && utils.logger(`🦊  html 压缩完成`);
        })
        .pipe(gulpif(!build, gulp.dest('src/views'), gulp.dest('dist/dev/app/views')))
        .on('end', () => {
            utils.logger(`🦊  html 输出 ${ build ? 'dist/dev/app/views': 'src/views'}`);
            callback && callback();
        })
});

gulp.task('revCss', callback => {
    gulp.src('dist/dev/app/static/css/**/*.css')
        .pipe(rev())
        .on('end', () => {
            utils.logger(`🦊  css 文件名 hash `)
        })
        .pipe(gulp.dest('dist/dev/app/static/css'))
        .pipe(rev.manifest())
        .pipe(gulp.dest('dist/rev/css'))
        .on('end', () => {
            utils.logger(`🦊  css manifest 文件输出到 dist/rev/css `);
            callback && callback();
        })
});

gulp.task('revImg', callback => {
    gulp.src('dist/dev/app/static/images/*')
        .pipe(rev())
        .on('end', () => {
            utils.logger(`🦊  images 文件名 hash `)
        })
        .pipe(gulp.dest('dist/dev/app/static/images'))
        .pipe(rev.manifest())
        .pipe(gulp.dest('dist/rev/images'))
        .on('end', () => {
            utils.logger(`🦊  images manifest 文件输出到 dist/rev/images `);
            callback && callback();
        })
});

gulp.task('revHtml', callback => {
    gulp.src(['dist/rev/**/*.json', 'dist/dev/app/views/**/*.html'])
        .pipe(revCollector({
            replaceReved: true
        }))
        .pipe(gulp.dest('dist/dev/app/views'))
        .on('end', function() {
            utils.logger(`🦊  html 外链替换 `);
            callback && callback();
        })
});

gulp.task('revJS', callback => {
    gulp.src('dist/dev/app/static/js/**/*.js')
        .pipe(rev())
        .on('end', () => {
            utils.logger(`🦊  js 文件名 hash `);
        })
        .pipe(gulp.dest('dist/dev/app/static/js'))
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
    tpl = new nunjucks.Environment(new nunjucks.FileSystemLoader('nginx'));

    for(var c in _config) {
        fs.outputFileSync(`dist/${c}/app.yaml`, tpl.render('app.yaml', {appId: _config[c]['appId']}));
        utils.logger(`🦊  ${c} app.yaml 文件配置完成`);
        fs.outputFileSync(`dist/${c}/conf/nginx_server.inc`, tpl.render('conf/nginx_server.inc', {host: _config[c]['host']}));
        utils.logger(`🦊  ${c} nginx_server.inc 文件配置完成`);
        fs.outputFileSync(`dist/${c}/conf/uwsgi.ini`, tpl.render('conf/uwsgi.ini'));
        utils.logger(`🦊  ${c} uwsgi.ini 文件配置完成`);
    }
    callback && callback();
});

gulp.task('es6', callback => {
    gulp.src(['src/static/es6/**/*.js', '!src/static/es6/lib/**/*'])
        .pipe(gulpif(!build, plumber()))
        .pipe(gulpif(!build, sourcemaps.init()))
        .pipe(babel({
            presets: ['es2015']
        }))
        .on('end', () => {
            utils.logger(`🦊  es6 编译完成`);
        })
        .pipe(gulpif(build, uglify()))
        .on('end', () => {
            build && utils.logger(`🦊  js 压缩完成 `);
        })
        .pipe(gulpif(!build, sourcemaps.write('./')))
        .pipe(gulpif(!build, gulp.dest('src/static/js'), gulp.dest('dist/dev/app/static/js')))
        .on('end', () => {
            utils.logger(`🦊  js 输出 ${ build ? 'dist/dev/app/static/js': 'src/static/js'}`);
            callback && callback();
        })
});

gulp.task('copy', callback => {
    gulp.src('dist/dev/**/*')
        .pipe(gulp.dest('dist/production'))
        .on('end', () => {
            utils.logger(`🦊  拷贝 dev 目录到 production`);
            callback && callback();
        })
});

gulp.task('copyLib', callback => {
    gulp.src('src/static/**/lib/*')
        .pipe(gulp.dest('dist/dev/app/static'))
        .on('end', () => {
            utils.logger(`🍹 拷贝 lib 目录到 dev/app/static`);
            callback &&  callback();
        })
});

gulp.task('copyImg', callback => {
    gulp.src('src/static/images/**/*')
        .pipe(gulp.dest('dist/dev/app/static/images'))
        .on('end', () => {
            utils.logger(`🦊  拷贝图片到 dev/app/static/images`);
            callback &&  callback();
        })
});

gulp.task('usemin', callback => {
    gulp.src('dist/dev/app/views/*.html')
        .pipe(usemin())
        .pipe(gulp.dest('dist/dev/app/views'))
        .on('end', () => {
            utils.logger(`🦊  静态文件合并完成`);
            callback && callback();
        })
})

gulp.task('zip', callback => {
    gulp.src('dist/dev/**')
        .pipe(zip(`dev-${+new Date}.zip`))
        .pipe(gulp.dest('dist'))
        .on('end', () => {
            utils.logger(`🦊  dev 打包完成`);
        })
    gulp.src('dist/production/**')
        .pipe(zip(`production-${+new Date}.zip`))
        .pipe(gulp.dest('dist'))
        .on('end', () => {
            utils.logger(`🦊  production 打包完成`);
        })
})

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
    }, () => {
        utils.logger(`🦊  服务启动...`)
    });

    gulp.watch('src/static/scss/**/*.scss', ['sass']);
    gulp.watch('src/static/es6/**/*.js', ['es6']);
    gulp.watch('src/tpls/**/*', ['swig']);
    gulp.watch(['src/**/*', '!src/static/scss', '!src/static/css']).on('change', browserSync.reload);
});

gulp.task('build', sequence('clean', ['sass', 'es6', 'swig'], ['copyLib', 'copyImg'], 'usemin', ['revCss', 'revJS', 'revImg'], 'revHtml', 'copy', 'config', 'zip'));

gulp.task('default', () => {
    utils.logger('😊  Nothing to do');
})
