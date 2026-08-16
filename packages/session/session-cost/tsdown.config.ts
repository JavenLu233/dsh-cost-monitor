/**
 * tsdown config for @javenlu233/dsh-session-cost (host half only). Bundles the
 * host plugin and its invariant companion straight from src/; cordis,
 * schemastery, zod, and the dsh session/llm/session-projection packages stay
 * external — they are resolved by the real `dsh` host at runtime.
 */
import { defineConfig } from 'tsdown'

const ID = '@javenlu233/dsh-session-cost'

export default defineConfig({
  name: ID,
  entry: ['src/index.ts', 'src/invariant.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  external: [
    '@deepseek-ai/cordis',
    '@deepseek-ai/schemastery',
    'zod',
    '@deepseek-ai/dsh-llm',
    '@deepseek-ai/dsh-session',
    '@deepseek-ai/dsh-session-projection',
    '@deepseek-ai/dsh-invariants',
  ],
})
