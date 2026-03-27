# Graphite Reverse-Engineering Scratchpad

## Scope / Method

- GitHub repos for Graphite CLI are stale for current behavior, so this analysis is based on **installed artifacts** and **runtime traces**.
- CLI analyzed from `/opt/homebrew/bin/gt` (`1.8.2`, Node snapshot binary).
- App analyzed from `/Applications/Graphite.app` (`CFBundleVersion 0.2.2`) by extracting `Contents/Resources/app.asar`.
- Behavioral traces captured by running real commands with `--debug` in disposable repos.

## High-Level Composition

### CLI (`gt`) composition

Observed execution shape (from debug output):

1. Parse command + flags.
2. Compose engine/context (git wrapper, cached metadata, user config, API client).
3. Run command handler (`create`, `modify`, `restack`, `delete`, `track`, `submit`, `sync`, etc).
4. Persist local cache/metadata.
5. Optionally fan out background workers (`upgrade-prompt`, `cleanup-debug-logs`, `post-traces`, etc).

All git actions are shell-level orchestration via `git -C <repo> ...` commands (no libgit2 evidence in runtime).

### App (`Graphite.app`) composition

Installed app is a **menu bar / tray app** bundle (Electron) with entrypoint `esbuild-out/src/index.js`.

Runtime path in bundled code:

- Builds tray/menu UI.
- Loads local Graphite user config.
- Calls Graphite API (`getSectionsSummary`) for PR section counts.
- Renders badge icon + menu entries, opens URLs, polls periodically.

It does **not** appear to be the git stack mutator itself; it is mostly a desktop UX shell around Graphite cloud + local user config.

## CLI Local State Model

In `.git/` Graphite writes:

- `.graphite_metadata.db` (sqlite)
- `.graphite_repo_config`
- `.graphite_pr_info`
- `.gtlocalprinfo`
- `.gt/event_log`
- `.gt/snapshots/*.snapshot`

### `branch_metadata` schema

```sql
CREATE TABLE branch_metadata (
  branch_name TEXT PRIMARY KEY,
  parent_branch_name TEXT,
  parent_branch_revision TEXT,
  last_submitted_version TEXT,
  state TEXT,
  children TEXT,
  branch_revision TEXT,
  validation_result TEXT,
  parent_head_revision TEXT
);
```

### Meaning (inferred from runtime)

- `branch_revision`: current branch tip SHA tracked by Graphite.
- `parent_branch_name`: intended stack parent.
- `parent_branch_revision`: merge-base-ish anchor used for restack math.
- `parent_head_revision`: cached current parent tip seen during validation.
- `validation_result`: values seen include `TRUNK`, `VALID`, `BAD_PARENT_NAME`.
- `children`: JSON list of direct descendants.

### Operation journal / recovery

`.git/.gt/event_log` stores command events + snapshot pointers, e.g.:

- `canonicalName`: `create [name]`, `modify`, `delete [name]`, `submit`, `sync`.
- `startingSnapshot`/`endingSnapshot` with hashes.

`.git/.gt/snapshots/*.snapshot` stores branch graph + working dir refs (`headRef`, `indexRef`, `workingTreeRef`, optional `untrackedRef`) to support continue/undo/abort flows and mutation detection.

## Git Orchestration Patterns

## Core primitive pattern

Graphite repeatedly uses:

- `git for-each-ref` for branch discovery.
- `git branch --show-current` / `git rev-parse` for pointers.
- `git merge-base --is-ancestor` for stack validity checks.
- `git status -z` for clean/dirty/conflict detection.
- `git worktree list --porcelain -z` for current-worktree awareness in `gt log`.

## `gt create`

Observed sequence:

1. Read current branch + HEAD.
2. `git stash create` to capture working tree/index state.
3. Detach to current SHA: `git switch -q -d <sha>`.
4. Commit staged changes: `git commit -m ... -q`.
5. Create/switch new branch: `git switch -q -c <new>`.
6. Update metadata edge (`new -> parent`).

