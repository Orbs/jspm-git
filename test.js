var Nike = require('./index');

// git ls-remote ssh://stash.nikedev.com/nid/builder.git refs/tags/* refs/heads/*
// git ls-remote ssh://stash.nikedev.com/~tmil11/id-vagrant.git refs/tags/* refs/heads/*

nike = new Nike({
  log: true,
  tmpDir: '.',
});

nike.getVersions('~tmil11/idicons', function(versions) {
  console.log('versions:',versions);
});

nike.download('~tmil11/idicons', '0.1.1', '', 'test-repo', function() {
  console.log('done');
}, function(err) {
  console.log(err);
});
