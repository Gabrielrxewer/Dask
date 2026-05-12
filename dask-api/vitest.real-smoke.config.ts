import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  envDir: false,
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.smoke.ts'],
    setupFiles: ['tests/setup-env.ts']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
});
