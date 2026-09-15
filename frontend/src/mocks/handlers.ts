import { http, HttpResponse } from 'msw'
import type { HttpHandler } from 'msw'
import type { components } from '../api/schema.d.ts'

type Person = components['schemas']['Person']
type PersonCreate = components['schemas']['PersonCreate']

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
]
