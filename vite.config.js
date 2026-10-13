import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works under GitHub Pages' /chaos-brawl/ subpath.
  base: './',
  test: {
    include: ['tests/**/*.test.js'],
    testTimeout: 60000,
  },
});
