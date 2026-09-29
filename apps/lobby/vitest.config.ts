import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'lobby',
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
