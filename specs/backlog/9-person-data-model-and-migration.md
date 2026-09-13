---
issue: 9
label: needs-triage
---

# Person data model and migration

Add the SQLAlchemy `Person` model (name only) and its initial Alembic migration (batch mode). Scoped separately from the expense model because it's the simpler, independent entity that the expense model's payer/participant relationships will reference.

Dependencies: #1, #8.
