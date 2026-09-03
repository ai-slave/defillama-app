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
		exclude: [...configDefaults.exclude, '**/.codex/**'],
		include: ['**/*.test.ts', '**/*.test.tsx'],
		setupFiles: ['./vitest.setup.ts']
	}
})
