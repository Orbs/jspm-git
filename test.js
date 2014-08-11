var Stash = require('./index');

// git ls-remote ssh://stash.nikedev.com/nid/builder.git refs/tags/* refs/heads/*
// git ls-remote ssh://stash.nikedev.com/~tmil11/id-vagrant.git refs/tags/* refs/heads/*

stash = new Stash({
  hostName: 'stash.nikedev.com',
  baseDir: '.',
  log: true,
  tmpDir: '.',
  username: '',
  password: ''
});

stash.getVersions('~tmil11/idicons', function(versions) {
  console.log('versions:',versions);
  stash.download('~tmil11/idicons', 'master', '', 'test-repo', function() {
    console.log('done');
  }, function(err) {
    console.log(err);
  });
});
