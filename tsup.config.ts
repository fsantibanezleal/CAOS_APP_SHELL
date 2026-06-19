import { defineConfig } from 'tsup';

// Build the React component library to ESM + d.ts. CSS ships as a separate static file
// (styles.css, exported directly) so consumers import it once: `@fasl/caos-app-shell/styles.css`.
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: false,
  treeshake: true,
  external: ['react', 'react-dom', 'react/jsx-runtime', 'react-router-dom', 'lucide-react', 'katex', 'zustand'],
});
