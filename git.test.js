'use strict';

var expect = require('chai').expect;

// Module to test
var Git = require('./git');

describe('git registry', function() {

  it('should export a constructor function', function() {
    expect(Git).to.be.an('function');
    expect(new Git({
      log: true,
      apiVersion: '1.0',
      tmpDir: 'tmpDir',
      timeout: 5,
      baseurl: 'https://github.com/'
    })).to.be.an.instanceof(Git);
  });

});