This is effectively “mint commit first, then branch at that commit,” not just a plain `checkout -b` + commit.

## `gt modify`

Observed sequence:

1. Validate current branch + parent relations.
2. Optionally stage (`git add --all` for `-a`).
3. Amend (`git commit --amend ...`) or create commit depending flags.
4. Update tracked `branch_revision` and downstream restack metadata.

## `gt restack`

Behavioral model:

1. Select branches in scope (stack/downstack/upstack/only).
2. Skip no-op branches (`REBASE_UNNEEDED`) when ancestry already valid.
3. For real restacks, preflight conflict risk using low-level plumbing:
   - `git cat-file`
   - `git commit-tree`
   - `git merge-tree`
4. Then execute actual rewrite:
   - `git rebase --onto <newParent> <oldParent> <branch>`
5. On conflict:
   - Persist recovery state in `.gt` snapshots/event log.
   - Print stepwise recovery (`gt add`, `gt continue`, `gt abort`).

This is a key pattern: **predict conflict first, then mutate**.

## `gt delete`

Observed sequence:

1. Validate target + descendants.
2. Repoint child metadata to deleted branch’s parent.
3. Remove compatibility refs (`git update-ref -d refs/branch-metadata/<branch>`).
4. Delete branch (`git branch -D <branch>`).
5. Clean remote-tracking/fetch-head refs:
   - `refs/remotes/origin/<branch>`
   - `refs/gt-fetch-head/<branch>`
6. If needed, attempt descendant restack/rebase; conflicts can still happen.

## `gt track`

Sets/repairs tracking edges by explicitly writing parent linkage:

- Computes merge-base with chosen parent (`git merge-base child parent`).
- Stores parent link and anchor revision in metadata.

Used to repair corrupted `BAD_PARENT_NAME` graphs.

## `gt submit` / `gt sync`

Both are hybrid local+remote operations:

1. Validate local graph.
2. Resolve upstream/trunk status (`main@{u}`, local/remote SHA checks).
3. Call Graphite API route (observed): `/graphite/cli/pull-request-info`.
4. If repo owner/name inference from remote fails (or repo unavailable on Graphite/GitHub), command exits with API error.

So network/API coupling is hard for submit/sync, while create/modify/restack/delete/track are local-first.

## Notable Design Decisions

1. Stack intent is modeled independently from git branch ancestry and stored in metadata DB.
2. Graphite aggressively validates ancestry with `merge-base --is-ancestor` before mutating.
3. Long-running rewrite flows are journaled (`.gt/event_log` + snapshots) for safe continuation.
4. Conflict UX is first-class (`continue`/`abort` protocol, explicit unmerged file listing).
5. Backward compatibility exists for older metadata refs (`refs/branch-metadata/*`) while current state lives in sqlite.

## App Findings (Installed `Graphite.app`)

1. The shipped app bundle is a tray/menu UX for Graphite sections and links, not a heavy git mutation engine in normal path.
2. It reads local user config and guides auth (links to CLI auth URL) when missing/invalid.
3. It polls Graphite APIs and updates icon badges from open PR counts.
4. Auto-update configured via S3 (`app-update.yml`).

## Drift Notes

1. Public GitHub repos under `withgraphite` include outdated or different apps (for example old full-window desktop wrappers) and don’t match current installed behavior.
2. Runtime artifacts from `gt 1.8.2` are the most reliable truth for current stacking mechanics.

## Practical Implications For Research

1. If we emulate Graphite-like stacking, we likely need a persistent stack graph layer (not just branch naming conventions).
2. Recovery snapshots are important if we want safe multi-branch rewrite operations.
3. Preflight conflict estimation (`merge-tree` strategy) can reduce destructive/half-applied operations.
4. Keep local-only commands truly local; isolate API-dependent flows (submit/sync) to avoid coupling core branch workflows to network availability.

