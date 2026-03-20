# `@sachikit/cli`

Node-first CLI foundation for `sachi`.

## Install

```bash
npm install -g @sachikit/cli
```

One-off execution:

```bash
npx @sachikit/cli@latest --help
```

Milestone 1 includes:

- a custom root help screen
- a `yargs` command tree
- native Node color helpers via `styleText()`
- git fallback for unsupported commands
- repo-local stack metadata in `.git/sachi/stack.json`
- compact Unicode stack rendering

Builds are bundled with Bun, but runtime code stays on standard Node APIs.

## Local Release Flow

Version bump:

```bash
pnpm --filter @sachikit/cli release
```

Pack locally:

```bash
cd packages/cli
npm pack
```

Install the packed tarball:

```bash
npm install -g ./sachikit-cli-<version>.tgz
```

Publish:

```bash
cd packages/cli
npm publish --access public
```
