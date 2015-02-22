'use strict';

var fs = require('fs');

var gulp = require('gulp');
var wiredep = require('wiredep');
var karma = require('gulp-karma');
var protractor = require('gulp-protractor');

var env = require('../utils/env');
var log = require('../utils/log');
var plugins = require('../utils/plugins');

var getTestFiles = function () {
  // 添加所有bower文件
  var bowerDeps = [];
  if (fs.existsSync(env.folders.library)) {
    bowerDeps = wiredep({
      directory: env.folders.library,
      dependencies: true,
      devDependencies: true
    }).js;
  }
  var bowerFiles = gulp.src(bowerDeps, {read: false});

  var filter = '/**/*.js';
  // 添加app目录中除了bower之外的所有文件
  var appFiles = gulp.src([env.folders.app + filter, '!' + env.folders.library + filter], {base: env.folders.app});
  // 添加临时目录下的文件，这些通常是coffee等文件的编译结果
  var tmpFiles = gulp.src([env.folders.temp + '/app' + filter, '!' + env.folders.temp + '/app/bower_components' + filter], {base: env.folders.temp + '/app'});
  // 按照angular依赖关系排序
  var sortedFiles = plugins.merge(appFiles, tmpFiles)
    .pipe(plugins.angularFileSort())
    // merge不能确保两个流中文件的顺序，所以稍微延迟一下，以确保bower的文件排在app文件的前面。
    .pipe(plugins.wait(200));

  var testFiles = gulp.src(env.folders.test + '/unit/**/*.js', {read: false})
    .pipe(plugins.wait(400));
  return plugins.merge(bowerFiles, sortedFiles, testFiles);
};
gulp.task('ut', function () {
  return getTestFiles()
    .pipe(karma({
      configFile: env.folders.test + '/karma.conf.js',
      action: 'run'
    }))
    .on('error', function () {
      // Make sure failed tests cause gulp to exit non-zero
      log.error("Unit test Failed!")
    });
});

gulp.task('tdd', function () {
  // TODO: 看看添加/删除文件时是否有问题
  return getTestFiles()
    .pipe(karma({
      configFile: env.folders.test + '/karma.conf.js',
      action: 'watch'
    }))
    .on('error', function () {
      // Make sure failed tests cause gulp to exit non-zero
      log.error("Unit test Failed!")
    });
});

gulp.task('e2e', function (done) {
  var testFiles = [
    env.folders.test + '/e2e/**/*.js'
  ];

  gulp.src(testFiles)
    .pipe(protractor.protractor({
      configFile: 'test/protractor.conf.js'
    }))
    .on('error', function (err) {
      log.error("端到端测试运行失败");
      process.exit(1);
    })
    .on('end', function () {
      done();
      process.exit();
    });
});

gulp.task('test', function (done) {
  plugins.runSequence('ut', 'e2e', done)
});