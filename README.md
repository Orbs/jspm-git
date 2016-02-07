jspm-git
==========

[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Build Status][travis-image]][travis-url]

A generic jspm registry for Git repositories.

jspm-git is based on Guy Bedford's [github registry for jspm](https://github.com/jspm/github/).

## Compatibility
The most recent release of jspm-git is always compatible to the most recent release of jspm. For different jspm releases please have a look on the [Jspm Compatibility Wiki](https://github.com/Orbs/jspm-git/wiki/Jspm-Compatibility) to find a compatible jspm-git release.

For all jspm@0.17-beta users, please use the beta version of jspm-git.

```bash
npm install jspm-git@beta
```

## Installation

Install the registry globally or locally within your project:

```bash
# Global installation
npm install -g jspm-git

# OR local installation
npm install jspm-git --save-dev

```

## Create a new jspm-git registry:

```bash
jspm registry create mygit jspm-git
```
Where `mygit` will be the name of your new git registry.

## Configure an existing registry:

```bash
jspm registry config mygit
```
Where `mygit` is the name of your existing registry which you want to configure.


## Usage
Exemplary usage of jspm-git to install a jspm package from a git server located at `ssh://username@code.mycompany.com/`

```bash
# Exemplary registry configuration of mygit
# baseurl: ssh://username@code.mycompany.com/

jspm install mygit:projname/reponame
```

jspm-git will then try to install the package located at
```
ssh://username@code.mycompany.com/projname/reponame.git
```
#### Troubleshooting
These combinations of `jspm` and `jspm-git` are **valid**
* global jspm + global jspm-git
* local jspm + local jspm-git

These combinations of `jspm` and `jspm-git` are **invalid**
* global jspm + local jspm-git
* local jspm + global jspm-git


## Registry Configurations
Registry configurations for popular Git hosting services
### Bitbucket
```bash
jspm registry create bitbucket jspm-git
# baseurl: https://bitbucket.org/

jspm install bitbucket:accountname/reponame
```

If you want to avoid rate limits please use the base URL `ssh://git@bitbucket.org/` instead.

Please note that you've to upload your public key to your Bitbucket account or otherwise Bitbucket will refuse the `ssh`connection. For more details please see official Bitbucket manual [Set up SSH for Git](https://confluence.atlassian.com/display/BITBUCKET/Set+up+SSH+for+Git)
### Github
Please use the official github registry that comes along with the jspm-cli

#### Configuration File
You can find your jspm-git registry configuration in the following locations
* Linux Systems `~/.jspm/config file`
* Windows `%LOCALAPPDATA%/.jspm/config`

[travis-url]: https://travis-ci.org/Orbs/jspm-git
[travis-image]: https://travis-ci.org/Orbs/jspm-git.svg?branch=master

[downloads-image]: http://img.shields.io/npm/dm/jspm-git.svg
[npm-url]: https://npmjs.org/package/jspm-git
[npm-image]: http://img.shields.io/npm/v/jspm-git.svg
