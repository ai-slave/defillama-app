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

const SHARED_EXCLUDE = [...configDefaults.exclude, '**/.codex/**', '**/.claude/**']

/**
 * Tests that cannot run against compiler output. Empty, and worth keeping that way: every `.test.tsx`
 * file runs twice, once as written and once compiled, because compiling changes what gets memoized and
 * a memo can hold state that a render used to rebuild. Heading ids in the chat renderer renumbered
 * themselves mid-stream once the component started compiling, with the suite green.
 *
 * Before adding a file here, check which of the two known causes it is, because both are test defects
 * with a fix:
 *
 * - Calling a component or hook as a plain function. The compiler runtime reads `useMemoCache`, which
 *   only exists inside a render, so it throws `Cannot read properties of null`. Mount the component
 *   instead and assert what it renders or what it hands its children.
 * - Mutating a mock in place and re-rendering. A memo keyed on the mock's identity cannot see the new
 *   value, and the app cannot produce that transition either, because react-query replaces a result
 *   object when its state changes. Replace the object instead of writing to its fields.
 */
const COMPILER_INCOMPATIBLE_TESTS: Array<string> = []

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
		exclude: SHARED_EXCLUDE,
		setupFiles: ['./vitest.setup.ts'],
		projects: [
			{ extends: true, test: { name: 'unit', include: ['**/*.test.ts', '**/*.test.tsx'] } },
			{
				extends: true,
				plugins: [reactCompilerUnderTest()],
				// Project-level exclude replaces the inherited one, so it restates SHARED_EXCLUDE. Without
				// it, `.claude/worktrees` copies of the tree would be collected as tests.
				test: {
					name: 'compiled',
					include: ['**/*.test.tsx'],
					exclude: [...SHARED_EXCLUDE, ...COMPILER_INCOMPATIBLE_TESTS]
				}
			}
		]
	}
})
