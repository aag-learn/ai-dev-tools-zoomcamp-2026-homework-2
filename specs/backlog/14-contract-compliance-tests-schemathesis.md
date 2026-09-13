---
issue: 14
label: needs-triage
---

# Contract-compliance tests (Schemathesis)

Add `backend/tests/contract/` Schemathesis tests verifying the running app matches `openapi/openapi.yaml` (status codes, schemas, required fields). Called out as its own issue per `_docs/testing-guidelines.md`, since these are generated from the contract rather than hand-written per endpoint, and only make sense once every endpoint they'd exercise exists.

Dependencies: #1, #11, #12, #13.
