import { fireEvent, render, screen, waitFor, within } from '@testing-library/vue'
import { http, HttpResponse } from 'msw'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '../mocks/server'
import { resetExpensesStore, resetPeopleStore } from '../mocks/handlers'
import ExpensesView from './ExpensesView.vue'

async function seedPerson(name: string) {
  await fetch('/people', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

/** Seeds Alice(1), Bob(2), Priya(3), Sam(4) -- the ids the default mocked
 * expenses (Groceries/Electricity bill/Movie night/Internet) reference. */
async function seedDefaultPeople() {
  await seedPerson('Alice')
  await seedPerson('Bob')
  await seedPerson('Priya')
  await seedPerson('Sam')
}

function makeRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/expenses', name: 'expenses', component: ExpensesView }],
  })
  return router
}

async function renderWithRouter() {
  const router = makeRouter()
  await router.push('/expenses')
  render(ExpensesView, { global: { plugins: [router] } })
  return router
}

beforeEach(() => {
  resetPeopleStore()
  resetExpensesStore()
})

describe('ExpensesView', () => {
  it('renders the header and expense list card instead of just a placeholder', async () => {
    render(ExpensesView)

    expect(screen.getByRole('heading', { level: 1, name: 'Expenses' })).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByTestId('expense-row-1')).toBeTruthy()
    })
  })

  it('fetches GET /expenses and GET /people on mount and renders every expense, in the order returned, with resolved payer/participant names, formatted amount, and formatted date', async () => {
    await seedDefaultPeople()
    render(ExpensesView)

    await waitFor(() => {
      expect(screen.getByTestId('expense-row-1')).toBeTruthy()
    })

    // Order returned by GET /expenses: Groceries, Electricity bill, Movie
    // night, Internet (date descending) -- no client-side re-sort.
    const rows = screen.getAllByTestId(/expense-row-/)
    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
      'expense-row-1',
      'expense-row-2',
      'expense-row-3',
      'expense-row-4',
    ])

    const groceries = within(screen.getByTestId('expense-row-1'))
    expect(groceries.getAllByText('Groceries').length).toBeGreaterThan(0)
    expect(groceries.getAllByText('$84.20').length).toBeGreaterThan(0)
    expect(
      groceries.getAllByText('Oct 2 · Paid by Alice · Split between Alice, Bob, Priya, Sam').length,
    ).toBeGreaterThan(0)

    const movieNight = within(screen.getByTestId('expense-row-3'))
    expect(
      movieNight.getAllByText('Sep 25 · Paid by Priya · Split between Alice, Bob, Priya').length,
    ).toBeGreaterThan(0)
  })

  it('falls back to rendering the raw numeric id when a payer/participant is not present in the GET /people response', async () => {
    // People store intentionally left empty (not seeded).
    render(ExpensesView)

    await waitFor(() => {
      expect(screen.getByTestId('expense-row-1')).toBeTruthy()
    })

    const groceries = within(screen.getByTestId('expense-row-1'))
    expect(groceries.getAllByText('Oct 2 · Paid by 1 · Split between 1, 2, 3, 4').length).toBeGreaterThan(0)
  })

  it('desktop (lg:): meta line has no truncation classes active and lists every participant name, comma-separated, in ascending person-id order', async () => {
    await seedDefaultPeople()
    render(ExpensesView)

    await waitFor(() => {
      expect(screen.getByTestId('expense-row-1')).toBeTruthy()
    })

    const row = screen.getByTestId('expense-row-1')
    const desktopBlock = row.querySelector('.md\\:flex') as HTMLElement
    const metaSpan = within(desktopBlock).getByText(/Split between/)

    expect(metaSpan.textContent).toBe('Oct 2 · Paid by Alice · Split between Alice, Bob, Priya, Sam')
    expect(metaSpan.className).toContain('lg:overflow-visible')
    expect(metaSpan.className).toContain('lg:whitespace-normal')
    // min-w-0 required on the flex ancestor so ellipsis (at md:, before the
    // lg: override kicks in) can actually engage.
    expect(desktopBlock.querySelector('.min-w-0')).toBeTruthy()
  })

  it('tablet/mobile: meta line has ellipsis-equivalent truncation classes and a min-w-0 flex ancestor', async () => {
    await seedDefaultPeople()
    render(ExpensesView)

    await waitFor(() => {
      expect(screen.getByTestId('expense-row-1')).toBeTruthy()
    })

    const row = screen.getByTestId('expense-row-1')

    const desktopBlock = row.querySelector('.md\\:flex') as HTMLElement
    const tabletMetaSpan = within(desktopBlock).getByText(/Split between/)
    expect(tabletMetaSpan.className).toContain('truncate')
    expect(desktopBlock.querySelector('.min-w-0')).toBeTruthy()

    const mobileBlock = row.querySelector('.md\\:hidden') as HTMLElement
    const mobileMetaSpan = within(mobileBlock).getByText(/Split with/)
    expect(mobileMetaSpan.className).toContain('truncate')
    expect(mobileMetaSpan.className).toContain('min-w-0')
  })

  it('mobile only: meta line uses "Split with" and "everyone" when every person participates, otherwise lists names', async () => {
    await seedDefaultPeople()
    render(ExpensesView)

    await waitFor(() => {
      expect(screen.getByTestId('expense-row-1')).toBeTruthy()
    })

    const groceriesMobile = within(
      screen.getByTestId('expense-row-1').querySelector('.md\\:hidden') as HTMLElement,
    )
    expect(groceriesMobile.getByText('Oct 2 · Paid by Alice · Split with everyone')).toBeTruthy()

    const movieNightMobile = within(
      screen.getByTestId('expense-row-3').querySelector('.md\\:hidden') as HTMLElement,
    )
    expect(
      movieNightMobile.getByText('Sep 25 · Paid by Priya · Split with Alice, Bob, Priya'),
    ).toBeTruthy()
  })

  it('mobile row layout: description + amount on one line, meta text + edit/delete buttons on a second line', async () => {
    await seedDefaultPeople()
    render(ExpensesView)

    await waitFor(() => {
      expect(screen.getByTestId('expense-row-1')).toBeTruthy()
    })

    const mobileBlock = screen.getByTestId('expense-row-1').querySelector('.md\\:hidden') as HTMLElement
    const lines = mobileBlock.querySelectorAll(':scope > div')
    expect(lines.length).toBe(2)

    const lineOne = within(lines[0] as HTMLElement)
    expect(lineOne.getByText('Groceries')).toBeTruthy()
    expect(lineOne.getByText('$84.20')).toBeTruthy()

    const lineTwo = within(lines[1] as HTMLElement)
    expect(lineTwo.getByText(/Split with/)).toBeTruthy()
    expect(lineTwo.getAllByRole('button').length).toBe(2)
  })

  it('desktop/tablet (md: and up): header renders h1, subtitle, and a primary labeled "Add expense" button; mobile: no subtitle, icon-only "Add expense" button', () => {
    render(ExpensesView)

    const subtitle = screen.getByText('Most recent first.')
    expect(subtitle.className).toContain('hidden')
    expect(subtitle.className).toContain('md:block')

    const addButtons = screen.getAllByRole('button', { name: 'Add expense' })
    expect(addButtons).toHaveLength(2)

    const desktopButton = addButtons.find((button) => button.className.includes('md:flex'))
    const mobileButton = addButtons.find((button) => button.className.includes('md:hidden'))

    expect(desktopButton).toBeTruthy()
    expect(desktopButton?.className).toContain('hidden')
    expect(desktopButton?.textContent).toContain('Add expense')

    expect(mobileButton).toBeTruthy()
    expect(mobileButton?.getAttribute('aria-label')).toBe('Add expense')
  })

  it("clicking a row's delete button calls DELETE /expenses/{id}; the row is removed only once the mocked 204 resolves, not optimistically before", async () => {
    await seedDefaultPeople()
    render(ExpensesView)

    await waitFor(() => {
      expect(screen.getByTestId('expense-row-1')).toBeTruthy()
    })

    let resolveDelete: (() => void) | undefined
    server.use(
      http.delete('/expenses/:expense_id', async () => {
        await new Promise<void>((resolve) => {
          resolveDelete = resolve
        })
        return new HttpResponse(null, { status: 204 })
      }),
    )

    const deleteButton = screen.getByRole('button', { name: 'Delete Groceries' })
    await fireEvent.click(deleteButton)

    // Still present -- the mocked response hasn't resolved yet.
    expect(screen.getByTestId('expense-row-1')).toBeTruthy()

    resolveDelete?.()

    await waitFor(() => {
      expect(screen.queryByTestId('expense-row-1')).toBeNull()
    })
  })

  it('a failed DELETE /expenses/{id} (404) leaves the row in place', async () => {
    await seedDefaultPeople()
    server.use(
      http.delete('/expenses/:expense_id', () =>
        HttpResponse.json({ detail: 'Expense not found' }, { status: 404 }),
      ),
    )
    render(ExpensesView)

    await waitFor(() => {
      expect(screen.getByTestId('expense-row-1')).toBeTruthy()
    })

    const deleteButton = screen.getByRole('button', { name: 'Delete Groceries' })
    await fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(screen.getByText("Couldn't delete that expense. Please try again.")).toBeTruthy()
    })
    expect(screen.getByTestId('expense-row-1')).toBeTruthy()
  })

  it('deleting an expense, then triggering a second GET /expenses (remount), no longer includes the deleted expense', async () => {
    await seedDefaultPeople()
    const { unmount } = render(ExpensesView)

    await waitFor(() => {
      expect(screen.getByTestId('expense-row-1')).toBeTruthy()
    })

    const deleteButton = screen.getByRole('button', { name: 'Delete Groceries' })
    await fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(screen.queryByTestId('expense-row-1')).toBeNull()
    })

    unmount()
    render(ExpensesView)

    await waitFor(() => {
      expect(screen.getByTestId('expense-row-2')).toBeTruthy()
    })
    expect(screen.queryByTestId('expense-row-1')).toBeNull()
  })

  it("clicking a row's edit button or the header/top-bar Add expense control is a no-op: no throw, no route change, list unchanged", async () => {
    await seedDefaultPeople()
    const router = await renderWithRouter()

    await waitFor(() => {
      expect(screen.getByTestId('expense-row-1')).toBeTruthy()
    })

    const rowsBefore = screen.getAllByTestId(/expense-row-/).map((row) => row.getAttribute('data-testid'))

    const editButton = screen.getByRole('button', { name: 'Edit Groceries' })
    await expect(fireEvent.click(editButton)).resolves.not.toThrow()

    const addButtons = screen.getAllByRole('button', { name: 'Add expense' })
    for (const button of addButtons) {
      await expect(fireEvent.click(button)).resolves.not.toThrow()
    }

    expect(router.currentRoute.value.path).toBe('/expenses')
    const rowsAfter = screen.getAllByTestId(/expense-row-/).map((row) => row.getAttribute('data-testid'))
    expect(rowsAfter).toEqual(rowsBefore)
  })

  it('desktop (lg:): each row has an edit button with aria-label "Edit {description}" and a delete button with aria-label "Delete {description}", varying per row', async () => {
    await seedDefaultPeople()
    render(ExpensesView)

    await waitFor(() => {
      expect(screen.getByTestId('expense-row-1')).toBeTruthy()
    })

    expect(screen.getByRole('button', { name: 'Edit Groceries' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete Groceries' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit Internet' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete Internet' })).toBeTruthy()
  })

  it('renders an empty-state row instead of an empty white box when there are zero expenses', async () => {
    server.use(http.get('/expenses', () => HttpResponse.json([])))
    render(ExpensesView)

    await waitFor(() => {
      expect(screen.getByText('No expenses yet — add one above.')).toBeTruthy()
    })
  })
})
