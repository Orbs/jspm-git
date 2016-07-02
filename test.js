var fs = require('fs');
var Git = require('./git');
var rimraf = require('rimraf');

if (!fs.existsSync('tmpDir')) {
  fs.mkdirSync('tmpDir');
}
rimraf.sync('distDir');

var git = new Git({
  apiVersion: '1.0',
  log: true,
  tmpDir: 'tmpDir',
  timeout: 5,
  baseurl: 'https://github.com/'
});

git.lookup('angular/bower-angular').then(function(versions) {
  console.log('versions:', versions);
});

//dgkang/node-buffer
git.download('angular/bower-angular', 'v1.3.0-build.51+sha.e888dde', '', {}, 'distDir')
  .then(function(result) {
    console.log(result);
    console.log('done');
  }, function(err) {
    console.log(err);
    console.log('failed');
  });

