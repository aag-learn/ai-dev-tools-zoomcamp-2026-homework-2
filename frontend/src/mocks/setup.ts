import { afterAll, afterEach } from 'vitest'
import { server } from './server'

// Vitest's jsdom environment provides a Request built on Node's undici
// Request, which (unlike a browser's fetch) requires an absolute URL and
// throws on a relative one. The real app calls the API client with a
// relative baseUrl ('/'), relying on the browser to resolve it against the
// current page — so under test, resolve relative request URLs against a
// fixed origin before construction, letting components make real, relative
// API calls that MSW can still intercept.
const OriginalRequest = globalThis.Request
class AbsoluteURLRequest extends OriginalRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === 'string' && input.startsWith('/')) {
      super(new URL(input, 'http://localhost'), init)
    } else {
      super(input, init)
    }
  }
}
globalThis.Request = AbsoluteURLRequest as typeof Request

// Started synchronously (not inside beforeAll) so MSW's fetch interception
// is already patched into globalThis.fetch before any test file's own
// imports run — including the API client (src/api/client.ts), which reads
// globalThis.fetch once, at import time, to build its request function.
server.listen({ onUnhandledRequest: 'error' })
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