## Raw Evidence Paths Used

- CLI binary: `/opt/homebrew/bin/gt` (resolves to Homebrew `graphite/1.8.2/bin/gt`)
- App bundle: `/Applications/Graphite.app/Contents/Resources/app.asar`
- Extracted app JS: `/var/folders/70/ll0pwzzn4m74dxzp5kp26mx80000gn/T/tmp.j8XV3cjnIu/esbuild-out/src/index.js`
- CLI debug logs: `~/.local/share/graphite/debug/*.log.jsonl`
- Sandbox repo used for traces: `/tmp/gt-lab.ZsuqQd`

## Verification Pass (2026-03-22)

### Verification Method

- Re-ran all core flows against installed `gt 1.8.2` in fresh disposable repos with `--debug`.
- Separated local stack-mutation verification from network-coupled verification (`submit`/`sync`) so remote/auth constraints do not invalidate local claims.
- Re-extracted the installed app bundle and re-checked runtime entrypoint behavior from `app.asar`.

### Claim-By-Claim Verdict

| Claim | Verdict | Evidence |
| --- | --- | --- |
| CLI lifecycle: parse -> compose engine -> run handler -> persist -> background workers | VERIFIED | `00-init.log`, `01-create-a.log`: `Finished composing engine`, `Running command ...`, `Persisting cache...`, `Forking: background ...` |
| Git operations are shell-orchestrated (`git -C ...`) | VERIFIED | Every trace shows spawned shell git commands (for example `for-each-ref`, `switch`, `commit`, `rebase`, `update-ref`) |
| Local state files (`.graphite_metadata.db`, `.graphite_repo_config`, `.graphite_pr_info`, `.gtlocalprinfo`, `.gt/event_log`, `.gt/snapshots`) | VERIFIED | `/tmp/gt-verify.eAa5D9/logs/99-state.txt`, `/tmp/gt-verify-conflict.1774226344/logs/99-state.txt` |
| `branch_metadata` schema and key fields | VERIFIED | `sqlite3 .schema branch_metadata` output in both verification repos |
| Stack intent stored independent from git ancestry | VERIFIED | After `gt track feature/b -p main`, git merge-base keeps `feature/a` ancestry while metadata parent becomes `main` |
| `gt create` sequence (`stash create` -> `switch -d` -> `commit` -> `switch -c` + metadata update) | VERIFIED | `/tmp/gt-verify.eAa5D9/logs/01-create-a.log`, `/tmp/gt-verify.eAa5D9/logs/02-create-b.log` |
| `gt modify` validates ancestry, supports `-a`, amends/commits, updates metadata, restacks descendants | VERIFIED | `/tmp/gt-verify.eAa5D9/logs/03-modify-b.log`, `/tmp/gt-verify-conflict.1774226344/logs/04-modify-a.log` |
| `gt restack` skips no-op (`REBASE_UNNEEDED`) | VERIFIED | `/tmp/gt-verify.eAa5D9/logs/05-restack.log` |
| `gt restack` preflights conflict with `cat-file` + `commit-tree` + `merge-tree` before actual rebase | VERIFIED | `/tmp/gt-verify-conflict.1774226344/logs/06-restack.log` |
| `gt restack` mutates with `git rebase --onto ...` | VERIFIED | `/tmp/gt-verify-conflict.1774226344/logs/06-restack.log` |
| Conflict protocol (`gt add`/`gt continue`/`gt abort`) + snapshot/journal persistence | VERIFIED | `/tmp/gt-verify-conflict.1774226344/logs/06-restack.log`, `10-continue.log`, `11-continue-after-resolve.log`, `.git/.gt/event_log` |
| `gt delete` repoints child metadata, deletes compatibility refs, deletes branch, cleans origin + `gt-fetch-head` refs | VERIFIED | `/tmp/gt-verify.eAa5D9/logs/07-delete-a-force.log` |
| `gt track` computes merge-base and writes parent linkage + anchor revision | VERIFIED | `/tmp/gt-verify.eAa5D9/logs/04-track-b-main.log` |
| `submit`/`sync` are hybrid local+remote (local validation + API/remote coupling) | VERIFIED | `/tmp/gt-verify-remote.1774226451/logs/02-submit.log`, `03-sync.log` |
| `/graphite/cli/pull-request-info` is used in sync path | VERIFIED | `/tmp/gt-verify-remote.1774226451/logs/03-sync.log` |
| `/graphite/cli/pull-request-info` always appears in submit path | PARTIAL | Submit path observed `/graphite/cli/is-repo-synced`; pull-request-info not reached in this repo state |
| Upstream resolution explicitly via `main@{u}` in this environment | PARTIAL | Exact `main@{u}` command not observed; equivalent remote/trunk checks and fetch-head flow were observed |
| App is tray/menu UX, not git mutator | VERIFIED | Extracted app entrypoint shows `new Tray(...)`, menu/badge/polling/auth links, no git stack mutation flow |
| App polls Graphite APIs and updates badge/menu | VERIFIED | `fetchDataAndUpdateTray`, `getSectionsSummary`, periodic `setTimeout`/config polling in extracted app JS |
| Auto-update via S3 | VERIFIED | `/Applications/Graphite.app/Contents/Resources/app-update.yml` |

