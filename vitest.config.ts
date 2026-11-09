import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/beemo/',
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'], restoreMocks: true },
});
