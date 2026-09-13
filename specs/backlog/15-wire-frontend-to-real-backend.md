---
issue: 15
label: needs-triage
---

# Wire frontend to real backend

Point the frontend's API client at the real FastAPI backend instead of (or alongside, for tests) MSW mocks, and verify the integration works end to end for local dev. This is its own issue because the build order treats "point the frontend at the real backend" as a distinct step that only happens once phase 3 closes — it's not part of any single frontend or backend feature issue.

Dependencies: #3, #11, #12, #13, #14.
