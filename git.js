
/**
* @license jspm-git
* Copyright (c) 2014-2016 Tauren Mills, contributors
* jspm endpoint for Git Repositories
* (based on Guy Bedford's github endpoint for jspm https://github.com/jspm/github)
* License: MIT
*/

'use strict';

var path = require('path');
var Promise = require('bluebird');
var asp = require('bluebird').Promise.promisify;
var rimraf = require('rimraf');
var ncp = require('ncp').ncp;
var mkdirp = require('mkdirp');
var fs = require('fs');
var temp = require('temp');
var semver = require('semver');
var urljoin = require('url-join');
var which = require('which');
var validUrl = require('valid-url');

// try {
//   var netrc = require('netrc')();
// }
// catch(e) {}

var execGit = require('./exec-git');

var logging = false;

function extend(dest, src) {
  for (var key in src) {
    dest[key] = src[key];
  }

  return dest;
}

var logMsg = function(msg) {
  if (logging) {
    console.log(new Date() + ': ' + msg);
  }
};

var createBaseUrl = function(baseurl, auth) {
  if (validUrl.isUri(baseurl)) {
    var baseWithAuth = baseurl;
    if (auth) {
      var authStr = encodeURIComponent(auth.username) + ':' + encodeURIComponent(auth.password) + '@';
      var parts = baseurl.match(/^((http[s]?|ftp|ssh):\/*)(.*)/);
      baseWithAuth = parts[1] + authStr + parts[3];
    }
    return baseWithAuth;
  } else {
    return null;
  }
};

var createGitUrl = function(baseurl, repo, reposuffix, auth) {
  if (validUrl.isUri(baseurl)) {
    var baseWithAuth = createBaseUrl(baseurl, auth);
    return urljoin(baseWithAuth, repo + reposuffix);
  } else {
    // Assume that baseurl is scp-like formated path i.e. [[user@]host]
    return baseurl + ':' + repo + reposuffix;
  }
};

// avoid storing passwords as plain text in config
function encodeCredentials(auth) {
  return new Buffer(auth.username + ':' + auth.password).toString('base64');
}

function decodeCredentials(str) {
  var auth = new Buffer(str, 'base64').toString('utf8').split(':');

  var username, password;

  try {
    username = decodeURIComponent(auth[0]);
    password = decodeURIComponent(auth[1]);
  }
  catch(e) {
    username = auth[0];
    password = auth[1];
  }

  return {
    username: username,
    password: password
  };
}

// function readNetrc(hostname) {
//   var creds = netrc[hostname];
//
//   if (creds) {
//     return {
//       username: creds.login,
//       password: creds.password
//     };
//   }
// }

var getGitVersion = function() {
  return new Promise(function(resolve, reject) {
    execGit(['--version'], null, function(err, stdout, stderr) {
      var versionArr;
      if (err) {
        logMsg('Error while reading our the Git version: ' + stderr);
        reject(stderr);
      } else {
        versionArr = stdout.match(/\d+.\d+.\d+/);
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
        command.push('--depth', '1');
      }

      // Parameters --single-branch and -b are only supported from Git version 1.7.10 or greater
      if (!gitLegacyMode) {
        command.push('-b', branch, '--single-branch');
      }

      command.push(url, repoDir);

      execGit(command, execOpt, function(err, stdout, stderr) {
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
            execGit(['checkout', branch], {cwd: repoDir}, function(err, stdout, stderr) {
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
    mkdirp(outDir, function(err) {
      if (err) {
        return reject(err);
      }
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

var GitLocation = function(options, ui) {

  logging = options.log === false ? false : true;

  // ensure git is installed
  try {
    which.sync('git');
  } catch(ex) {
    throw 'Git not installed. Please make sure that it\'s installed on your system.';
  }

  if (!semver.satisfies(options.apiVersion + '.0', '^2.0')) {
    throw 'Current jspm-git version isn\'t compatible to the jspm Endpoint API v' + options.apiVersion + '\n' +
	'Please update or install a compatible version of jspm-git.';
  }

  this.maxRepoSize = (options.maxRepoSize || 0) * 1024 * 1024;

  this.execOpt = {
    cwd: options.tmpDir,
    timeout: (options.timeout || 0) * 1000,
    killSignal: 'SIGKILL',
    maxBuffer: this.maxRepoSize || 2 * 1024 * 1024,
    env: extend({}, process.env)
  };

  if (typeof options.version !== 'string') {
    options.version = '1.0';
  }

  if (typeof options.reposuffix !== 'string') {
    options.reposuffix = '.git';
  }

  if (typeof options.shallowclone !== 'boolean') {
    options.shallowclone = options.shallowclone !== 'false';
  }

  this.options = options;
  if (typeof options.auth == 'string') {
    this.auth = decodeCredentials(options.auth);
  }
  // } else {
  //   this.auth = readNetrc(options.hostname);
  // }

  if (typeof options.packageNameFormats !== 'string'
      || (typeof options.packageNameFormats === 'string' && options.packageNameFormats.replace(/ /g,'') === '')) {
    options.packageNameFormats = '*/*'
  }
  // Expose package formats to jspm
  GitLocation.packageNameFormats = options.packageNameFormats.replace(/ /g,'').split(',');

  this.ui = ui;
};

// static configuration function
GitLocation.configure = function(config, ui) {

  config.version = '1.0';

  return Promise.resolve(ui.input('Enter the base URL of your git server', config.baseurl))
  .then(function(baseurl) {
    if (!baseurl || baseurl === '' || !validUrl.isUri(baseurl)) {
      return Promise.reject('Invalid base URL was entered');
    }
    config.baseurl = baseurl;
  }).then(function() {
    return Promise.resolve(ui.confirm('Set advanced configurations?', false))
    .then(function(advancedconfig) {
      if (advancedconfig) {
        return Promise.resolve()
        .then(function() {
          return Promise.resolve()
          .then(function() {
            var authEnabled = config.auth !== null && config.auth !== undefined;
            if (!authEnabled) {
              return ui.confirm('Enable authentication?', authEnabled);
            } else {
              return ui.confirm('Disable authentication?', false)
              .then(function(disable) {
                if (disable) {
                  return false;
                } else {
                  return ui.confirm('Update authentication?', false)
                  .then(function(update) {
                    return update || null;
                  });
                }
              });
            }
          })
          .then(function(authentication) {
            if (authentication) {
              // TRUE - Set or update authentication
              var auth = decodeCredentials(config.auth) || {};
              return Promise.resolve()
              .then(function() {
                return ui.input('Username', auth.username);
              })
              .then(function(username) {
                auth.username = username;
                return ui.input('Password', null, true);
              })
              .then(function(password) {
                auth.password = password;
                return encodeCredentials(auth);
              });
            } else if (authentication !== null){
              // FALSE - Delete authentication
              return null;
            } else {
              // NULL - Keep current authentication
              return config.auth;
            }
          })
          .then(function(auth) {
            if (auth) {
              config.auth = auth;
            } else {
              delete config.auth;
            }
          });
        })
        .then(function() {
          var isRepoSuffixUnset = config.reposuffix === undefined || config.reposuffix === null;
          return Promise.resolve(ui.confirm('Use the default git repository suffix (.git)?', isRepoSuffixUnset));
        })
        .then(function(usedefaultsuffix) {
          if(usedefaultsuffix) {
            // Leave the reposuffix config empty in order to use the default configuration of the endpoint
            delete config.reposuffix;
            return;
          }
          return Promise.resolve(ui.confirm('Set an empty git repository suffix?', false))
          .then(function(setemptysuffix) {
            if (setemptysuffix) {
              // Set an empty repository suffix
              config.reposuffix = '';
              return;
            }
            return Promise.resolve(ui.input('Enter the git repository suffix', config.reposuffix || '.git'))
            .then(function(reposuffix) {
              config.reposuffix = reposuffix;
            });
          });
        })
        .then(function() {
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
        })
        .then(function() {
          return Promise.resolve(ui.confirm('Set or update custom package name formats?', false))
          .then(function(setFormats) {
            if (setFormats) {
              return Promise.resolve(ui.input('Enter the a comma seperated list of package name formats', config.packageNameFormats || '*/*'))
              .then(function(packageNameFormats) {
                config.packageNameFormats = packageNameFormats;
              });
            }
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
      execGit(['ls-remote', remoteString, 'refs/tags/*', 'refs/heads/*'], execOpt, function(err, stdout, stderr) {
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

    var self = this;

    if ((packageConfig.dependencies || packageConfig.peerDependencies || packageConfig.optionalDependencies) &&
        !packageConfig.registry && (!packageConfig.jspm || !(packageConfig.jspm.dependencies || packageConfig.jspm.peerDependencies || packageConfig.jspm.optionalDependencies))) {
      var hasDependencies = false;
      var p;
      for (p in packageConfig.dependencies)
        hasDependencies = true;
      for (p in packageConfig.peerDependencies)
        hasDependencies = true;
      for (p in packageConfig.optionalDependencies)
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
          delete packageConfig.optionalDependencies;
          this.ui.log('warn', '`' + packageName + '` dependency installs skipped as it\'s a package with no registry property set.\n' + noDepsMsg + '\n');
        }
      }
      else {
        delete packageConfig.dependencies;
        delete packageConfig.peerDependencies;
        delete packageConfig.optionalDependencies;
      }
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
    var main = packageConfig.main || dir.split('/').pop().split('@').slice(0, -1).join('@') + (dir.substr(dir.length - 3, 3) != '.js' ? '.js' : '');
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
