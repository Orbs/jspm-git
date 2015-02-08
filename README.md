jspm-git [![Build Status][travis-image]][travis-url]
==========

A generic jspm endpoint for Git Repositories.

jspm-git is based on Guy Bedford's [github endpoint for jspm](https://github.com/jspm/github/).

## Compatibility
The most recent release of jspm-git is always compatible to the most recent release of jspm. For different jspm releases please have a look on the [Jspm Compatibility Wiki](https://github.com/Orbs/jspm-git/wiki/Jspm-Compatibility) to find a compatible jspm-git release.

## Installation

Install the endpoint globally or locally within your project:

```bash
# Global installation
npm install -g jspm-git

# OR local installation
npm install jspm-git --save-dev

```

## Create a new jspm-git endpoint:

```bash
jspm endpoint create mygit jspm-git
```
Where `mygit` will be the name of your new git endpoint.

## Configure an existing endpoint:

```bash
jspm endpoint config mygit
```
Where `mygit` is the name of your existing endpoint which you want to configure.


## Usage
Exemplary usage of jspm-git to install a jspm package from a git server located at `ssh://username@code.mycompany.com/`

```bash
# Exemplary endpoint configuration of mygit
# baseurl: ssh://username@code.mycompany.com/

jspm install mygit:projname/reponame
```

jspm-git will then try to install the package located at
```
ssh://username@code.mycompany.com/projname/reponame.git
```

## Endpoint Configurations
Endpoint configurations for popular Git hosting services
### Bitbucket
```bash
jspm endpoint create bitbucket jspm-git
# baseurl: https://bitbucket.org/

jspm install bitbucket:accountname/reponame
```

If you want to avoid rate limits please use the base URL `ssh://git@bitbucket.org/` instead.

Please note that you've to upload your public key to your Bitbucket account or otherwise Bitbucket will refuse the `ssh`connection. For more details please see official Bitbucket manual [Set up SSH for Git](https://confluence.atlassian.com/display/BITBUCKET/Set+up+SSH+for+Git)
### Github
Please use the official github endpoint that comes along with the jspm-cli

[travis-url]: https://travis-ci.org/Orbs/jspm-git
[travis-image]: https://travis-ci.org/Orbs/jspm-git.svg?branch=master
