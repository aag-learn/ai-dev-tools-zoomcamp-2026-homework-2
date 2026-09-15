import { render, screen } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import App from '../src/App.vue'
import PeopleView from '../src/views/PeopleView.vue'
import ExpensesView from '../src/views/ExpensesView.vue'
import BalancesView from '../src/views/BalancesView.vue'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', redirect: '/expenses' },
      { path: '/people', name: 'people', component: PeopleView },
      { path: '/expenses', name: 'expenses', component: ExpensesView },
      { path: '/balances', name: 'balances', component: BalancesView },
    ],
  })
}

describe('router navigation', () => {
  it('navigates between all three routes and renders the matching placeholder heading', async () => {
    const router = makeRouter()
    render(App, { global: { plugins: [router] } })

    await router.push('/people')
    expect(
      screen.getByRole('heading', { level: 1, name: 'People' }),
    ).toBeTruthy()

    await router.push('/expenses')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Expenses' }),
    ).toBeTruthy()

    await router.push('/balances')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Balances' }),
    ).toBeTruthy()
  })

  it('redirects from / to /expenses', async () => {
    const router = makeRouter()
    render(App, { global: { plugins: [router] } })

    await router.push('/')
    expect(router.currentRoute.value.path).toBe('/expenses')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Expenses' }),
    ).toBeTruthy()
  })
})
