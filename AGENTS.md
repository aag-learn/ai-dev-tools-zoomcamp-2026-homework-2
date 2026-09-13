## Commands

- `uv sync` - install dependencies
- `uv run pytest` - the whole suite
- `uv run pytest tests/test_home.py` - one test file

## Rules

- Dependencies are added in `pyproject.toml` using the `uv` command.
  Do not add one without asking
- Databases for development (e.g. Postgres, Redis) are configured using
  compose files, not native/local installs

## Documents

- `_docs/process.md` - how work is organized
- Before writing tests, read `_docs/testing-guidelines.md`
- For anything touching the UI, read `_docs/design-system.md`
