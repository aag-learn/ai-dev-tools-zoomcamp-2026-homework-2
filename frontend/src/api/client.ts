import createClient from 'openapi-fetch'
import type { paths } from './schema.d.ts'

// Same-origin relative baseUrl. `window.location.origin` is used instead of
// a bare '/' because Node's native fetch/Request (used in Vitest/JSDOM,
// unlike a real browser) requires an absolute URL and doesn't resolve
// relative ones against the page location — this has no effect on real
// browser behavior, where both resolve to the same origin.
const client = createClient<paths>({
  baseUrl: typeof window !== 'undefined' ? window.location.origin : '/',
})

export default client