### Verification Caveats

1. `submit`/`sync` behavior depends on remote availability, repo sync status in Graphite, and local git auth; command paths diverge based on these checks.
2. In this non-interactive harness, `gt abort --no-interactive` is blocked as interactive; conflict continuation was still verified via `gt continue`.
3. The scratchpad statement naming `main@{u}` should be interpreted as a behavioral shorthand for upstream/trunk resolution, not as a guaranteed literal command in every run.

### New Evidence Artifacts

- Local-flow verification repo: `/tmp/gt-verify.eAa5D9`
- Conflict/recovery verification repo: `/tmp/gt-verify-conflict.1774226344`
- Remote/API coupling verification repo: `/tmp/gt-verify-remote.1774226451`
- Re-extracted app bundle for this verification pass: `/tmp/graphite-app-verify.bICT5f/out/esbuild-out/src/index.js`

## Git Sequence Deep Dive (Stacking Algorithm Blueprint)

This section is intentionally detailed for readers who know git fundamentals and want to implement a stack engine.

### First-Principles Model

1. Keep an explicit stack graph in metadata (`branch -> parent`) independent from git branch naming and independent from transient ancestry drift.
2. Use git as a mutation backend and truth source for commit/object operations, not as your only graph model.
3. Snapshot and journal every mutating command so partial rewrites are resumable.

### Core Data Structures

1. Branch metadata table: `branch_name`, `parent_branch_name`, `parent_branch_revision`, `branch_revision`, `parent_head_revision`, `children`, `validation_result`.
2. Operation event log: records command name, args, and snapshot boundaries.
3. Snapshot files: branch graph and working directory refs (`headRef`, `indexRef`, `workingTreeRef`, optional `untrackedRef`).

### Universal Command Prelude (Observed)

Every major command starts by gathering deterministic state with shell git calls:

```bash
git -C <repo> rev-parse --path-format=absolute --show-toplevel --git-common-dir --git-dir
git -C <repo> --version
git -C <repo> for-each-ref --format=%(refname):%(objectname) refs/branch-metadata/
git -C <repo> for-each-ref --format=%(refname:short):%(objectname) --sort=-committerdate refs/heads/
git -C <repo> branch --show-current
git -C <repo> remote get-url origin --push
git -C <repo> config --get user.email
```

Purpose:

1. Resolve repository/worktree paths.
2. Load branch universe and compatibility refs.
3. Capture current branch context.
4. Collect remote identity for network-coupled paths.

