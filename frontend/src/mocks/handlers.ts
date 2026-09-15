import { http, HttpResponse } from 'msw'
import type { HttpHandler } from 'msw'
import type { components } from '../api/schema.d.ts'

type Person = components['schemas']['Person']
type PersonCreate = components['schemas']['PersonCreate']
type Balance = components['schemas']['Balance']

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
]
