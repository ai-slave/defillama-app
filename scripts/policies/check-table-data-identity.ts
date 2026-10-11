import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { policyTargetFiles } from '../lib/sourceFiles'

/*
 * Table data identity policy. TanStack rebuilds its row models whenever `data` changes identity, and then
 * resets the page index and the expanded rows. Rows rebuilt on every render therefore send the reader back
 * to page 1, or collapse what they expanded, on any re-render: a click on the pager re-renders the
 * component that owns the table, so the pager cannot leave page 1 at all.
 *
 * Source cannot show this. A component that compiles can still leave one value uncached: the React Compiler
 * drops a memo scope whose values a later call might mutate, and a call that runs after the table hook (a
 * formatter in the JSX, given a field of something derived from the rows) is enough. So this script compiles
 * every file that creates a table, with the options the app runs, and follows the compiled `data` back to
 * where it comes from. It passes:
 *
 * - a parameter or a value destructured from one (props: as stable as the caller keeps them),
 * - a hook result, or a field of one,
 * - a value the compiler assigns inside a memo cache guard, or a module-level value,
 * - an empty array literal, which has no rows to page or expand.
 *
 * Anything else is rebuilt on every render and fails. A table that takes its rows as a prop is checked only
 * at the table; the caller's value is not followed across components.
 *
 * Tables are `useTable`, `usePaginatedTable` and `useSearchTable` calls, and `<SearchTableProvider
 * options={{ data }}>`, whose options reach `useSearchTable` through props.
 */

const root = path.resolve(import.meta.dirname, '../..')
const sourceRoot = path.join(root, 'src')
const { reactCompilerBabel, insideCacheGuard } = createRequire(import.meta.url)('../reactCompilerBabel.cjs')
const { babel, syntaxPlugins, plugins } = reactCompilerBabel(root)

