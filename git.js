
/**
* @license jspm-git
* Copyright (c) 2014 Tauren Mills, contributors
* JSPM endpoint for Git Repositories
* License: MIT
*/

'use strict';

var exec = require('child_process').exec;
var path = require('path');
var Promise = require('rsvp').Promise;
var rimraf = require('rimraf');
var ncp = require('ncp').ncp;
var fs = require('fs');
var temp = require('temp');
var semver = require('semver');

var logging = false;
var vPrefixVersions = [];

var logMsg = function(msg) {
  if (logging) {
    console.log(new Date() + ': ' + msg);
  }
};

var createGitUrl = function(basepath, repo, reposuffix) {
  return basepath + repo + reposuffix;
};

var exportGitRepo = function(repoDir, branch, url, execOpt) {

  var command = 'git clone -b ' + branch + ' --depth 1 --single-branch ' + url + ' ' + repoDir;

  return new Promise(function(resolve, reject) {
    exec(command, execOpt, function(err, stdout, stderr) {
      if (err) {
        logMsg('Error while cloning git branch: ' + stderr);
        rimraf(repoDir, function() {
          reject(stderr);
        });
      } else {
        // Remove the .git folder
        rimraf(path.join(repoDir, '.git'), function(err) {
          if (err) {
            logMsg('Error while removing the .git folder: ' + err);
            reject(err);
          } else {
            resolve();
          }
        });
      }
    });
  });
};

var readPackageJSON = function(repoDir) {

  return new Promise(function(resolve, reject) {
    fs.readFile(path.join(repoDir, 'package.json'), 'utf8', function (err, data) {
      if (err) {
        logMsg('Warn: No package.json found');
        resolve({});
      } else {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          logMsg('Error while parsing package.json: ' + err);
          reject(err);
        }
      }
    });
  });
};

var moveRepoToOutDir = function(repoDir, outDir) {

  return new Promise(function(resolve, reject) {
    ncp(repoDir, outDir, {'stopOnErr': true}, function(err) {
      if (err) {
        logMsg('Error while moving repo to outDir: ' + err);
        // Make sure the the outDir gets removed
        rimraf(outDir, function() {
          reject(err);
        });
      } else {
        rimraf(repoDir, function() {
          resolve();
        });
      }
    });
  });
};

var createTempDir = function() {

  return new Promise(function(resolve, reject) {
    temp.mkdir('jspm-git-', function(err, tempDirPath) {
      if (err) {
        reject();
      } else {
        resolve(tempDirPath);
      }
    });
  });
};

var GitLocation = function(options) {

  logging = options.log === false ? false : true;

  this.execOpt = {
    cwd: options.tmpDir,
    timeout: options.timeout * 1000,
    killSignal: 'SIGKILL'
  };

  if (typeof options.reposuffix !== 'string') {
    options.reposuffix = '.git';
  }

  this.options = options;
};


GitLocation.prototype = {

  parse: function(name) {
    var parts = name.split('/');
    var packageName = parts.splice(0, 2).join('/');
    return {
      package: packageName,
      path: parts.join('/')
    };
  },

  // return values
  // { versions: { versionhash } }
  // { redirect: 'newrepo' }
  // { notfound: true }
  lookup: function(repo) {
    var self = this;
    return new Promise(function(resolve, reject) {

      var versions, cancel,
          url = createGitUrl(self.options.baseurl, repo, self.options.reposuffix);

      exec('git ls-remote ' + url + ' refs/tags/* refs/heads/*', self.execOpt, function(err, stdout, stderr) {
        if (cancel)
          return;

        if (err) {
          if ((err + '').indexOf('Repository not found') == -1) {
            cancel = true;
            reject(stderr);
          }
          return;
        }

        versions = {};
        var refs = stdout.split('\n');
        for (var i = 0; i < refs.length; i++) {
          if (!refs[i])
            continue;

          var hash = refs[i].substr(0, refs[i].indexOf('\t'));
          var refName = refs[i].substr(hash.length + 1);
          var version;

          if (refName.substr(0, 11) == 'refs/heads/')
            version = refName.substr(11);

          else if (refName.substr(0, 10) == 'refs/tags/') {
            if (refName.substr(refName.length - 3, 3) == '^{}')
              version = refName.substr(10, refName.length - 13);
            else
              version = refName.substr(10);
          }

          if (version.substr(0, 1) == 'v' && semver.valid(version.substr(1))) {
            version = version.substr(1);
            // note when we remove a "v" which versions we need to add it back to
            // to work out the tag version again
            vPrefixVersions.push(repo + '@' + version);
          }

          versions[version] = hash;
        }

        resolve({ versions: versions });
      });
    });
  },

  // always an exact version
  // assumed that this is run after getVersions so the repo exists
  download: function(repo, version, hash, outDir) {

    var url, tempRepoDir, packageJSONData, self = this;

    if (vPrefixVersions.indexOf(repo + '@' + version) != -1) {
      version = 'v' + version;
    }

    // Automatically track and cleanup files at exit
    temp.track();

    url = createGitUrl(this.options.baseurl, repo, this.options.reposuffix);

    return createTempDir().then(function(tempDir) {
      tempRepoDir = tempDir;
      return exportGitRepo(tempRepoDir, version, url, self.execOpt);
    }).then(function() {
      return readPackageJSON(tempRepoDir);
    }).then(function(data) {
      packageJSONData = data;
      return moveRepoToOutDir(tempRepoDir, outDir);
    }).then(function() {
      return packageJSONData;
    });
  }
};

module.exports = GitLocation;
