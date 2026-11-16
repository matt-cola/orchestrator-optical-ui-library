import { defineConfig } from 'tsup';

export default defineConfig((opts) => ({
  entry: ['src/index.ts'],
  format: ['esm'],
  // Splitting keeps the Leaflet code in its own chunk: it is loaded with a
  // client-only dynamic import because Leaflet needs `window`.
  splitting: true,
  sourcemap: true,
  clean: !opts.watch,
  dts: true,
  outDir: 'dist',
  target: 'es2020',
  skipNodeModulesBundle: true,
}));
