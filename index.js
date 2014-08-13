// Possibly look at component remote for Bitbucket for inspiration:
// https://github.com/component/remotes.js/blob/master/lib/remotes/bitbucket.js 

// Endpoint for Bower, seven months old, but tests included:
// https://github.com/matthewp/jspm-bower

// Endpoint for gist:
// https://github.com/matthewp/gist

'use strict';

var exec = require('child_process').exec;
var gitdownload = require('git-download');

var GitLocation = function(options) {
  this.log = options.log === false ? false : true;
  this.execOpt = {
    cwd: options.tmpDir,
    timeout: options.timeout * 1000,
    killSignal: 'SIGKILL'
  };

  this.hostName = options.hostName || '';
}

GitLocation.prototype = {

  degree: 2,

  // always an exact version
  // assumed that this is run after getVersions so the repo exists
  download: function(repo, version, hash, outDir, callback, errback) {
    if (this.log) {
      console.log(new Date() + ': Requesting git package: ' + repo);
    }

    this.getVersions(repo, function(versions) {
      if (!versions[version]) {
        errback && errback('Repository does not contain "'+version+'" tag or branch');
        return;
      }

      gitdownload({
        source: 'ssh://' + this.hostName + repo + '.git',
        tmpDir: this.execOpt.cwd,
        dest: outDir,
        branch: version
      }, function(err, tarfile) {
        if (err) {
          errback && errback(err);
          return;
        }
        callback && callback();
      });    
    }.bind(this), function(err) {  
      errback && errback(err);
    });
  
  },

  getVersions: function(repo, callback, errback) {

    var command = 'git ls-remote ssh://' + this.hostName + repo + '.git refs/tags/* refs/heads/*';
    
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

module.exports = GitLocation;