### `gt create`: Verified Mutation Sequence

Observed in `/tmp/gt-verify.eAa5D9/logs/01-create-a.log`.

```bash
git -C <repo> branch --show-current
git -C <repo> rev-parse HEAD
git -C <repo> stash create
git -C <repo> rev-parse <stashSha>^@
git -C <repo> -c color.ui=false status -s
git -C <repo> --no-optional-locks status -z
git -C <repo> switch -q -d <parentHeadSha>
git -C <repo> commit -m "<msg>" -q
git -C <repo> --no-pager log -1 --pretty=format:%s HEAD --
git -C <repo> switch -q -c <newBranch>
git -C <repo> rev-parse <newBranch>
```

Why this matters:

1. Commit is minted detached first, so parent branch tip does not move.
2. New branch is created at minted commit.
3. Metadata edge is then persisted as `new -> oldCurrent`.

### `gt modify`: Verified Mutation Sequence

Observed in `/tmp/gt-verify.eAa5D9/logs/03-modify-b.log` and descendant case in `/tmp/gt-verify-conflict.1774226344/logs/04-modify-a.log`.

```bash
git -C <repo> merge-base --is-ancestor <parent> <child>
git -C <repo> branch --show-current
git -C <repo> rev-parse HEAD
git -C <repo> stash create
git -C <repo> -c color.ui=false status -s
git -C <repo> add --all        # when -a
git -C <repo> --no-optional-locks status -z
git -C <repo> commit --amend -m "<msg>" --no-edit
git -C <repo> rev-parse <branch>
```

Algorithm consequence:

1. Amending changes branch tip SHA.
2. Any descendant anchored to old SHA may require restack.
3. Engine updates metadata and plans downstream rewrite if needed.

### `gt track`: Verified Re-parent Sequence

Observed in `/tmp/gt-verify.eAa5D9/logs/04-track-b-main.log`.

```bash
git -C <repo> merge-base --is-ancestor <oldParent> <child>
git -C <repo> merge-base <child> <newParent>
git -C <repo> rev-list --count <newParent>..<child> --
```

Behavior:

1. Writes metadata parent edge and anchor revision.
2. Does not have to rewrite git immediately.
3. This is metadata graph repair/alignment.

### `gt restack`: Planner + Preflight + Rewrite

No-op observed in `/tmp/gt-verify.eAa5D9/logs/05-restack.log` and conflict path in `/tmp/gt-verify-conflict.1774226344/logs/06-restack.log`.

No-op check:

```bash
git -C <repo> merge-base --is-ancestor <parentTip> <branchTip>
# if true -> REBASE_UNNEEDED
```

Real rewrite path:

```bash
git -C <repo> -c log.showSignature=false --no-pager log --pretty=format:%H%n%aN%n%aE%n%aI%n%B%x00 <oldParent>..<branch> --
git -C <repo> rev-list --parents -1 <replayedCommit>
git -C <repo> cat-file -p <replayedCommit>~
git -C <repo> commit-tree <newParent^{tree}> -p <oldReplayParent> -m _
git -C <repo> merge-tree --allow-unrelated-histories <syntheticCommit> <replayedCommit>
git -C <repo> rebase --onto <newParentTip> <oldParentAnchor> <branch>
```

Preflight meaning:

1. `commit-tree` builds synthetic base context.
2. `merge-tree` predicts conflict risk before mutable history rewrite.
3. `rebase --onto` performs actual graph rewrite.

### Conflict Protocol: Persist + Continue/Abort

Observed in `/tmp/gt-verify-conflict.1774226344/logs/06-restack.log`, `/tmp/gt-verify-conflict.1774226344/logs/10-continue.log`, `/tmp/gt-verify-conflict.1774226344/logs/11-continue-after-resolve.log`.

On conflict, engine executes:

