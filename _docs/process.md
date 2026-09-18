## Workflow

- Tasks are tracked as GitHub issues, worked one at a time.
- Read the issue's acceptance criteria before starting work on it, and again before closing it.
- Commit regularly. This project uses Jujutsu (`jj`), not git, as its version control system.

## Orchestrator

The main session is the orchestrator. It launches the planner, the pm, the
software-engineer, and the qa-engineer as subagents. It does not groom,
implement, or test anything itself.

### Roles

- **planner** — decomposes a broad idea into right-sized GitHub issues, labeled `needs-triage`. Invoked to seed the backlog, not part of the per-issue loop below.
- **pm** — grooms one issue into a complete spec, relabels it `groomed`.
- **software-engineer** — implements one groomed spec.
- **qa-engineer** — independently verifies an implementation; outputs PASS or FAIL only, never fixes code.

### Status and specs

- Status lives on GitHub labels only — `needs-triage` → `groomed`. Never infer status from which `specs/` folder a file happens to be in.
- `specs/TASK-TEMPLATE.md` — shared template every groomed task is written against.
- `specs/backlog/<issue>-<slug>.md` — thin planner-authored candidate; retired once pm grooms it.
- `specs/groomed/<issue>-<slug>.md` — the full spec; the fixed target software-engineer implements against and qa-engineer verifies against.
- `specs/groomed/<issue>-<slug>.notes.md` — software-engineer's implementation notes and decisions, separate from the spec itself.

### Starting from a feature file

To start a new feature: `implement feature <slug>`, where `<slug>` matches
a file at `specs/features/<slug>.md` exactly. If no such file exists, stop
and say so rather than guessing which file was meant.

1. Invoke the planner on that file to produce candidate GitHub issues.
   Planner's own review checkpoint applies as usual — nothing is filed
   until you approve the breakdown.
2. Take the specific issue numbers planner reports back. Run the per-issue
   lifecycle below only on those issues, in the order planner flagged for
   dependencies — do not also pick up unrelated issues already open in the
   backlog during this run.
3. When every issue from this feature is closed, stop and report what
   shipped. Don't continue on to the rest of the backlog.

### Lifecycle

Used above for a specific feature's issues, or on its own when you just say
"work through the backlog" — in that case, step 1 pulls from every open
issue rather than a feature-scoped list.

