/*
 *   Copyright 2014-2015 Guy Bedford (http://guybedford.com)
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

var Promise = require('rsvp').Promise;
var execFile = require('child_process').execFile;
var os = require('os');

function Pool(count) {
  this.count = count;
  this.queue = [];
  this.promises = new Array(count);
}

/* Run the function immediately. */
function run(pool, idx, executionFunction) {
  var p = Promise.resolve()
    .then(executionFunction)
    .then(function() {
      delete pool.promises[idx];
      var next = pool.queue.pop();
      if (next) {
        pool.execute(next);
      }
    });
  pool.promises[idx] = p;
  return p;
}

/* Defer function to run once all running and queued functions have run. */
function enqueue(pool, executeFunction) {
  return new Promise(function(resolve) {
    pool.queue.push(function() {
      return Promise.resolve().then(executeFunction).then(resolve);
    });
  });
}

/* Take a function to execute within pool, and return promise delivering the functions
 * result immediately once it is run. */
Pool.prototype.execute = function(executionFunction) {
  var idx = -1;

  for (var i=0; i<this.count; i++) {
    if (!this.promises[i]) {
      idx = i;
    }
  }

  if (idx !== -1) {
    return run(this, idx, executionFunction);
  } else {
    return enqueue(this, executionFunction);
  }
};

if (process.platform === 'win32') {
  var gitPool = new Pool(Math.min(os.cpus().length, 2));
  module.exports = function(command, execOpt, callback) {
    return gitPool.execute(function() {
      return new Promise(function(resolve){
        execFile('git', command, execOpt, function(err, stdout, stderr){
          callback(err, stdout, stderr);
          resolve();
        });
      });
    });
  };
} else {
  module.exports = function(command, execOpt, callback) {
    execFile('git', command, execOpt, callback);
  };
}
