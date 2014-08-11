// Possibly look at component remote for Bitbucket for inspiration:
// https://github.com/component/remotes.js/blob/master/lib/remotes/bitbucket.js 

// Download all files in repo into a tar file
// git archive --format=tar --remote=ssh://stash.nikedev.com/~tmil11/idicons.git master > foo.tgz

// Download all files in icons folder exploded to the local directory
// git archive --format=tar --remote=ssh://stash.nikedev.com/~tmil11/idicons.git master:icons | tar xf -

var exec = require('child_process').exec;
var download = require('git-download');

var StashLocation = function(options) {
  this.log = options.log === false ? false : true;
  this.execOpt = {
    cwd: options.tmpDir,
    timeout: options.timeout * 1000,
    killSignal: 'SIGKILL'
  };

  this.hostName = 'ssh://'+options.hostName+'/';
}

StashLocation.prototype = {

  degree: 2,

  // always an exact version
  // assumed that this is run after getVersions so the repo exists
  download: function(repo, version, hash, outDir, callback, errback) {
    if (this.log) {
      console.log(new Date() + ': Requesting package stash: ' + repo);
    }

    download({
      source: this.hostName + repo + '.git',
      dest: outDir,
      branch: version
    }, function(err, tarfile) {
      if (err) {
        errback && errback(err);
        return;
      }
      callback && callback();
    });

  },

  getVersions: function(repo, callback, errback) {

    var command = 'git ls-remote ' + this.hostName + repo + '.git refs/tags/* refs/heads/*';
    
    exec(command, this.execOpt, function(err, stdout, stderr) {

      if (err) {
        if ((err + '').indexOf('Repository does not exist') != -1) {
          callback && callback();
          return;
        }
        errback && errback(stderr);
        return;
      }

      var versions = {};
      var refs = stdout.split('\n');

      for (var i = 0, len = refs.length; i < len; i++) {
        if (!refs[i]) {
          continue;
        }
        
        var hash = refs[i].substr(0, refs[i].indexOf('\t'));
        var refName = refs[i].substr(hash.length + 1);

        if (refName.substr(0, 11) == 'refs/heads/') {
          versions[refName.substr(11)] = hash;
        }
        else if (refName.substr(0, 10) == 'refs/tags/') {
          if (refName.substr(refName.length - 3, 3) == '^{}') {
            versions[refName.substr(10, refName.length - 13)] = hash;
          }
          else {
            versions[refName.substr(10)] = hash;
          }
        }
      }

      callback && callback(versions);
    });
  }
};

module.exports = StashLocation;
