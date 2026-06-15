import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

// WxtVitest wires WXT auto-imports + a fake `browser` (fakeBrowser) into tests,
// so modules importing `wxt/browser` work under Node without real extension APIs.
export default defineConfig({
  // Cast: WXT 0.20 ships rolldown-vite while Vitest bundles its own vite copy,
  // so the plugin's type doesn't line up across the two vite type trees. Runtime is fine.
  plugins: [WxtVitest() as never],
  test: {
    include: ['src/**/*.test.ts', 'entrypoints/**/*.test.ts'],
  },
});
