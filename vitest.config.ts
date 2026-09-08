import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'

const { reactCompilerBabel } = createRequire(import.meta.url)('./scripts/reactCompilerBabel.cjs')

/**
 * Transform application source with React Compiler, as Next does for the app.
 *
 * Vitest otherwise transforms source directly, so a component is only ever tested as its uncompiled
 * self. Compiling changes what gets memoized, and a memo can hold state that a render used to
 * rebuild: heading ids in the chat renderer renumbered themselves mid-stream once the component
 * started compiling, with the suite green. The options come from the same module the compiler
 * baseline check uses, so this cannot pass against settings the app never runs.
 */
function reactCompilerUnderTest() {
	const { babel, plugins } = reactCompilerBabel()
	const compilerPlugins = plugins()
	// Application source, hooks included. Not tests, which are what does the checking, and not
	// declarations, which have no runtime.
	const appSource = /\/src\/.*(?<!\.test)(?<!\.d)\.tsx?$/
	return {
		name: 'react-compiler-under-test',
		enforce: 'pre' as const,
		transform(code: string, id: string) {
			if (!appSource.test(id)) return null
			const output = babel.transformSync(code, {
				filename: id,
				babelrc: false,
				configFile: false,
				plugins: compilerPlugins
			})
			return output?.code == null ? null : { code: output.code, map: null }
		}
	}
}

/**
 * Behaviour that breaks only once its component compiles, so it runs a second time against compiler
 * output.
 *
 * Listed rather than globbed, because compiling narrows what a test may do: the compiler runtime
 * reads `useMemoCache`, which only exists inside a render, so a test that calls a component or hook
 * as a plain function throws here even though the app never calls it that way. A dozen existing
 * tests do exactly that. Add a file when it mounts through a real renderer and asserts behaviour
 * that memoization can change.
 */
const COMPILER_SENSITIVE_TESTS = [
	'src/containers/ProDashboard/components/SqlChart/__tests__/SqlChartLifetime.test.tsx',
	'src/components/DashboardSaveGuard.test.tsx',
	'src/containers/ProDashboard/dashboardAutosave.test.tsx',
	'src/containers/ProDashboard/hooks/__tests__/useAutoSave.test.tsx',
	'src/containers/LlamaAI/components/markdown/headingIds.test.tsx',
	'src/containers/LlamaAI/__tests__/duelVariant.test.ts'
]

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
		exclude: [...configDefaults.exclude, '**/.codex/**', '**/.claude/**'],
		setupFiles: ['./vitest.setup.ts'],
		projects: [
			{ extends: true, test: { name: 'unit', include: ['**/*.test.ts', '**/*.test.tsx'] } },
			{
				extends: true,
				plugins: [reactCompilerUnderTest()],
				test: { name: 'compiled', include: COMPILER_SENSITIVE_TESTS }
			}
		]
	}
})