```bash
git -C <repo> --no-optional-locks status -z
# detect unmerged files (UU ...)
# persist operation state + snapshots
# print guidance: gt add <file>, gt continue, gt abort
```

Continue flow:

```bash
git -C <repo> config --get core.hooksPath
git -C <repo> rebase --continue
git -C <repo> --no-optional-locks status -z
```

If unresolved, it re-persists and reprints guidance. If resolved+staged, rebase completes and branch revision updates.

### `gt delete`: Verified Sequence

Observed in `/tmp/gt-verify.eAa5D9/logs/07-delete-a-force.log`.

```bash
git -C <repo> worktree list --porcelain -z
git -C <repo> update-ref -d refs/branch-metadata/<branch>
git -C <repo> branch -D <branch>
git -C <repo> update-ref -d refs/remotes/origin/<branch>
git -C <repo> update-ref -d refs/gt-fetch-head/<branch>
```

Metadata behavior:

1. Children are reparented in metadata.
2. Compatibility and remote cache refs are cleaned.

### `gt log`: Worktree-Aware Read Path

Observed in `/tmp/gt-verify.eAa5D9/logs/08-log.log`.

```bash
git -C <repo> worktree list --porcelain -z
git -C <repo> --no-pager log ...
```

This keeps displayed stack context aware of current worktree branch placement.

### `submit` / `sync`: Hybrid Local + Remote

Observed in `/tmp/gt-verify-remote.1774226451/logs/02-submit.log` and `/tmp/gt-verify-remote.1774226451/logs/03-sync.log`.

Submit path (this environment):

1. Runs local validation (`merge-base --is-ancestor`, clean checks).
2. Calls Graphite API `/graphite/cli/is-repo-synced`.
3. Stops if repo is not synced.

Sync path:

1. Runs local validation.
2. Calls Graphite API `/graphite/cli/pull-request-info`.
3. Performs remote fetch into `refs/gt-fetch-head/main`.
4. Can fail on remote auth/network.

### Invariants For Your Own Stacking Engine

1. `branch_revision` must equal `rev-parse <branch>` for every tracked branch.
2. Every non-trunk branch must have existing tracked parent.
3. `children` must be inverse map of `parent_branch_name`.
4. Before any rewrite, persist operation start snapshot.
5. On conflict, operation must be resumable with deterministic state.
6. After success, persist ending snapshot and refresh metadata cache.

### Suggested Layered Architecture

1. `GitAdapter`: thin wrapper for command execution and parse helpers.
2. `StackStore`: sqlite graph persistence.
3. `Validator`: ancestry/worktree/conflict checks.
4. `Planner`: branch ordering and restack plan generation.
5. `Executor`: mutation engine for create/modify/restack/delete.
6. `Recovery`: continue/abort using journal and snapshots.
7. `RemoteOrchestrator`: isolated submit/sync API and remote fetch flows.

### Minimal Restack Pseudocode

```ts
function restack(branch: string) {
  const g = loadGraph()
  validateGraph(g)

  const plan = topoOrder(g, branch)
  const op = beginOp("restack", snapshot())

  for (const b of plan) {
    const p = g[b].parent_branch_name
    const old = g[b].parent_branch_revision
    const next = git(`rev-parse ${p}`)
    const tip = git(`rev-parse ${b}`)

    if (gitExit0(`merge-base --is-ancestor ${next} ${tip}`)) {
      markNoop(op, b)
      continue
    }

    const replay = firstCommitAfter(old, b)
    const oldParent = parentOf(replay)
    const synthetic = git(`commit-tree ${next}^{tree} -p ${oldParent} -m _`)
    const probe = gitExit(`merge-tree --allow-unrelated-histories ${synthetic} ${replay}`)
    const rb = gitExit(`rebase --onto ${next} ${old} ${b}`)

    if (rb !== 0) {
      persistConflict(op, b, probe)
      throw new Error("rebase-conflict")
    }

    g[b].parent_branch_revision = next
    g[b].branch_revision = git(`rev-parse ${b}`)
    saveNode(g, b)
  }

  endOp(op, snapshot())
}
```