const TABLE_HOOKS = new Set(['useTable', 'usePaginatedTable', 'useSearchTable'])
const TABLE_SOURCE = /\b(?:useTable|usePaginatedTable|useSearchTable)\(|<SearchTableProvider\b/

const isHookName = (name: string) => /^use[A-Z]/.test(name)

/** Null when `expression` keeps its identity across renders, otherwise what rebuilds it. */
function freshSource(expression: any, seen: Set<unknown>): string | null {
	const node = expression.node
	if (
		node.type === 'TSAsExpression' ||
		node.type === 'TSNonNullExpression' ||
		node.type === 'TSSatisfiesExpression' ||
		node.type === 'ParenthesizedExpression'
	) {
		return freshSource(expression.get('expression'), seen)
	}
	if (node.type === 'ArrayExpression' && node.elements.length === 0) return null
	if (node.type === 'MemberExpression') return freshSource(expression.get('object'), seen)
	if (node.type === 'LogicalExpression') {
		return freshSource(expression.get('left'), seen) ?? freshSource(expression.get('right'), seen)
	}
	if (node.type === 'ConditionalExpression') {
		return freshSource(expression.get('consequent'), seen) ?? freshSource(expression.get('alternate'), seen)
	}
	if (node.type === 'CallExpression') return isHookCall(expression) ? null : `a call to ${calleeName(expression)}`
	if (node.type !== 'Identifier') return `a new ${node.type}`

	const binding = expression.scope.getBinding(node.name)
	// No binding is a global such as `undefined`; params are props; imports and top-level values never change.
	if (!binding || binding.kind === 'param' || binding.kind === 'module' || binding.scope.path.isProgram()) return null
	if (seen.has(binding)) return null
	seen.add(binding)
	const declarator = binding.path
	if (!declarator.isVariableDeclarator()) return `\`${node.name}\``
	if (declarator.node.id.type !== 'Identifier') return freshSource(declarator.get('init'), seen)
	const writes = binding.constantViolations
		.filter((write: any) => write.isAssignmentExpression())
		.map((write: any) => write.get('right'))
	if (declarator.node.init) writes.push(declarator.get('init'))
	for (const write of writes) {
		// The compiler reads a cached value back as `$[n]` and writes a fresh one only inside its guard.
		const readsCache =
			write.isMemberExpression() && write.node.object.type === 'Identifier' && write.node.object.name === '$'
		if (readsCache || insideCacheGuard(write)) continue
		if (freshSource(write, seen)) return `\`${node.name}\``
	}
	return null
}

/** `useX()`, `React.useX()`, or a hook the compiler calls through a temporary (`t9 = useX; t9()`). */
function isHookCall(call: any): boolean {
	const callee = call.node.callee
	if (callee.type === 'MemberExpression')
		return callee.property.type === 'Identifier' && isHookName(callee.property.name)
	if (callee.type !== 'Identifier') return false
	if (isHookName(callee.name)) return true
	const binding = call.scope.getBinding(callee.name)
	return (
		binding != null &&
		binding.constantViolations.some(
			(write: any) =>
				write.isAssignmentExpression() && write.node.right.type === 'Identifier' && isHookName(write.node.right.name)
		)
	)
}

function calleeName(call: any): string {
	const callee = call.node.callee
	if (callee.type === 'Identifier') return `\`${callee.name}\``
	if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier')
		return `\`.${callee.property.name}()\``
	return 'a function'
}

/** The object literal an options argument holds, following the temporaries the compiler hoists it into. */
function optionsObject(expression: any): any {
	if (expression?.isObjectExpression()) return expression
	if (!expression?.isIdentifier()) return null
	const binding = expression.scope.getBinding(expression.node.name)
	if (!binding?.path.isVariableDeclarator()) return null
	const writes = binding.constantViolations.filter((write: any) => write.isAssignmentExpression())
	const candidates = [
		...(binding.path.node.init ? [binding.path.get('init')] : []),
		...writes.map((write: any) => write.get('right'))
	]
	return candidates.find((candidate: any) => candidate.isObjectExpression()) ?? null
}

function dataProperty(options: any): any {
	return options
		?.get('properties')
		.find((property: any) => property.isObjectProperty() && property.node.key.name === 'data')
		?.get('value')
}

export function scanSource(relative: string, source: string): Array<string> {
	if (relative.includes('/__tests__/') || !TABLE_SOURCE.test(source)) return []
	const output = babel.transformSync(source, {
		filename: path.join(root, relative),
		babelrc: false,
		configFile: false,
		retainLines: true,
		plugins: plugins()
	})
	const violations: Array<string> = []
	const check = (data: any, line: number, table: string) => {
		if (!data) return
		const fresh = freshSource(data, new Set())
		if (!fresh) return
		violations.push(
			`${relative}:${line} gives ${table} rows from ${fresh}, which is rebuilt on every render, so any re-render sends the table back to page 1 and collapses expanded rows. Build the rows in a memo hook that takes its inputs as parameters (useIndustryRows in src/containers/Equities/IndustriesPage.tsx); see src/components/Table/README.md`
		)
	}
	babel.transformSync(output.code, {
		filename: path.join(root, `${relative}.compiled.tsx`),
		babelrc: false,
		configFile: false,
		plugins: [
			...syntaxPlugins,
			() => ({
				visitor: {
					CallExpression(call: any) {
						const callee = call.node.callee
						if (callee.type !== 'Identifier' || !TABLE_HOOKS.has(callee.name)) return
						check(dataProperty(optionsObject(call.get('arguments.0'))), call.node.loc.start.line, callee.name)
					},
					JSXOpeningElement(element: any) {
						if (element.node.name.name !== 'SearchTableProvider') return
						const attribute = element
							.get('attributes')
							.find((candidate: any) => candidate.isJSXAttribute() && candidate.node.name.name === 'options')
						const options = optionsObject(attribute?.get('value.expression'))
						check(dataProperty(options), element.node.loc.start.line, 'SearchTableProvider')
					}
				}
			})
		]
	})
	return violations
}

if (process.argv.includes('--self-test')) {
	const header = "import { useTable, useMemo } from '@tanstack/react-table'\n"
	const cases: Array<{ name: string; source: string; violation: boolean }> = [
		{
			name: 'rows the compiler leaves uncached',
			source: `${header}export function Page({ items }) {
	const rows = items.filter((item) => item.on)
	const summary = summarize(rows)
	const table = useTable({ data: rows, columns })
	return <View table={table} label={format(summary.total)} />
}`,
			violation: true
		},
		{
			name: 'rows in a component that opts out of the compiler',
			source: `${header}export function Page({ items }) {
	'use no memo'
	const rows = items.filter((item) => item.on)
	const table = useTable({ data: rows, columns })
	return <View table={table} />
}`,
			violation: true
		},
		{
			name: 'rows the compiler caches',
			source: `${header}export function Page({ items }) {
	const rows = items.filter((item) => item.on)
	const table = useTable({ data: rows, columns })
	return <View table={table} />
}`,
			violation: false
		},
		{
			name: 'rows from props with an empty fallback',
			source: `${header}export function Page({ rows }) {
	const table = useTable({ data: rows ?? [], columns })
	return <View table={table} />
}`,
			violation: false
		},
		{
			name: 'rows from a memo hook',
			source: `${header}function useRows(items) {
	return useMemo(() => items.filter((item) => item.on), [items])
}
export function Page({ items }) {
	const rows = useRows(items)
	const summary = summarize(rows)
	const table = useTable({ data: rows, columns })
	return <View table={table} label={format(summary.total)} />
}`,
			violation: false
		},
		{
			name: 'top-level rows',
			source: `${header}const rows = items.map((item) => ({ ...item }))
export function Page() {
	return <SearchTableProvider options={{ data: rows, columns }}><View /></SearchTableProvider>
}`,
			violation: false
		},
		{
			name: 'search table options with uncached rows',
			source: `${header}export function Page({ items }) {
	const rows = items.filter((item) => item.on)
	const summary = summarize(rows)
	const [open, setOpen] = useState(false)
	return <SearchTableProvider options={{ data: rows, columns }}><View label={format(summary.total)} /></SearchTableProvider>
}`,
			violation: true
		}
	]
	const failures = cases.filter(
		({ name, source, violation }) =>
			scanSource(`src/policy-self-test/${name.replace(/\W+/g, '-')}.tsx`, source).length > 0 !== violation
	)
	if (failures.length > 0) {
		console.error(`Table data identity policy self-test failed: ${failures.map(({ name }) => name).join(', ')}`)
		process.exit(1)
	}
	console.log(`Table data identity policy self-test passed (${cases.length} cases).`)
	process.exit(0)
}

const violations = policyTargetFiles(root, sourceRoot).flatMap((file) => {
	const relative = path.relative(root, file).split(path.sep).join('/')
	return scanSource(relative, fs.readFileSync(file, 'utf8'))
})

if (violations.length > 0) {
	console.error(`Table data identity policy violations:\n${violations.map((violation) => `- ${violation}`).join('\n')}`)
	process.exit(1)
}

console.log('Table data identity policy passed.')
