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
3. Create a bookmark `issue-<N>` at the current tip of `main`. Invoke software-engineer to implement it there — its commits land on that bookmark, never directly on `main`.
4. Invoke qa-engineer to verify it, against that same bookmark's state.
5. On FAIL, go back to step 3, passing qa-engineer's verdict and evidence as input.
6. On PASS, re-check the acceptance criteria yourself. Push the `issue-<N>` bookmark and open a PR against `main` (`gh pr create`), linking the groomed spec and QA verdict in the description, then tell the user it's ready for review.
7. Close the issue only once the PR is actually merged (see "Branching, review, and merging" below) — QA PASS alone is not enough to close it.
8. Repeat until no open issues remain.

### Branching, review, and merging (code changes)

- Every issue's **code** implementation lives on its own bookmark
  (`issue-<N>`), never committed straight to `main`. Spec/doc work from
  planner and pm is unaffected by this — it keeps landing as direct
  commits on `main`, same as always. This split (code reviewed,
  specs not) is deliberate, not an oversight.
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

### Parallel execution (opt-in)

By default the lifecycle above processes one issue at a time in one
working copy. Only parallelize when the user explicitly asks for it —
never proactively, even when the dependency graph shows issues that
look independent (see below for why).

- Give each concurrently-worked issue its own `jj workspace` (`jj
  workspace add ../<repo-name>-issue-<N>`), so multiple software-engineer/
  qa-engineer pairs can each hold their own working-copy commit (`@`)
  without racing on the same one. All workspaces share the same
  underlying repo, commits, and bookmarks.
- **Do not use the Agent tool's `isolation: "worktree"` option for
  this.** That creates a *git* worktree, which does not interoperate
  correctly with this repo's `jj` workspaces — the orchestrator sets
  up `jj workspace add` itself and hands each subagent a specific path
  to work from.
- Each workspace still follows the bookmark/PR/review rules above —
  parallelism changes *where* work happens, not the merge process.
- Only parallelize issues that are genuinely independent at the file
  level, not just administratively unblocked by the dependency graph.
  A chain like #9→#10→#11 (each one's code depends on the previous
  one's actual output) must never be split across workspaces just
  because a later phase is nominally "unblocked" — that produces real
  merge conflicts, not just extra bookkeeping.
- After a workspace's PR is merged, `jj workspace forget <name>` and
  remove its directory.

### Rules

- Do not skip step 2 — software-engineer never receives an issue still labeled `needs-triage`.
- The software-engineer does not close the issue, push its bookmark, or open a PR — that's the orchestrator's job, once QA has passed.
- qa-engineer does not fix the code — it only outputs PASS or FAIL, with evidence.
- The orchestrator closes the issue only after its PR has been merged, which itself only happens after qa-engineer outputs PASS.

