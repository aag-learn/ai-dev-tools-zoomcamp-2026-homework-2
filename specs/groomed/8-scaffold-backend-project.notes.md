# Implementation notes: #8 scaffold backend project

## Summary of approach

Built `backend/` by hand (not via `uv init`'s default scaffolding) after
finding that `uv init --package` creates a nested `.git` repo, a
`src/tally_backend/` module name that doesn't match the required
`src/app/` layout, and a `requires-python` floor picked from whichever
Python `uv` happens to discover first (its own managed 3.13 install, not
the `mise`-resolved 3.14.7). Final approach: `uv init backend --name
tally-backend --app --no-package --vcs none --no-pin-python -p
"$(which python3)"` to get a minimal `pyproject.toml` with no
`[build-system]` table (the app doesn't need to be built/installed as a
package — it's run in place via `uv run fastapi dev src/app/main.py` and
`uv run pytest`), then hand-wrote the rest.

## Decisions and why

- **No `[build-system]` table / non-package project.** Since `main.py`,
  `alembic/env.py`, and the test suite all only need `app` importable, not
  installed, I used `[tool.pytest.ini_options] pythonpath = ["src"]` (a
  builtin pytest 7+ feature) so `import app...` works under pytest, and
  `alembic.ini`'s `prepend_sys_path = src` (changed from the `alembic
  init` default of `.`) so `env.py`'s `from app...` imports work too.
  `fastapi dev src/app/main.py` doesn't need either — fastapi-cli resolves
  the package root by walking up from the given file through
  `__init__.py`-containing directories, which lands on `src/` (no
  `__init__.py` there) as the root, then imports `app.main`.
- **`requires-python = ">=3.14"`.** Set via `-p "$(which python3)"`
  pointing at the `mise`-resolved interpreter (3.14.7) at scaffold time,
  per the spec's confirmed answer ("no explicit pin... whatever
  `.config/mise/config.toml` resolves to"). This isn't a hand-picked floor
  independent of environment — it's uv's own inference from the active
  interpreter, so no separate value was chosen.
- **`app/db/session.py` refactored with a `_connect_args_for(url)` helper.**
  The spec's criterion 7 ("connect_args applied only when scheme is
  sqlite") reads as a code-review-style criterion, but
  `_docs/testing-guidelines.md` says every criterion should map to a test.
  Extracting the scheme-check into a small pure function makes it
  testable without needing to re-import `app.db.session` under different
  `DATABASE_URL` values (the module builds `engine` once at import time).
  `tests/test_session.py` covers this criterion plus a basic check that
  `engine` is built from `Settings().database_url`.
- **`alembic/versions/.gitkeep`.** An empty directory isn't tracked by
  git/jj, so without a placeholder file `versions/` wouldn't exist after
  a fresh checkout — same reasoning the spec already applies to
  `api/`, `schemas/`, `models/` needing a committed `__init__.py`.
- **`app/db/__init__.py` and `app/core/__init__.py` added** even though
  the spec's criterion 5 only names `base.py`/`session.py` and
  `config.py` respectively for those directories (it's explicit that
  `api/`/`schemas/`/`models/` contain *only* `__init__.py`, but doesn't
  say `db/`/`core/` must not have one). Added them for consistency as
  regular packages; this doesn't conflict with any criterion.
- **`alembic.ini`'s placeholder `sqlalchemy.url` line removed** (replaced
  with a comment) rather than left as
  `driver://user:pass@localhost/dbname`, since it's unused — `env.py`
  overwrites it via `config.set_main_option(...)` from `Settings()` before
  either migration path runs. Leaving a fake URL there seemed more likely
  to confuse a future reader than removing it.
- **No linter added or run.** Neither `AGENTS.md` nor
  `_docs/testing-guidelines.md` names a backend linter/formatter, and the
  spec's acceptance criteria don't mention one, so none was added
  (staying within "no dependency beyond acceptance criterion 1's list
  without asking").
- **`tests/test_session.py` is an extra test file** not explicitly named
  in the spec's Scope (which names `conftest.py`, `test_main.py`, and
  `test_config.py`). Added specifically to cover acceptance criterion 7,
  per testing-guidelines' "each acceptance criterion... should map to at
  least one test."

## Verified manually

- `cd backend && uv sync` — exit 0, produced `backend/uv.lock`.
- `cd backend && uv run fastapi dev src/app/main.py --port 8123` (backgrounded) —
  `curl .../openapi.json` and `curl .../docs` both returned `200`; server
  then stopped and the resulting `dev.db` deleted (not committed, per
  `.gitignore`).
- `grep -c render_as_batch backend/alembic/env.py` → `2`.
- `cd backend && uv run alembic upgrade head` — exit 0, against zero
  revisions in `versions/`.
- `cd backend && uv run pytest` — 6 passed (`test_config.py` x2,
  `test_main.py` x1, `test_session.py` x3).

## Left out of scope (per spec's "Out of scope" section)

- `Person`/`Expense` models and their migrations (#9, #10).
- Any router/schema/endpoint logic (#11, #12, #13).
- `backend/tests/contract/` and Schemathesis (#14).
- CORS config (#15).
- Auth/session middleware.
- Production Postgres/deployment config, CI wiring.

## Assumptions

- Interpreted "no explicit pin" for the Python version floor as: don't
  hand-pick a `requires-python` value independent of the environment;
  instead let `uv init -p <mise's resolved interpreter>` infer it. The
  result (`>=3.14`) reflects the `mise`-resolved 3.14.7 at implementation
  time, per the spec's confirmed answer.
- Assumed an empty `alembic/versions/` directory needs a placeholder file
  (`.gitkeep`) to survive being committed, since the spec's own edge-case
  reasoning for `__init__.py` in `api/`/`schemas/`/`models/` ("an empty
  directory alone wouldn't be tracked by git") applies equally here, even
  though the spec doesn't say so explicitly for `versions/`.

## Response to PR #18 review

Five findings came back on PR #18 after qa-engineer had already passed it.
Verdict per finding:

1. **Medium — `env.py` crashes on `%` in `DATABASE_URL` — FIXED.**
   Reproduced exactly as described:
   `config.set_main_option("sqlalchemy.url", "postgresql://user:p%40ss@...")`
   raises `ValueError: invalid interpolation syntax` from stdlib
   `ConfigParser`, since `Config.set_main_option()` stores the value through
   `ConfigParser.set()`, which treats `%` as its own interpolation escape
   character. Fixed by no longer routing the URL through
   `config.set_main_option()`/`engine_from_config()` at all: `env.py` now
   holds `database_url = Settings().database_url` as a plain variable and
   passes it directly to `context.configure(url=...)` (offline) and
   `create_engine(database_url, poolclass=pool.NullPool)` (online), neither
   of which touches `ConfigParser`. Verified the crash is gone by re-running
   the same repro (it now fails only at `psycopg2` driver import, which is
   expected — no Postgres driver is in scope for this issue) and confirmed
   `uv run alembic upgrade head` and `grep -c render_as_batch` (AC9/AC10)
   still pass against the SQLite default.

2. **Minor — AC4's `/docs` 200 not automated — FIXED.**
   Confirmed `test_main.py` only asserted `/openapi.json`. Added
   `test_docs_returns_200` alongside it in `backend/tests/test_main.py`,
   using the same `client` fixture. Both pass.

3. **Minor — `test_session.py`'s module-level `engine.url` assertion is
   environment-fragile — FIXED.**
   Confirmed: `app.db.session`'s `engine` is built once at import time from
   the real `Settings().database_url`, so `test_engine_is_constructed_from_settings_database_url`
   broke under e.g. `DATABASE_URL=postgres://... pytest`. Took the "fixed
   `DATABASE_URL` in `conftest.py`" option from the review's two suggestions
   (over dropping the assertion) since it preserves the existing coverage
   and also enforces `_docs/testing-guidelines.md`'s isolated-SQLite-only
   rule at the whole-suite level, not just per-fixture. `conftest.py` now
   sets `os.environ["DATABASE_URL"] = "sqlite:///./dev.db"` before
   `app.db.session` (or anything importing it) is first imported. Verified
   by running the full suite with `DATABASE_URL` set to a bogus Postgres
   URL and unset entirely — both pass.

4. **Nit — SQLAlchemy 2.0 cleanup — FIXED (all three).**
   - `autocommit=False` confirmed to be dead weight: `sessionmaker.__init__`'s
     real signature in SQLAlchemy 2.0.52 has no `autocommit` parameter
     (verified via `inspect.signature`); it's swallowed into `**kw` and
     forwarded to `Session()`, which also silently accepts and ignores it.
     Removed from both call sites (`app/db/session.py`,
     `tests/conftest.py`).
   - `@pytest.fixture()` → `@pytest.fixture` in `conftest.py` (both
     fixtures) — no-op parens removed.
   - `get_db()` now returns `Iterator[Session]` instead of being untyped.
   Full suite re-run after each change; all pass.

5. **Info — `requires-python = ">=3.14"` — acknowledged, no code change.**
   The reviewer's own wording already says this isn't a violation (the
   spec's open question was human-confirmed to float with whatever
   `.config/mise/config.toml` resolves to). I considered whether to add an
   explicit onboarding note but decided against it: `.config/mise/config.toml`
   already pins `python = "latest"`, and `AGENTS.md` already mandates that
   global tool versions are "managed with `mise`... not installed
   natively/locally" — so a dev following the project's own stated
   convention gets 3.14 automatically via `mise install`/`mise use`, without
   needing a separate note to tell them so. Adding one would duplicate
   guidance that already exists rather than fill a gap. If the team wants a
   sentence in `backend/README.md` pointing new contributors at `mise
   install` specifically (there's no backend README today), that's a
   product decision for the maintainer, not something I judged this review
   finding to require.

## Defect found during qa-engineer re-verification (not one of the 5 PR review findings)

After the 5 findings above were fixed and re-verified (all PASS), qa-engineer's
re-check of AC15 (`.gitignore` correctness) surfaced a distinct, previously
unflagged defect: 12 compiled `.pyc`/`__pycache__` files were already tracked
in git/jj from the very first scaffold commit, despite `backend/.gitignore`
listing both `__pycache__/` and `*.pyc`. A `.gitignore` pattern only stops
*new* files from being tracked — it doesn't retroactively untrack files
already committed before (or without) that pattern existing. Practical
consequence qa-engineer reproduced: running `uv run pytest` or
`uv run fastapi dev src/app/main.py` regenerates bytecode that differs
byte-for-byte from what's committed, so `jj status`/`git status` reports
those files as modified on every normal developer action.

Fixed by confirming the exact tracked set (`jj file list -r @- backend | grep
-i pycache`, 12 files: `backend/alembic/__pycache__/env.cpython-314.pyc`,
`backend/src/app/__pycache__/{__init__,main}.cpython-314.pyc`,
`backend/src/app/core/__pycache__/{__init__,config}.cpython-314.pyc`,
`backend/src/app/db/__pycache__/{__init__,base,session}.cpython-314.pyc`,
`backend/tests/__pycache__/{conftest,test_config,test_main,test_session}.cpython-314-pytest-9.1.1.pyc`),
deleting them from the working copy (they're regenerated build artifacts,
not source — jj has no separate git-rm/staging step, so deletion is how you
stop tracking something going forward), and committing. `backend/.gitignore`
already listed the correct patterns, so no `.gitignore` change was needed —
only the previously-committed copies had to go.

Verified the fix holds: ran `uv run pytest` (7 passed) and briefly booted
`uv run fastapi dev src/app/main.py` (curl'd `/openapi.json`, got a 200,
stopped the server) from `backend/` — the same two actions qa-engineer used
to reproduce the problem — then checked `jj status`: "The working copy has
no changes." Freshly regenerated `.pyc`/`__pycache__` files exist on disk
(confirmed via `find`) but are correctly left untracked by `.gitignore` this
time. Ran the full backend suite once more afterward to confirm no
regression (still 7 passed, `jj status` still clean).
