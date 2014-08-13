var Git = require('./index');

// git ls-remote ssh://stash.nikedev.com/nid/builder.git refs/tags/* refs/heads/*
// git ls-remote ssh://stash.nikedev.com/~tmil11/id-vagrant.git refs/tags/* refs/heads/*

git = new Git({
  baseDir: '.',
  log: true,
  tmpDir: '.',
  username: '',
  password: ''
});

git.getVersions('stash.nikedev.com/~tmil11/idicons', function(versions) {
  console.log('versions:',versions);
});

git.download('stash.nikedev.com/~tmil11/idicons', '0.1.1', '', 'test-repo', function() {
  console.log('done');
}, function(err) {
  console.log(err);
});
