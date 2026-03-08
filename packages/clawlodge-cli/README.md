# ClawLodge CLI

Pack and publish OpenClaw config workspaces to ClawLodge.

## Install

```bash
npm install -g ./clawlodge-cli-0.1.0.tgz
```

## Basic usage

```bash
clawlodge login
clawlodge pack
clawlodge publish
```

## README and Name

```bash
clawlodge publish --name "My Workspace"
clawlodge publish --readme /path/to/README.md
```

If you do not pass `--name`, the CLI derives it from the workspace folder name.
If you do not pass `--readme`, the publish API generates the README on the server.

## Help

```bash
clawlodge help
```

Create a PAT in `https://clawlodge.com/settings`, then run:

```bash
clawlodge login
clawlodge whoami
```

If the default OpenClaw workspace is not available under `~/.openclaw`, pass an explicit path with `--workspace`.
