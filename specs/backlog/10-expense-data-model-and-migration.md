---
issue: 10
label: needs-triage
---

# Expense data model and migration

Add the SQLAlchemy `Expense` model (description, amount, payer FK, date, participants as a many-to-many join to `Person`) and its Alembic migration. Split from the person model because it's materially more involved (foreign key plus association table) and depends on `Person` existing first.

Dependencies: #1, #8, #9.
