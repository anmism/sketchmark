import { defineConfig } from 'vite';

export default defineConfig({
  // rough.js accesses `window` — make sure it's not pre-bundled oddly
  optimizeDeps: {
    include: ['roughjs'],
  },
});
