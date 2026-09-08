import { resolve } from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
	css: {
		// Next accepts string PostCSS plugins; Vite expects plugin objects.
		// Unit tests only need CSS Module exports, not Tailwind processing.
		postcss: { plugins: [] }
	},
	resolve: {
		alias: {
			'server-only': resolve(__dirname, 'node_modules/server-only/empty.js'),
			'~/public': resolve(__dirname, 'public'),
			'~': resolve(__dirname, 'src')
		}
	},
	test: {
		environment: 'node',
		// Vitest's 5s default leaves the suite's slowest test (~2.2s uncontended)
		// only 2.2x of headroom. Starving workers stretch a file by up to ~7x, so a
		// correct test crosses the default and is reported as a failure. This ceiling
		// only changes how long a genuinely stuck test takes to give up.
		testTimeout: 30_000,
		hookTimeout: 30_000,
		exclude: [...configDefaults.exclude, '**/.codex/**'],
		include: ['**/*.test.ts', '**/*.test.tsx'],
		setupFiles: ['./vitest.setup.ts']
	}
})
