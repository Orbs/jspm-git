var Git = require('./index');

git = new Git({
  log: true,
  tmpDir: '.'
});

git.getVersions('bitbucket.com/dgkang/node-buffer', function(versions) {
  console.log('versions:',versions);
});

git.download('bitbucket.com/dgkang/node-buffer', 'master', '', 'test-repo', function() {
  console.log('done');
}, function(err) {
  console.log(err);
});

