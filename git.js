
/**
* @license jspm-git
* Copyright (c) 2016 Tauren Mills, contributors
* jspm endpoint for Git Repositories
* (based on Guy Bedford's github endpoint for jspm https://github.com/jspm/github)
* License: MIT
*/

'use strict';

var path = require('path');
var Promise = require('rsvp').Promise;
var rimraf = require('rimraf');
var ncp = require('ncp').ncp;
var fs = require('fs');
var temp = require('temp');
var semver = require('semver');
var urljoin = require('url-join');
var which = require('which');
var asp = require('rsvp').denodeify;
var validUrl = require('valid-url');

var execGit = require('./exec-git');

var logging = false;

var logMsg = function(msg) {
  if (logging) {
    console.log(new Date() + ': ' + msg);
  }
};

var createGitUrl = function(basepath, repo, reposuffix, auth) {
  if (validUrl.isUri(basepath)) {
    var baseWithAuth = basepath;
    if (auth) {
      var authStr = encodeURIComponent(auth.username) + ':' + encodeURIComponent(auth.password) + '@';
      var parts = basepath.match(/^((http[s]?|ftp):\/*)(.*)/);

      baseWithAuth = parts[1] + authStr + parts[3];
    }
    return urljoin(baseWithAuth, repo + reposuffix);
  } else {
    // Assume that basepath is scp-like formated path i.e. [[user@]host]
    return basepath + ':' + repo + reposuffix;
  }
};

function encodeCredentials(auth) {
  // avoid storing passwords as plain text in config
  return new Buffer(encodeURIComponent(auth.username) + ':' + encodeURIComponent(auth.password)).toString('base64');
}

function decodeCredentials(str) {
  var auth = new Buffer(str, 'base64').toString('ascii').split(':');

  return {
    username: decodeURIComponent(auth[0]),
    password: decodeURIComponent(auth[1])
  };
}

var getGitVersion = function() {
  return new Promise(function(resolve, reject) {
    execGit('--version', null, function(err, stdout, stderr) {
      var versionArr;
      if (err) {
        logMsg('Error while reading our the Git version: ' + stderr);
        reject(stderr);
      } else {
        versionArr = stdout.match(/\d.\d.\d/);
        if (versionArr.length === 1) {
          resolve(versionArr[0]);
        } else {
          logMsg('Error while parsing the Git version');
          reject();
        }
      }
    });
  });
};

var cloneGitRepo = function(repoDir, branch, url, execOpt, shallowclone) {
  return getGitVersion().
  then(function(gitVersion) {
    return new Promise(function(resolve, reject) {
      var command, gitLegacyMode;

      // Detect if we need to run in git legacy mode
      gitLegacyMode = semver.lt(gitVersion, '1.7.10');

      command = ['clone'];

      if (shallowclone) {
        command.push('--depth 1');
      }

      // Parameters --single-branch and -b are only supported from Git version 1.7.10 or greater
      if (!gitLegacyMode) {
        command.push('-b ' + branch);
        command.push('--single-branch');
      }

      command = command.concat([url, repoDir]);

      execGit(command.join(' '), execOpt, function(err, stdout, stderr) {
        if (err) {
          var error = new Error(stderr.toString().replace(url, ''));
          error.hideStack = true;
          error.retriable = true;
          logMsg('Error while cloning the git repository: ' + error);
          rimraf(repoDir, function() {
            reject(error);
          });
        } else {
          if (gitLegacyMode) {
            execGit('checkout ' + branch, {cwd: repoDir}, function(err, stdout, stderr) {
              if (err) {
                logMsg('Error while checking out the git branch: ' + stderr);
                rimraf(repoDir, function() {
                  reject(stderr);
                });
              } else {
                resolve();
              }
            });
          } else {
            resolve();
          }
        }
      });
    });
  });
};

var exportGitRepo = function(repoDir, branch, url, execOpt, shallowclone) {
  return cloneGitRepo(repoDir, branch, url, execOpt, shallowclone).
  then(function() {
    return new Promise(function(resolve, reject) {
      // Remove the .git folder
      rimraf(path.join(repoDir, '.git'), function(err) {
        if (err) {
          logMsg('Error while removing the .git folder: ' + err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
};

var readPackageJSON = function(repoDir) {

  return new Promise(function(resolve, reject) {
    fs.readFile(path.join(repoDir, 'package.json'), 'utf8', function (err, data) {
      if (err) {
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

  // ensure git is installed
  try {
    which.sync('git');
  } catch(ex) {
    throw 'Git not installed. Please make sure that it\'s installed on your system.';
  }

  if (!semver.satisfies(options.apiVersion + '.0', '^1.0')) {
    throw 'Current jspm-git version isn\'t compatible to the jspm Endpoint API v' + options.apiVersion + '\n' +
	'Please update or install a compatible version of jspm-git.';
  }

  this.maxRepoSize = (options.maxRepoSize || 0) * 1024 * 1024;

  this.execOpt = {
    cwd: options.tmpDir,
    timeout: options.timeout * 1000,
    killSignal: 'SIGKILL',
    maxBuffer: this.maxRepoSize || 2 * 1024 * 1024
  };

  if (typeof options.reposuffix !== 'string') {
    options.reposuffix = '.git';
  }

  if (typeof options.shallowclone !== 'boolean') {
    options.shallowclone = options.shallowclone !== 'false';
  }

  this.options = options;
  if (options.auth) {
    this.auth = decodeCredentials(options.auth);
  }
};

// static configuration function
GitLocation.configure = function(config, ui) {

  return Promise.resolve(ui.input('Enter the base URL of your git server e.g. https://code.mycompany.com/git/', null))
  .then(function(baseurl) {
    if (!baseurl || baseurl === '') {
      return Promise.reject('Invalid base URL was entered');
    }
    config.baseurl = baseurl;
  }).then(function() {
    return Promise.resolve(ui.confirm('Set advanced configurations?', false))
    .then(function(advancedconfig) {
      if (advancedconfig) {
        return Promise.resolve(ui.confirm('Would you like to use the default git repository suffix (.git)?', true))
        .then(function(usedefaultsuffix) {
          if(usedefaultsuffix) {
            // Leave the reposuffix config empty in order to use the default configuration of the endpoint
            return;
          }
          return Promise.resolve(ui.confirm('Would you like to set an empty git repository suffix?', false))
          .then(function(setemptysuffix) {
            if (setemptysuffix) {
              // Set an empty repository suffix
              config.reposuffix = '';
              return;
            }
            return Promise.resolve(ui.input('Enter the git repository suffix', '.git'))
            .then(function(reposuffix) {
              // Use the entered suffix for the endpoint
              config.reposuffix = reposuffix;
            });
          });
        }).then(function() {
          return Promise.resolve(ui.confirm('Disable shallow git clones?', false))
          .then(function(shallowclone) {
            if (shallowclone) {
              return Promise.resolve(ui.confirm('Disabling shallow git clones might have severe impact on the git clone performance and you might run into jspm install timeouts. Are you sure you want to disable it?', false))
              .then(function(confirm) {
                if (confirm) {
                  config.shallowclone = !shallowclone;
                }
              });
            }
          });
        }).then(function() {
          return Promise.resolve()
            .then(function() {
              return ui.confirm('Enable authentication?', false);
            })
            .then(function(authentication) {
              if (authentication) {
                var auth = {};
                return Promise.resolve()
                  .then(function() {
                    return ui.input('Username');
                  })
                  .then(function(username) {
                    auth.username = username;
                    return ui.input('Password');
                  })
                  .then(function(password) {
                    auth.password = password;
                    return encodeCredentials(auth);
                  });
              } else {
                return null;
              }
            })
            .then(function(auth) {
              config.auth = auth;
            });
        });
      }
    });
  })
  .then(function() {
    return config;
  });
};

GitLocation.prototype = {

  // return values
  // { versions: { versionhash } }
  // { notfound: true }
  lookup: function(repo) {
    var execOpt = this.execOpt, self = this;
    return new Promise(function(resolve, reject) {
      var remoteString = createGitUrl(self.options.baseurl, repo, self.options.reposuffix, self.auth);
      execGit('ls-remote ' + remoteString + ' refs/tags/* refs/heads/*', execOpt, function(err, stdout, stderr) {
        if (err) {
          if (err.toString().indexOf('not found') == -1) {
            // dont show plain text passwords in error
            var error = new Error(stderr.toString().replace(remoteString, ''));
            error.hideStack = true;
            error.retriable = true;
            reject(error);
          }
          else
            resolve({ notfound: true });
        }

        var versions = {};
        var refs = stdout.split('\n');
        for (var i = 0; i < refs.length; i++) {
          if (!refs[i])
            continue;

          var hash = refs[i].substr(0, refs[i].indexOf('\t'));
          var refName = refs[i].substr(hash.length + 1);
          var version;
          var versionObj = { hash: hash, meta: {} };

          if (refName.substr(0, 11) == 'refs/heads/') {
            version = refName.substr(11);
            versionObj.stable = false;
          }

          else if (refName.substr(0, 10) == 'refs/tags/') {
            if (refName.substr(refName.length - 3, 3) == '^{}')
              version = refName.substr(10, refName.length - 13);
            else
              version = refName.substr(10);

            if (version.substr(0, 1) == 'v' && semver.valid(version.substr(1))) {
              version = version.substr(1);
              // note when we remove a "v" which versions we need to add it back to
              // to work out the tag version again
              versionObj.meta.vPrefix = true;
            }
          }

          versions[version] = versionObj;
        }

        resolve({ versions: versions });
      });
    });
  },

  // Prefetching the package config is not possible with Git as
  // we've always to checkout the whole repository
  // getPackageConfig: function(repo, version, hash, meta) {
  // },

  processPackageConfig: function(packageConfig, packageName) {
    if (!packageConfig.jspm || !packageConfig.jspm.files)
      delete packageConfig.files;

    if ((packageConfig.dependencies || packageConfig.peerDependencies) && !packageConfig.registry && (!packageConfig.jspm || !(packageConfig.jspm.dependencies || packageConfig.jspm.peerDependencies))) {
      var hasDependencies = false;
      for (var p in packageConfig.dependencies)
        hasDependencies = true;
      for (var q in packageConfig.peerDependencies)
        hasDependencies = true;

      if (packageName && hasDependencies) {
        var looksLikeNpm = packageConfig.name && packageConfig.version && (packageConfig.description || packageConfig.repository || packageConfig.author || packageConfig.license || packageConfig.scripts);
        var isSemver = semver.valid(packageName.split('@').pop());
        var noDepsMsg;

        // non-semver npm installs on GitHub can be permitted as npm branch-tracking installs
        if (looksLikeNpm) {
          if (!isSemver)
            noDepsMsg = 'To install this package as it would work on npm, install with a registry override via %jspm install ' + packageName + ' -o "{registry:\'npm\'}"%.';
          else
            noDepsMsg = 'If the dependencies aren\'t needed ignore this message. Alternatively set a `registry` or `dependencies` override or use the npm registry version at %jspm install npm:' + packageConfig.name + '@^' + packageConfig.version + '% instead.';
        }
        else {
          // TODO Figure out which registry to set...!
          noDepsMsg = 'If this is your own package, add `"registry": "jspm"` to the package.json to ensure the dependencies are installed.';
        }

        if (noDepsMsg) {
          delete packageConfig.dependencies;
          delete packageConfig.peerDependencies;
          this.ui.log('warn', '`' + packageName + '` dependency installs skipped as it\'s a package with no registry property set.\n' + noDepsMsg + '\n');
        }
      }
      else {
        delete packageConfig.dependencies;
        delete packageConfig.peerDependencies;
      }
    }

    if (packageConfig.directories && packageConfig.directories.lib && !packageConfig.directories.dist) {
      packageConfig.directories.dist = packageConfig.directories.lib;
      this.ui.log('warn', 'Package `' + packageName + '` has a %directories.lib% override configuration which will work, but is deprecated for %directories.dist% in future jspm versions.\n');
    }

    return packageConfig;
  },

  // always an exact version
  // assumed that this is run after getVersions so the repo exists
  download: function(repo, version, hash, meta, outDir) {

    var url, tempRepoDir, packageJSONData, self = this;

    if (meta.vPrefix) {
      version = 'v' + version;
    }

    // Automatically track and cleanup files at exit
    temp.track();

    url = createGitUrl(self.options.baseurl, repo, self.options.reposuffix, self.auth);

    return createTempDir().then(function(tempDir) {
      tempRepoDir = tempDir;
      return exportGitRepo(tempRepoDir, version, url, self.execOpt, self.options.shallowclone);
    }).then(function() {
      return readPackageJSON(tempRepoDir);
    }).then(function(data) {
      packageJSONData = data;
      return moveRepoToOutDir(tempRepoDir, outDir);
    }).then(function() {
      return packageJSONData;
    });
  },

  // check if the main entry point exists. If not, try the bower.json main.
  processPackage: function(packageConfig, packageName, dir) {
    var main = packageConfig.main || '';
    var libDir = packageConfig.directories && (packageConfig.directories.dist || packageConfig.directories.lib) || '.';

    if (main instanceof Array)
      main = main[0];

    if (typeof main != 'string')
      return;

    // convert to windows-style paths if necessary
    main = main.replace(/\//g, path.sep);
    libDir = libDir.replace(/\//g, path.sep);

    if (main.indexOf('!') != -1)
      return;

    function checkMain(main, libDir) {
      if (!main)
        return Promise.resolve(false);

      if (main.substr(main.length - 3, 3) == '.js')
        main = main.substr(0, main.length - 3);

      return new Promise(function(resolve, reject) {
        fs.exists(path.resolve(dir, libDir || '.', main) + '.js', function(exists) {
          resolve(exists);
        });
      });
    }

    return checkMain(main, libDir)
    .then(function(hasMain) {
      if (hasMain)
        return hasMain;

      return asp(fs.readFile)(path.resolve(dir, 'bower.json'))
      .then(function(bowerJson) {
        try {
          bowerJson = JSON.parse(bowerJson);
        }
        catch(e) {
          return;
        }

        main = bowerJson.main || '';
        if (main instanceof Array)
          main = main[0];

        return checkMain(main);
      }, function() {})
      .then(function(hasBowerMain) {
        if (hasBowerMain)
          return hasBowerMain;

        main = 'index';
        return checkMain(main, libDir);
      });
    })
    .then(function(hasMain) {
      if (hasMain)
        packageConfig.main = main.replace(/\\/g, '/');
      return packageConfig;
    });
  }

};

module.exports = GitLocation;
