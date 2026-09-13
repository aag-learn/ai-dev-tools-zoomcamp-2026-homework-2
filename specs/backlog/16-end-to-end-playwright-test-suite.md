---
issue: 16
label: needs-triage
---

# End-to-end Playwright test suite for core flows

Set up `e2e/` (Playwright) and write tests for flows that cross the frontend/backend boundary: add a person and see it available as a participant, add/edit/delete an expense and see the expense list and balances update. Explicitly a follow-on phase per the feature spec, since e2e tests need a real backend and integrated frontend, which don't exist until phase 3 closes and #15 is done.

Dependencies: #15.
