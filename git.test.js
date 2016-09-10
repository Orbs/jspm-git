'use strict';

var expect = require('chai').expect;

var GitLocation;
var git;

describe('git registry', function() {

  before(function() {
    GitLocation = require('./git');
    expect(GitLocation).to.be.a('function');
  });

  beforeEach(function() {
    git = new GitLocation({
      log: true,
      apiVersion: '2.0',
      tmpDir: '/tmp',
      timeout: 5,
      baseurl: 'https://github.com/'
    });
    expect(git).to.be.ok;
  });

  it('should lookup all package version of a given package from Github', function() {
    this.timeout(5000);
    return git.lookup('angular/bower-angular').then(function(versions) {
      console.log('versions:', versions, versions.length);
    });
  });

  it('should download a package from Github', function() {
    this.timeout(10000);
    return git.download('angular/bower-angular', 'v1.3.0-build.51+sha.e888dde', '', {}, '/tmp/bower-angular')
      .then(function(result) {
        console.log(result);
      })
  })

});
