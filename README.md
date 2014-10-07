jspm-git
==========

jspm endpoint for Git Repositories

# Installation

Install the endpoint globally or locally within your project:

```bash
# Global installation
npm install -g jspm-git

# OR local installation
npm install jspm-git --save-dev

```

# Create a new or reconfigure an existing jspm-git endpoint:

```bash
jspm endpoint create mygit jspm-git
```
Where `mygit` will be the name of your git endpoint.


# Usage
Exemplary usage of jspm-git to install a jspm package from a git server located at `ssh://username@code.mycompany.com/`

```bash
# Exemplary endpoint configuration of mygit
# basepath: ssh://username@code.mycompany.com/
# reposuffix: .git (default)

jspm install mygit:projname/reponame
```

jspm-git will then try to install the package located at `ssh://username@code.mycompany.com/projname/reponame.git`
