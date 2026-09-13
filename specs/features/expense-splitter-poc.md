# Expense Splitter — PoC (v1)

## Summary

A single-user tool for tracking shared expenses among a fixed set of
people and computing net balances (who owes / is owed how much overall).
See `_docs/architecture.md` for the system architecture (FastAPI + Vue,
contract-first OpenAPI, SQLite → Postgres) and `_docs/testing-guidelines.md`
for how it's tested. Both are required reading before decomposing or
implementing any of this.

## Scope (v1)

### Data model

- One implicit group — there is no "create a group" step; the app manages
  a single running set of people and expenses.
- **Person:** name only.
- **Expense:** description, amount, payer, date, participants (a subset
  of people, split equally). Participants default to everyone currently
  in the group at the time the expense is entered.

### Features

1. Add a person to the group (name only).
2. List all people in the group.
3. Add an expense (description, amount, payer, participants) — split
   equally among participants.
4. Edit an expense.
5. Delete an expense.
6. List all expenses, most recent first.
7. View balances — each person's net position (e.g. "Alice: +$20.00",
   "Bob: -$20.00").

### Out of scope for v1 (deferred, not dropped)

- Multiple groups/trips.
- Multi-user accounts, login, auth.
- Unequal/percentage/exact-amount/shares splitting — equal only.
- Recording settlement/repayment ("mark as paid").
- Suggested minimal settlement plan (who-pays-whom) — net balances only.
- Multi-currency.
- Editing or deleting a person once added.
- Categories, receipts/attachments, recurring expenses.

## Build order — required sequencing

Build this in three sequential phases, not decomposed purely by feature.
Order issues (and their dependencies) to match:

1. **Contract** — define the full OpenAPI contract
   (`openapi/openapi.yaml`) covering every endpoint the v1 features above
   imply. Nothing else starts until this is settled.
2. **Frontend** — build the entire Vue frontend against the contract
   only, using MSW mocks (per `_docs/architecture.md`). No real backend
   exists during this phase; acceptance criteria for these issues must be
   verifiable against mocked responses, not a live server.
3. **Backend** — build the FastAPI backend (SQLite, SQLAlchemy, Alembic)
   to satisfy the contract, plus contract-compliance tests (Schemathesis).
   Once this phase closes, the frontend is pointed at the real backend.

End-to-end tests (Playwright, per `_docs/testing-guidelines.md`) only
become possible once phase 3 closes, since they require a real backend —
treat that as a follow-on phase, not part of phase 2 or 3.

Every phase-2 (frontend) and phase-3 (backend) issue depends on the
phase-1 contract issue(s); dependencies should be flagged explicitly when
issues are filed.
