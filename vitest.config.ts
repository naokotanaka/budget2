import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', '.svelte-kit', 'build']
  },
  resolve: {
    alias: {
      $lib: join(__dirname, 'src/lib'),
      $app: join(__dirname, 'src/app')
    }
  }
});