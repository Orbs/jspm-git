var Git = require('./git');

git = new Git({
  log: true,
  tmpDir: 'tmpDir',
  timeout: 5,
  baseurl: 'https://github.com/'
});

git.getVersions('angular/bower-angular', function(versions) {
  console.log('versions:', versions);
});

//dgkang/node-buffer
git.download('angular/bower-angular', 'v1.3.0-build.51+sha.e888dde', '', 'distDir', function() {
  console.log('done');
}, function(err) {
  console.log(err);
});

