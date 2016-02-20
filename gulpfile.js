'use strict';

var gulp = require('gulp');
var rimraf  = require('gulp-rimraf');
var jshint = require('gulp-jshint');
var mocha = require('gulp-mocha');
var istanbul = require('gulp-istanbul');

var sources = {
  temp: '.tmp',
  lib: ['git.js'],
  test: ['git.test.js']
};

gulp.task('default', ['clean', 'lint', 'mocha']);

gulp.task('clean', function() {
  return gulp.src(sources.temp, {read: false}).pipe(rimraf());
});

gulp.task('lint', function() {
  gulp.src(sources.lib).pipe(jshint());
});

gulp.task('mocha', function() {
  gulp.src(sources.test, {read: false})
    .pipe(mocha({ reporter: 'spec'}));
});

gulp.task('coverage', function(cb) {
  gulp.src(sources.lib)
    .pipe(istanbul())
    .pipe(istanbul.hookRequire())
    .on('finish', function() {
      gulp.src(sources.test)
        .pipe(mocha({ reporter: 'spec'}))
        .pipe(istanbul.writeReports({
          dir: '.tmp/coverage'
        }))
        .on('end', cb);
    });
});

gulp.task('test', ['default']);
