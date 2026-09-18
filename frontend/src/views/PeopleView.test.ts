import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '../mocks/server'
import { resetPeopleStore } from '../mocks/handlers'
import PeopleView from './PeopleView.vue'

async function seedPerson(name: string) {
  await fetch('/people', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

beforeEach(() => {
  resetPeopleStore()
})

describe('PeopleView', () => {
  it('renders the add-person form and the person list card instead of just a placeholder', async () => {
    render(PeopleView)

    expect(screen.getByRole('heading', { level: 1, name: 'People' })).toBeTruthy()
    expect(screen.getByPlaceholderText("Add a person's name")).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText('No people yet — add one above.')).toBeTruthy()
    })
  })

  it('fetches GET /people on mount and renders every person with name and avatar initial', async () => {
    await seedPerson('Alice Chen')
    await seedPerson('Bob Diaz')

    render(PeopleView)

    await waitFor(() => {
      expect(screen.getByText('Alice Chen')).toBeTruthy()
      expect(screen.getByText('Bob Diaz')).toBeTruthy()
    })
    expect(screen.getByText('A')).toBeTruthy()
    expect(screen.getByText('B')).toBeTruthy()
  })

  it('renders rows in the order GET /people returns them, with no client-side re-sort', async () => {
    await seedPerson('Zed Owusu')
    await seedPerson('Amy Baxter')

    render(PeopleView)

    await waitFor(() => {
      expect(screen.getByText('Zed Owusu')).toBeTruthy()
    })
    const names = screen.getAllByText(/Owusu|Baxter/).map((el) => el.textContent)
    expect(names).toEqual(['Zed Owusu', 'Amy Baxter'])
  })

  it('trims leading/trailing whitespace, submits POST /people, appends the new row, and clears the input', async () => {
    render(PeopleView)
    await waitFor(() => {
      expect(screen.getByText('No people yet — add one above.')).toBeTruthy()
    })

    const input = screen.getByPlaceholderText("Add a person's name") as HTMLInputElement
    await fireEvent.update(input, '  Dana Lee  ')

    let capturedBody: unknown
    server.use(
      http.post('/people', async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ id: 999, name: 'Dana Lee' }, { status: 201 })
      }),
    )

    const addButton = screen.getByRole('button', { name: 'Add' })
    await fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByText('Dana Lee')).toBeTruthy()
    })
    expect(capturedBody).toEqual({ name: 'Dana Lee' })
    expect(input.value).toBe('')
  })

  it('is a no-op for an empty or whitespace-only input: no POST is sent and the submit control is disabled', async () => {
    let postCalls = 0
    server.use(
      http.post('/people', () => {
        postCalls++
        return HttpResponse.json({ id: 1, name: 'x' }, { status: 201 })
      }),
    )

    render(PeopleView)
    const input = screen.getByPlaceholderText("Add a person's name") as HTMLInputElement
    const addButton = screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement

    expect(addButton.disabled).toBe(true)

    await fireEvent.update(input, '   ')
    expect(addButton.disabled).toBe(true)

    await fireEvent.click(addButton)
    expect(postCalls).toBe(0)
  })

  it('enables the submit control once the trimmed input is non-empty', async () => {
    render(PeopleView)
    const input = screen.getByPlaceholderText("Add a person's name") as HTMLInputElement
    const addButton = screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement

    await fireEvent.update(input, 'Priya')
    expect(addButton.disabled).toBe(false)
  })

  it('shares state between the POST and GET /people mock handlers: adding a person and remounting shows it', async () => {
    const { unmount } = render(PeopleView)
    const input = screen.getByPlaceholderText("Add a person's name") as HTMLInputElement
    const addButton = screen.getByRole('button', { name: 'Add' })

    await fireEvent.update(input, 'Sam Okafor')
    await fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByText('Sam Okafor')).toBeTruthy()
    })

    unmount()

    render(PeopleView)
    await waitFor(() => {
      expect(screen.getByText('Sam Okafor')).toBeTruthy()
    })
  })

  it('shows inline error text and does not clear the input or add a row when POST /people fails', async () => {
    server.use(http.post('/people', () => HttpResponse.json({ detail: 'boom' }, { status: 422 })))

    render(PeopleView)
    const input = screen.getByPlaceholderText("Add a person's name") as HTMLInputElement
    const addButton = screen.getByRole('button', { name: 'Add' })

    await fireEvent.update(input, 'Nina Park')
    await fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByText("Couldn't add that person. Please try again.")).toBeTruthy()
    })
    expect(input.value).toBe('Nina Park')
    expect(screen.queryByText('Nina Park', { selector: 'span' })).toBeNull()
  })

  it('shows inline error text (no unhandled rejection) when the request fails at the transport level, not just with an HTTP error status', async () => {
    render(PeopleView)
    const input = screen.getByPlaceholderText("Add a person's name") as HTMLInputElement
    const addButton = screen.getByRole('button', { name: 'Add' })

    await fireEvent.update(input, 'Off Line')

    // Stop MSW from intercepting so the request falls through to a real
    // fetch against an address nothing is listening on -- this is what a
    // genuine network failure (e.g. connection refused) looks like, as
    // opposed to a mocked non-2xx HTTP response.
    server.close()
    try {
      await fireEvent.click(addButton)

      await waitFor(() => {
        expect(screen.getByText("Couldn't add that person. Please try again.")).toBeTruthy()
      })
      expect(input.value).toBe('Off Line')
    } finally {
      server.listen({ onUnhandledRequest: 'error' })
    }
  })

  it('clears a stale inline error once the user edits the input again', async () => {
    server.use(http.post('/people', () => HttpResponse.json({ detail: 'boom' }, { status: 422 })))

    render(PeopleView)
    const input = screen.getByPlaceholderText("Add a person's name") as HTMLInputElement
    const addButton = screen.getByRole('button', { name: 'Add' })

    await fireEvent.update(input, 'Nina Park')
    await fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByText("Couldn't add that person. Please try again.")).toBeTruthy()
    })

    await fireEvent.update(input, 'Nina Parker')

    expect(screen.queryByText("Couldn't add that person. Please try again.")).toBeNull()
  })

  it('ignores a second submit while the first POST /people is still in flight (no double-add)', async () => {
    let postCalls = 0
    let resolveFirst: (() => void) | undefined
    server.use(
      http.post('/people', async () => {
        postCalls++
        await new Promise<void>((resolve) => {
          resolveFirst = resolve
        })
        return HttpResponse.json({ id: 1, name: 'Kim Lee' }, { status: 201 })
      }),
    )

    render(PeopleView)
    const input = screen.getByPlaceholderText("Add a person's name") as HTMLInputElement
    const addButton = screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement

    await fireEvent.update(input, 'Kim Lee')
    await fireEvent.click(addButton)

    await waitFor(() => {
      expect(addButton.disabled).toBe(true)
    })

    await fireEvent.click(addButton)
    expect(postCalls).toBe(1)

    resolveFirst?.()

    await waitFor(() => {
      expect(screen.getByText('Kim Lee')).toBeTruthy()
    })
    expect(screen.getAllByText('Kim Lee')).toHaveLength(1)
  })

  it('has maxlength=100 on the add-person input, matching PersonCreate', async () => {
    render(PeopleView)
    const input = screen.getByPlaceholderText("Add a person's name") as HTMLInputElement
    expect(input.maxLength).toBe(100)
  })

  it('has an accessible name on the add-person input, not just a placeholder', () => {
    render(PeopleView)
    expect(screen.getByRole('textbox', { name: "Add a person's name" })).toBeTruthy()
  })

  it('submits via the Enter key (the form submit event), not just a button click', async () => {
    render(PeopleView)
    const input = screen.getByPlaceholderText("Add a person's name") as HTMLInputElement

    await fireEvent.update(input, 'Enter Key')
    await fireEvent.submit(input.closest('form') as HTMLFormElement)

    await waitFor(() => {
      expect(screen.getByText('Enter Key')).toBeTruthy()
    })
    expect(input.value).toBe('')
  })

  it('renders no edit, delete, or other mutating control on any person row', async () => {
    await seedPerson('Alice Chen')
    render(PeopleView)

    await waitFor(() => {
      expect(screen.getByText('Alice Chen')).toBeTruthy()
    })

    expect(screen.queryAllByRole('button', { name: /edit|delete/i })).toHaveLength(0)
  })

  it('desktop/tablet renders a labeled "Add" button and the subtitle; mobile renders an icon-only button with an accessible name and no subtitle', () => {
    render(PeopleView)

    const desktopButton = screen.getByRole('button', { name: 'Add' })
    expect(desktopButton.className).toContain('md:flex')
    expect(desktopButton.className).toContain('hidden')

    const mobileButton = screen.getByRole('button', { name: 'Add person' })
    expect(mobileButton.className).toContain('md:hidden')
    expect(mobileButton.getAttribute('aria-label')).toBe('Add person')

    const subtitle = screen.getByText('Everyone splitting expenses in this group.')
    expect(subtitle.className).toContain('hidden')
    expect(subtitle.className).toContain('md:block')
  })
})
