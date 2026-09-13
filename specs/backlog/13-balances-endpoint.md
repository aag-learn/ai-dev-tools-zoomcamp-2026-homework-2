---
issue: 13
label: needs-triage
---

# Balances endpoint

Implement `GET /balances`, computing each person's net position from all expenses, with pytest coverage. Split from the expense endpoints because it's a distinct read/aggregation concern rather than CRUD.

Dependencies: #1, #9, #10, #12.