1. Pick the next open issue (ordering by label/milestone/project priority). If none are open, stop and suggest invoking the planner subagent to add items to the backlog.
2. If the issue is still labeled `needs-triage`, invoke pm to groom it before anything else.
3. Read the groomed spec's "Open questions" section. If it says `None`, proceed straight to step 4. Otherwise, present the open questions to the user and wait for them to confirm pm's stated assumptions or correct them — do not invoke software-engineer until they've responded. This is the checkpoint that catches a wrong assumption before code gets built on it, not after.
4. Create a bookmark `issue-<N>` at `main`'s current tip. Then give
   software-engineer its own `jj workspace` to work in — never the
   orchestrator's own working copy: `jj workspace add
   ../<repo-name>-issue-<N>`, then from inside that new directory, `jj
   new issue-<N>` to position its working copy on the bookmark. Invoke
   software-engineer and tell it that workspace's path; its commits
   land on the `issue-<N>` bookmark from inside that workspace, never
   directly on `main` and never in the orchestrator's own default
   working copy. This is unconditional — not just for parallel runs
   (see "Running multiple issues concurrently" below) — because it's
   what keeps the orchestrator's own `@` free: safe for the
   orchestrator to make its own commits (docs, specs,
   agent-definition changes, whatever else comes up) while
   software-engineer is mid-task, without a `jj commit` snapshot in
   one working copy sweeping up the other's in-progress edits. (This
   is exactly the failure mode that motivated the rule: the
   orchestrator once edited files directly in the shared working copy
   while software-engineer was concurrently committing there, and a
   `jj commit` silently swept the orchestrator's unrelated edits into
   software-engineer's commit, producing a divergent change that took
   manual `jj split`/`jj abandon` surgery to untangle.)
5. Invoke qa-engineer to verify it, in that same workspace.
6. On FAIL, go back to step 4, passing qa-engineer's verdict and evidence as input.
7. On PASS, re-check the acceptance criteria yourself. Push the `issue-<N>` bookmark and open a PR against `main` (`gh pr create`), linking the groomed spec and QA verdict in the description as real GitHub file links (see "PR description links" below), then tell the user it's ready for review.
8. Close the issue only once the PR is actually merged (see "Branching, review, and merging" below) — QA PASS alone is not enough to close it. Then `jj workspace forget <name>` and remove its directory — the workspace's only job was to hold this issue's work until it merged.
9. Repeat until no open issues remain.

### Branching, review, and merging (code changes)

- Every issue's **code** implementation lives on its own bookmark
  (`issue-<N>`), never committed straight to `main`. Spec/doc work from
  planner and pm is unaffected by this — it keeps landing as direct
  commits on `main`, same as always. This split (code reviewed,
  specs not) is deliberate, not an oversight.
- **Never make a "direct to main" commit unless `main` is actually an
  ancestor of `@`.** In a single (non-parallel) working copy, `@` is
  shared: after a subagent finishes work on `issue-<N>`, or after a PR
  merges on GitHub and `jj git fetch` moves the `main` bookmark forward,
  `@` does not automatically follow — it's left wherever it last was.
  Committing there and pushing the result as `main` either (a) silently
  carries an unreviewed bookmark's commits into `main`, bypassing PR
  review, or (b) creates a divergent sibling of `main` that `jj bookmark
  set main` will refuse to move to ("refusing to move bookmark backwards
  or sideways") — or worse, `--allow-backwards` would force it through
  and actually lose the merged PR's commits from `main`. Before any
  direct-to-`main` commit, don't just check that `@` has no unique
  commits missing from `main`'s history (`jj log -r 'main..@'` being
  empty does **not** prove this — two sibling branches off a shared
  ancestor satisfy that too, which is exactly how this went wrong once
  already). Check the other direction instead: confirm `main` is an
  ancestor of `@` with `jj log -r 'main & ::@'` — it must print `main`'s
  own commit, not come back empty. If it's empty (or you're unsure),
  don't try to rebase your way out blind; just run `jj new main` first
  to get a clean, guaranteed-correct starting point.
- Once qa-engineer PASSes and the orchestrator's own acceptance-criteria
  recheck confirms it, the orchestrator — not software-engineer —
  pushes the bookmark and opens the PR, then notifies the user.
- **The orchestrator never merges a PR on its own initiative.** The
  user reviews and either merges it themselves or explicitly asks the
  orchestrator to. Only after the PR is actually merged does the
  orchestrator run `jj git fetch` to sync local `main` and close the
  issue.
- If QA later finds a problem in an already-open PR, go back to
  software-engineer on the same bookmark; don't open a second PR for
  the same issue.

#### PR description links

Any reference to a repo file in a PR description (spec, notes, QA
report, etc.) must be a real GitHub link that resolves and renders as
clickable, not a bare path in backticks — GitHub does not auto-link
plain relative paths. Use a blob URL pinned to the PR's head commit or
bookmark, e.g.:

```
https://github.com/<org>/<repo>/blob/issue-<N>/specs/groomed/<N>-<slug>.md
```

Pin to the branch/bookmark (or a specific commit SHA), not `main` —
`main` won't have the file yet if the PR hasn't merged. This applies
everywhere a PR body is written, not just by the orchestrator.

### Running multiple issues concurrently (opt-in)

Every issue already gets its own `jj workspace` per step 4 above,
regardless of whether anything else is in flight — that per-issue
isolation is unconditional, not the opt-in part. What's opt-in is
running more than one issue's software-engineer/qa-engineer pair *at
the same time*. Only do that when the user explicitly asks for it —
never proactively, even when the dependency graph shows issues that
look independent (see below for why).

- All workspaces share the same underlying repo, commits, and
  bookmarks, so multiple software-engineer/qa-engineer pairs can each
  hold their own working-copy commit (`@`) without racing on the same
  one.
- **Do not use the Agent tool's `isolation: "worktree"` option for
  this.** That creates a *git* worktree, which does not interoperate
  correctly with this repo's `jj` workspaces — the orchestrator sets
  up `jj workspace add` itself and hands each subagent a specific path
  to work from.
- Each workspace still follows the bookmark/PR/review rules above —
  running several at once changes *where* work happens, not the merge
  process.
- Only run issues concurrently when they're genuinely independent at
  the file level, not just administratively unblocked by the
  dependency graph. A chain like #9→#10→#11 (each one's code depends
  on the previous one's actual output) must never be split across
  workspaces just because a later phase is nominally "unblocked" —
  that produces real merge conflicts, not just extra bookkeeping.

### Rules

- Do not skip step 2 — software-engineer never receives an issue still labeled `needs-triage`.
- Do not skip step 3 either — a groomed spec with unresolved open questions never goes to software-engineer without the user's explicit sign-off first, even though pm already wrote down a reasonable default for each one. The default is there so implementation isn't blocked forever, not so the checkpoint can be skipped.
- The software-engineer does not close the issue, push its bookmark, or open a PR — that's the orchestrator's job, once QA has passed.
- qa-engineer does not fix the code — it only outputs PASS or FAIL, with evidence.
- The orchestrator closes the issue only after its PR has been merged, which itself only happens after qa-engineer outputs PASS.
- software-engineer and qa-engineer always work in a dedicated `jj
  workspace` for the issue at hand, never in the orchestrator's own
  default working copy — see step 4. This holds even for a single
  issue worked on its own; it's what keeps the orchestrator's own `@`
  safe to use for anything else (docs, specs, agent-definition edits)
  while they're running.

