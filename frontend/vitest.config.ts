import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      environmentOptions: {
        jsdom: {
          // A real origin so relative-URL requests (e.g. the API client's
          // baseUrl: '/') resolve instead of erroring against jsdom's
          // default `about:blank` document.
          url: 'http://localhost/',
        },
      },
      globals: true,
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      setupFiles: ['./src/mocks/setup.ts'],
    },
  }),
)
