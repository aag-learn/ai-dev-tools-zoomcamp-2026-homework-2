---
issue: 20
label: needs-triage
---

# Evaluate shared frontend state management (e.g. Pinia) to reduce duplicate fetches across screens

Today, and in every frontend feature issue built so far (#4 People, #5 Expenses, #6 Expense form, #7 Balances), each Vue screen independently calls the backend (via MSW today, the real backend after #15) to fetch its own data on mount — there is no shared store anywhere in the frontend. This was a deliberate simplification made while scoping #4-#7, not an oversight, and is being filed now specifically so it isn't lost, not because it needs attention soon. This issue covers evaluating whether that tradeoff is worth revisiting — concretely, the redundant network calls it causes (e.g. both the People screen and the Expense form independently fetching `GET /people`) and the risk of one screen showing stale data relative to another within the same session — and, if the evaluation concludes it's worth it, introducing a minimal shared store (e.g. Pinia) scoped to the data that's actually duplicated across screens, rather than a general-purpose state layer. It's scoped as a single issue because the evaluation and the (possible) minimal implementation are one coherent judgment call for one engineer to make in one sitting; it is not scoped to a specific screen because the problem is cross-screen by nature.

This is a "some day, not now" backlog item — no urgency implied.

## Dependencies

None.
