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
3. Invoke software-engineer to implement it.
4. Invoke qa-engineer to verify it.
5. On FAIL, go back to step 3, passing qa-engineer's verdict and evidence as input.
6. On PASS, re-check the acceptance criteria yourself, then close the issue.
7. Repeat until no open issues remain.

### Rules

- Do not skip step 2 — software-engineer never receives an issue still labeled `needs-triage`.
- The software-engineer does not close the issue.
- qa-engineer does not fix the code — it only outputs PASS or FAIL, with evidence.
- The orchestrator closes the issue only after qa-engineer outputs PASS.