## External Skill Cross-Check (goldjacobe/graphite-skills)

Date: 2026-03-22

### Why This Section Exists

You asked to go deeper with external Graphite skill docs while keeping this document grounded in local runtime truth from installed `gt 1.8.2`.

External material used:

- `https://github.com/goldjacobe/graphite-skills/.cursor/skills/graphite-create-stack/SKILL.md`
- `https://github.com/goldjacobe/graphite-skills/.cursor/skills/graphite-create-stack/reference.md`
- `https://github.com/goldjacobe/graphite-skills/.cursor/skills/graphite-stack-shared/REFERENCE.md`
- `https://github.com/goldjacobe/graphite-skills/.cursor/skills/graphite/SKILL.md`
- `https://github.com/goldjacobe/graphite-skills/.cursor/skills/graphite-split-stack/SKILL.md`
- `https://github.com/goldjacobe/graphite-skills/.cursor/skills/graphite-split-stack/reference.md`

Method:

1. Extract concrete claims from those docs.
2. Re-run fresh disposable repos against installed `gt` with `--debug`.
3. Mark each claim `VERIFIED`, `PARTIAL`, or `UNVERIFIED`.

### Runtime Verification Matrix

| External skill claim | Verdict | Evidence |
| --- | --- | --- |
| Dirty-worktree stack build can be done slice-by-slice with `git stash --keep-index` + `gt create` | VERIFIED | `/tmp/gt-skill-verify.1774229568/create`; `03-create-backend.log`, `05-create-frontend.log`; tree parity in `summary-create.txt` |
| `gt create` can be used repeatedly to mint a top-down stack from one working tree | VERIFIED | `/tmp/gt-skill-verify.1774229568/06-log-short-stack.txt` (`feature/frontend -> feature/backend -> feature/base -> main`) |
| Final top branch can be checked against a pre-captured working-tree hash (`git write-tree`) | VERIFIED | `target_tree == final_tree` in `/tmp/gt-skill-verify.1774229568/summary-create.txt` |
| `gt split --by-file <pathspec>` works non-interactively | VERIFIED | `/tmp/gt-skill-verify.1774229568/12-split-by-file.log` completed with status `0` |
| `gt split --by-file` internally follows a split algorithm equivalent to detached replay + `git reset -Nq` + pathspec staging + branch ref rewrites | VERIFIED | `/tmp/gt-skill-verify.1774229568/12-split-by-file.log` lines showing `switch -q -d`, `reset -Nq`, `addPathspecs`, `commit`, `branch -f` |
| When splitting a branch that has tracked children, descendants are auto-restacked/reanchored | VERIFIED | `/tmp/gt-skill-child-parent-verify.1774229753/04-split.log` (`RESTACKING: feature/child`, `update-ref`, metadata parent anchor update) |
| Split recommendation to keep original branch name on top when descendants exist is a safety-oriented policy | PARTIAL | Runtime shows descendants can still be handled when original name is retained on new top branch, but policy itself is prescriptive rather than a CLI invariant |
| `gt split --by-commit` and `gt split --by-hunk` require interactive workflow | PARTIAL | Help text confirms only `--by-file` is non-interactive; a non-interactive `--by-hunk` attempt entered interactive patch prompting and did not terminate on its own |
| Using `gt branch info` as primary source to enumerate child branch names | UNVERIFIED | In local tests, `gt branch info`/`gt info` display `Children:` header but not child names; child names reliably come from `gt children` and metadata |
| External guidance to avoid repo-specific wrappers and prefer generic `git`/`gt` primitives | VERIFIED (as guidance quality) | Consistent with observed Graphite runtime behavior where core mutation paths are shell-level `git` orchestration |

### Reproducible Trace Runs Used

