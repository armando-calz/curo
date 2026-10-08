import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      // buildSecrets.ts is per client and never committed; tests use the demo secrets.
      {
        find: /^\.\/buildSecrets$/,
        replacement: fileURLToPath(new URL('./src/main/license/buildSecrets.demo.ts', import.meta.url)),
      },
    ],
  },
  css: { postcss: {} }, // no CSS in these tests; skip loading the Tailwind PostCSS config
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
})
