import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const fixtureRoot = fileURLToPath(new URL('.', import.meta.url));
const guiRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  root: fixtureRoot,
  base: './',
  publicDir: false,
  plugins: [react()],
  clearScreen: false,
  envPrefix: [],
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    target: ['es2021', 'chrome100'],
    minify: 'esbuild',
    sourcemap: false,
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: fileURLToPath(new URL('./node_modules/react', `file:///${guiRoot}/`)),
      'react-dom': fileURLToPath(new URL('./node_modules/react-dom', `file:///${guiRoot}/`)),
      'react/jsx-runtime': fileURLToPath(
        new URL('./node_modules/react/jsx-runtime.js', `file:///${guiRoot}/`),
      ),
      'react/jsx-dev-runtime': fileURLToPath(
        new URL('./node_modules/react/jsx-dev-runtime.js', `file:///${guiRoot}/`),
      ),
    },
  },
});
