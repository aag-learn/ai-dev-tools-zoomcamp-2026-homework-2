import { render, screen, within } from '@testing-library/vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import AppShell from './AppShell.vue'
import PeopleView from '../views/PeopleView.vue'
import ExpensesView from '../views/ExpensesView.vue'
import BalancesView from '../views/BalancesView.vue'

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

const routes = [
  { path: '/people', label: 'People' },
  { path: '/expenses', label: 'Expenses' },
  { path: '/balances', label: 'Balances' },
]

describe('AppShell', () => {
  it('renders exactly three nav items in the sidebar and the tab bar', async () => {
    const router = makeRouter()
    render(AppShell, { global: { plugins: [router] } })
    await router.push('/people')

    const sidebar = within(screen.getByTestId('sidebar'))
    const tabbar = within(screen.getByTestId('tabbar'))

    for (const { label } of routes) {
      expect(sidebar.getByText(label)).toBeTruthy()
      expect(tabbar.getByText(label)).toBeTruthy()
    }
  })

  it.each(routes)(
    'marks $label active and the other two inactive when on $path',
    async ({ path, label }) => {
      const router = makeRouter()
      render(AppShell, { global: { plugins: [router] } })
      await router.push(path)

      const sidebar = within(screen.getByTestId('sidebar'))
      const tabbar = within(screen.getByTestId('tabbar'))

      const activeSidebarLabel = sidebar.getByText(label)
      expect(activeSidebarLabel.className).toContain('text-indigo-700')
      const activeSidebarLink = activeSidebarLabel.closest('a')
      expect(activeSidebarLink?.className).toContain('bg-indigo-50')

      const activeTabbarLabel = tabbar.getByText(label)
      expect(activeTabbarLabel.className).toContain('text-indigo-700')

      for (const other of routes.filter((r) => r.label !== label)) {
        const inactiveSidebarLabel = sidebar.getByText(other.label)
        expect(inactiveSidebarLabel.className).toContain('text-slate-600')
        expect(inactiveSidebarLabel.className).not.toContain('text-indigo-700')

        const inactiveTabbarLabel = tabbar.getByText(other.label)
        expect(inactiveTabbarLabel.className).toContain('text-slate-500')
        expect(inactiveTabbarLabel.className).not.toContain('text-indigo-700')
      }
    },
  )
})
