jspm-git
==========

JSPM endpoint for Git Repositories

Utilizes `git archive` which does not support `http(s)`. Therefore, endpoint options `https`, `username`, and `password` are not used.

At this time, assumes that hostnames begin with `ssh://`. This may need to change. You must have SSH keys configured and use an SSH path to your git repository.

**Possible future enhancement:** To be compatible with all git repositories (self hosted, github, bitbucket, stash, etc.), it might be better to do a `git clone`, `git checkout`, and local `git archive`. This should also support both ssh and https.

# Installation

Install the endpoint into your application:

```
npm install jspm-git
```

Configure JSPM to use the endpoint:

```
jspm config endpoints.git jspm-git
```

# Usage

Because this is a generic git endpoint, it does not have hostnames hard coded into it. To use this endpoint, you must specify the full hostname and repo path. For instance, if your company is ABC Widgets and your git server is located at `ssh://code.abcwidgets.com/`, then you could use a command like this to install your private packages:

```
jspm install git:code.abcwidgets.com/projname/reponame
```

# Extending

This generic git endpoint can be utilized to create custom endpoints for private git servers. This will enable you to not have to specify full hostnames when installing packages, such as this:

```
jspm install abc:projname/reponame
```

To do this, you would create your own endpoint package that extends this package:

```javascript
var util = require('util');
var GitLocation = require('jspm-git');

var AbcLocation = function(options) {
  options = options || {};
  options.hostName = 'code.abcwidgets.com/';
  GitLocation.call(this, options);
}
util.inherits(AbcLocation, GitLocation);

module.exports = AbcLocation;
```

Then install the package into your application:

```
npm install jspm-abc --save-dev
```

And configure JSPM to use your endpoint:

```
jspm config endpoints.abc jspm-abc
```