#### 1) Create-stack from dirty tree (`stash --keep-index` + `gt create` loop)

Artifacts:

- Root: `/tmp/gt-skill-verify.1774229568`
- Repo: `/tmp/gt-skill-verify.1774229568/create`
- Key logs: `03-create-backend.log`, `05-create-frontend.log`
- Summary: `summary-create.txt`

Key observed sequence (per-slice):

```bash
git add <slice paths>
git stash push --keep-index
gt create <slice-branch> -m <msg> --no-interactive --debug
git stash pop
```

Inside each `gt create`, runtime still does detached minting:

```bash
git stash create
git switch -q -d <sha>
git commit -m <msg> -q
git switch -q -c <new>
```

Outcome:

1. Stack topology matched expected order.
2. Top branch tree hash exactly matched pre-captured dirty-tree hash.
3. Metadata parent anchors updated consistently.

#### 2) Built-in `gt split --by-file` algorithm check

Artifacts:

- Repo: `/tmp/gt-skill-verify.1774229568/split`
- Key log: `/tmp/gt-skill-verify.1774229568/12-split-by-file.log`
- Post-state: `/tmp/gt-skill-verify.1774229568/13-split-post-state.txt`

Observed flow:

1. Validates tracked ancestry.
2. Detaches to branch tip (`git switch -q -d <tip>`).
3. Resets to parent (`git reset -Nq <parent>`).
4. Stages pathspec subset (`git add backend/*`).
5. Commits subset then remaining changes.
6. Rewrites refs with `git branch -f`.
7. Updates Graphite metadata and restacks as needed.

This directly supports the external split-skill conceptual model, with the caveat that built-in CLI logic is more automated than the manual command sequence shown in the external reference.

#### 3) Descendant behavior when splitting parent by file

Artifacts:

- Root: `/tmp/gt-skill-child-parent-verify.1774229753`
- Split log: `04-split.log`
- Metadata dump: `06-metadata.txt`

Setup:

1. `feature/base` tracked on `main`.
2. `feature/child` tracked on `feature/base`.
3. Run `gt split --by-file 'backend/*' --no-interactive --debug` from `feature/base`.

Observed:

1. New parent branch created: `feature/base_split` (backend-only commit).
2. Original branch name `feature/base` moved to top slice (frontend-only commit).
3. Child branch was restacked/reanchored with explicit `RESTACKING: feature/child` flow.
4. Metadata parent anchor for `feature/child` changed from old base SHA to new top-base SHA.

### Important Nuance: `gt info` vs `gt children`

External split reference suggests reading child state from `gt info`/`gt branch info` style output.

In local `gt 1.8.2` runs:

1. `gt info <branch>` and `gt branch info <branch>` printed a `Children:` header but did not list child branch names.
2. `gt children` did list child branch names.
3. sqlite metadata `children` JSON field also contained exact child names.

Repro artifact:

- `/tmp/gt-info-children-check.1774230229/out.txt`

Practical implication:

- For automation or deterministic analysis, treat `gt children` + metadata db as authoritative for descendant enumeration, not `gt info` formatting.

### Combined Design Takeaways (External Docs + Runtime)

1. The external create-stack approach is operationally sound when coupled with a strict final-tree parity check.
2. Built-in `gt split --by-file` already performs much of the manual split choreography, including branch ref rewrites and descendant restack.
3. Child-branch safety is real and runtime-visible; keep descendant handling as an explicit phase in any custom stack tool.
4. Preserve our existing rule: distinguish local-stack claims from network-coupled submit/sync claims.

### New Evidence Paths Added In This Pass

- `/tmp/gt-skill-verify.1774229568` (create-stack and split-by-file baselines)
- `/tmp/gt-skill-child-parent-verify.1774229753` (split-by-file with tracked child branch)
- `/tmp/gt-info-children-check.1774230229` (`gt info` vs `gt children` child enumeration behavior)
