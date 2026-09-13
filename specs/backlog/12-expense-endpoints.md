---
issue: 12
label: needs-triage
---

# Expense endpoints

Implement add/edit/delete/list expense endpoints per the contract, with pytest coverage, split equally among participants. Kept as one issue since these routes share the same router, schemas, and service logic; separate from balances because balance computation is distinct business logic layered on top.

Dependencies: #1, #8, #9, #10, #11.
