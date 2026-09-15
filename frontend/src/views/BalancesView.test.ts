import { render, screen, within } from '@testing-library/vue'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import BalancesView from './BalancesView.vue'
import { server } from '../mocks/server'

function barWidths(container: HTMLElement): string[] {
  return within(container)
    .getAllByTestId('balance-bar')
    .map((el) => el.style.width)
}

describe('BalancesView', () => {
  afterEach(() => {
    server.resetHandlers()
  })

  it('renders one row per balance, in the order returned, with correct name/status/sign/color', async () => {
    render(BalancesView)

    const desktop = within(await screen.findByTestId('balances-desktop'))
    const rows = desktop.getAllByTestId('balance-row')
    expect(rows).toHaveLength(4)

    const names = rows.map((row) => within(row).getByText(/Chen|Diaz|Nair|Okafor/).textContent)
    expect(names).toEqual(['Alice Chen', 'Bob Diaz', 'Priya Nair', 'Sam Okafor'])

    // Alice: +$58.40, is owed, emerald
    expect(within(rows[0]).getByText('A')).toBeTruthy()
    expect(within(rows[0]).getByText('is owed')).toBeTruthy()
    const aliceAmount = within(rows[0]).getByTestId('balance-amount')
    expect(aliceAmount.textContent).toBe('+$58.40')
    expect(aliceAmount.className).toContain('text-emerald-600')

    // Bob: −$22.10, owes, rose (real minus sign, U+2212)
    expect(within(rows[1]).getByText('owes')).toBeTruthy()
    const bobAmount = within(rows[1]).getByTestId('balance-amount')
    expect(bobAmount.textContent).toBe('−$22.10')
    expect(bobAmount.className).toContain('text-rose-600')

    // Priya: +$14.75, is owed, emerald
    const priyaAmount = within(rows[2]).getByTestId('balance-amount')
    expect(priyaAmount.textContent).toBe('+$14.75')
    expect(priyaAmount.className).toContain('text-emerald-600')

    // Sam: −$51.05, owes, rose
    const samAmount = within(rows[3]).getByTestId('balance-amount')
    expect(samAmount.textContent).toBe('−$51.05')
    expect(samAmount.className).toContain('text-rose-600')
  })

  it('renders bar widths proportional to the largest magnitude on screen', async () => {
    render(BalancesView)

    const desktop = await screen.findByTestId('balances-desktop')
    const widths = barWidths(desktop)
    expect(widths).toEqual(['100%', '38%', '25%', '87%'])
  })

  it('renders every bar at 0% width, with no division-by-zero error, when every balance is 0', async () => {
    server.use(
      http.get('/balances', () =>
        HttpResponse.json([
          { person_id: 1, name: 'Alice Chen', balance: 0 },
          { person_id: 2, name: 'Bob Diaz', balance: 0 },
        ]),
      ),
    )

    render(BalancesView)

    const desktop = await screen.findByTestId('balances-desktop')
    const widths = barWidths(desktop)
    expect(widths).toEqual(['0%', '0%'])
  })

  it('renders a balance of 0 as "settled up", $0.00, in muted slate-500 text', async () => {
    server.use(
      http.get('/balances', () =>
        HttpResponse.json([{ person_id: 1, name: 'Alice Chen', balance: 0 }]),
      ),
    )

    render(BalancesView)

    const desktop = within(await screen.findByTestId('balances-desktop'))
    expect(desktop.getByText('settled up')).toBeTruthy()
    const amount = desktop.getByTestId('balance-amount')
    expect(amount.textContent).toBe('$0.00')
    expect(amount.className).toContain('text-slate-500')
    expect(amount.className).not.toContain('text-emerald-600')
    expect(amount.className).not.toContain('text-rose-600')
  })

  it('renders the status word on desktop/tablet rows but never on mobile rows', async () => {
    render(BalancesView)

    const desktop = within(await screen.findByTestId('balances-desktop'))
    expect(desktop.getAllByText('is owed')).toHaveLength(2)
    expect(desktop.getAllByText('owes')).toHaveLength(2)

    const mobile = within(screen.getByTestId('balances-mobile'))
    expect(mobile.queryByText('is owed')).toBeNull()
    expect(mobile.queryByText('owes')).toBeNull()
    expect(mobile.queryByText('settled up')).toBeNull()
    // The mobile rows still render name and amount.
    expect(mobile.getAllByTestId('balance-row')).toHaveLength(4)
    expect(mobile.getByText('Alice Chen')).toBeTruthy()
  })

  it('gates the desktop container behind md:block and the mobile container behind md:hidden', async () => {
    render(BalancesView)

    const desktop = await screen.findByTestId('balances-desktop')
    const mobile = screen.getByTestId('balances-mobile')
    expect(desktop.className).toContain('hidden')
    expect(desktop.className).toContain('md:block')
    expect(mobile.className).toContain('md:hidden')
  })

  it('renders both the h1 and subtitle, gated so the subtitle is desktop/tablet only, and no button anywhere in the header', async () => {
    render(BalancesView)

    expect(screen.getByRole('heading', { level: 1, name: 'Balances' })).toBeTruthy()
    const subtitle = screen.getByText('Net position for everyone in the group.')
    expect(subtitle.className).toContain('hidden')
    expect(subtitle.className).toContain('md:block')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('renders no edit, delete, settle-up, or other actionable control anywhere on the screen', async () => {
    render(BalancesView)

    await screen.findByTestId('balances-desktop')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(document.querySelectorAll('button')).toHaveLength(0)
  })

  it('renders a muted empty-list row when GET /balances returns an empty array', async () => {
    server.use(http.get('/balances', () => HttpResponse.json([])))

    render(BalancesView)

    const empty = await screen.findByTestId('balances-empty')
    expect(
      within(empty).getByText('No balances yet — add a person and an expense to see balances.'),
    ).toBeTruthy()
  })

  it('only calls GET /balances on mount, never GET /people or GET /expenses', async () => {
    const seenPaths: string[] = []
    const listener = ({ request }: { request: Request }) => {
      seenPaths.push(new URL(request.url).pathname)
    }
    server.events.on('request:start', listener)

    render(BalancesView)
    await screen.findByTestId('balances-desktop')

    server.events.removeListener('request:start', listener)
    expect(seenPaths).toEqual(['/balances'])
  })
})
