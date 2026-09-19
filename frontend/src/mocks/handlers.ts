import { http, HttpResponse } from 'msw'
import type { HttpHandler } from 'msw'
import type { components } from '../api/schema.d.ts'

type Person = components['schemas']['Person']
type PersonCreate = components['schemas']['PersonCreate']
type Balance = components['schemas']['Balance']
type Expense = components['schemas']['Expense']
type ErrorBody = components['schemas']['Error']

// In-memory store shared by the GET and POST /people handlers below, so
// adding a person and then re-fetching the list (e.g. remounting a
// component) sees the addition, per specs/groomed/4-people-management-ui.md.
let people: Person[] = []
let nextPersonId = 1

/** Resets the in-memory /people store. Intended for test isolation between cases. */
export function resetPeopleStore(): void {
  people = []
  nextPersonId = 1
}

// Static, independent of any people/expenses in-memory state issues #4/#5/#6
// introduce — this screen has no mutating action, so there's nothing that
// needs to stay in sync with those.
const balances: Balance[] = [
  { person_id: 1, name: 'Alice Chen', balance: 58.4 },
  { person_id: 2, name: 'Bob Diaz', balance: -22.1 },
  { person_id: 3, name: 'Priya Nair', balance: 14.75 },
  { person_id: 4, name: 'Sam Okafor', balance: -51.05 },
]

// Seed data mirroring the four sample expenses shown in
// _docs/design/mockups/standalone/expenses.html, per
// specs/groomed/5-expense-list-view.md's Scope item 22. Person ids below
// (1=Alice, 2=Bob, 3=Priya, 4=Sam) match the order those names would be
// created in via the /people handlers above, per Scope item 2 -- if the two
// mocked datasets ever disagree (e.g. /people hasn't been seeded with
// matching records yet), ExpensesView falls back to rendering the raw
// numeric id rather than throwing, per the spec's documented edge case.
const initialExpenses: Expense[] = [
  {
    id: 1,
    description: 'Groceries',
    amount: 84.2,
    payer_id: 1,
    date: '2024-10-02',
    participant_ids: [1, 2, 3, 4],
  },
  {
    id: 2,
    description: 'Electricity bill',
    amount: 132.0,
    payer_id: 4,
    date: '2024-09-28',
    participant_ids: [1, 2, 3, 4],
  },
  {
    id: 3,
    description: 'Movie night',
    amount: 46.5,
    payer_id: 3,
    date: '2024-09-25',
    participant_ids: [1, 2, 3],
  },
  {
    id: 4,
    description: 'Internet',
    amount: 60.0,
    payer_id: 2,
    date: '2024-09-20',
    participant_ids: [1, 2, 3, 4],
  },
]

// In-memory store shared by the GET and DELETE /expenses handlers below, so
// deleting an expense and then re-fetching the list (e.g. remounting a
// component) sees the removal, per specs/groomed/5-expense-list-view.md's
// acceptance criterion 13. Already seeded/sorted date descending, id
// descending tiebreak, matching listExpenses' documented response order.
let expenses: Expense[] = initialExpenses.map((expense) => ({ ...expense }))

/** Resets the in-memory /expenses store. Intended for test isolation between cases. */
export function resetExpensesStore(): void {
  expenses = initialExpenses.map((expense) => ({ ...expense }))
}

export const handlers: HttpHandler[] = [
  http.get('/people', () => {
    return HttpResponse.json(people)
  }),
  http.post('/people', async ({ request }) => {
    const body = (await request.json()) as PersonCreate
    const person: Person = { id: nextPersonId++, name: body.name }
    people.push(person)
    return HttpResponse.json(person, { status: 201 })
  }),
  http.get('/balances', () => HttpResponse.json(balances)),
  http.get('/expenses', () => {
    return HttpResponse.json(expenses)
  }),
  http.delete('/expenses/:expense_id', ({ params }) => {
    const expenseId = Number(params.expense_id)
    const index = expenses.findIndex((expense) => expense.id === expenseId)
    if (index === -1) {
      const body: ErrorBody = { detail: `Expense ${expenseId} not found` }
      return HttpResponse.json(body, { status: 404 })
    }
    expenses.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),
]
