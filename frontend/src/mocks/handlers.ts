import type { HttpHandler } from 'msw'

// Real handlers land with whichever feature issue first needs one, written
// against the types generated from openapi/openapi.yaml (see src/api/schema.d.ts).
export const handlers: HttpHandler[] = []
