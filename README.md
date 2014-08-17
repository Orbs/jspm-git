jspm-git
==========

JSPM endpoint for Git Repositories

# Installation

Install the endpoint into your application:

```
npm install jspm-git --save-dev
```

Configure JSPM to use the endpoint:

```
jspm config endpoints.myendpoint jspm-git
jspm config myendpoint.baseurl https://somebaseurl/

# By default .git gets appended to the repository name.
# This can be changed by setting the repository suffix.
# jspm config myendpoint.reposuffix .git
```

# Usage

Because this is a generic git endpoint, it does not have hostnames hard coded into it. To use this endpoint, you must specify the full base URL and repo path. For instance, if your company is ABC Widgets and your git server is located at `ssh://username@code.abcwidgets.com/`, then you could use a command like this to install your private packages:

```
jspm config endpoints.abc jspm-git
jspm config abc.baseurl ssh://username@code.abcwidgets.com/

jspm install abc:projname/reponame
```

jspm-git will then try to install the package located at `ssh://username@code.abcwidgets.com/projname/reponame.git`
