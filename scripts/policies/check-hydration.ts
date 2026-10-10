import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { policyTargetFiles } from '../lib/sourceFiles'

/*
 * Hydration policy. Most pages are static with a long revalidate, so the HTML a visitor gets was rendered hours
 * ago. Anything the render derives from the live clock or the visitor's zone differs between that HTML and the
 * first client render, React logs a mismatch and rebuilds the subtree. docs/date-formatting.md, "Render clock and
 * hydration", states the rules; this script enforces the mechanical ones:
 *
 * 1. `suppressHydrationWarning` lives only in src/ui/StaleText.tsx, whose children are text.
 * 2. Render code reads the clock through `usePageClockSec` (the period the page data describes) or `useNowSeconds`
 *    (values about now), never `Date.now()`, `new Date()` or `dayjs()` on a render path: a component or hook body,
 *    a callback React runs during render, or a same-file helper a render path calls. Effects, handlers, query
 *    functions and data functions may read the clock.
 * 3. No helper hides a clock its caller did not pass: no `Date.now()` as a parameter default, destructured or not,
 *    and no `param ?? Date.now()` fallback. A helper in another module is not traced, so the caller must hand it
 *    the clock it means, and a render caller then gets it from one of the two hooks.
 * 4. Date arithmetic and field reads use the UTC methods. Local-zone methods are for the few places that
 *    deliberately work in the visitor's zone, listed below with their reason.
 * 5. Render code never reads the query from `router.asPath` (`asPath.split('?')[1]`): the server rendered a static
 *    page without it. `readyAsPath(router)` from src/utils/routerQuery adds the query once the router is ready.
 */

const root = path.resolve(import.meta.dirname, '../..')
const sourceRoot = path.join(root, 'src')

const STALE_TEXT = 'src/ui/StaleText.tsx'

/**
 * Surfaces whose time-dependent content renders after mount, from client queries or behind a sign-in, so their
 * first client render never hydrates onto stale markup. They are outside this policy until that changes.
 */
const CLIENT_SURFACE_PATTERNS = [
	/^src\/containers\/ProDashboard\//,
	/^src\/containers\/LlamaAI\//,
	/^src\/containers\/Investors\//,
	/^src\/containers\/Articles\/(?:editor|admin)\//,
	/^src\/containers\/Downloads\//,
	/^src\/containers\/Account\//
]

/** Server-only code: it renders nothing, so its clock reads never reach a hydration boundary. */
const SERVER_ONLY_PATTERNS = [
	/\.server\.tsx?$/,
	/^src\/pages\/api\//,
	/^src\/api\//,
	/^src\/server\//,
	/^src\/utils\/metadata\//,
	/^src\/containers\/NarrativeTracker\/queries\.tsx$/
]

/** Modules that work in the visitor's local zone on purpose. */
const localZoneDateFiles = new Map<string, string>([
	['src/utils/dateFormat.ts', 'the canonical formatter; its local output is for hydration-safe client paths'],
	['src/utils/cookies.ts', 'cookie expiry arithmetic; the zone does not reach the page'],
	['src/utils/maxAgeForNext.ts', 'revalidate jitter from the server clock; the zone does not reach the page']
])

const LOCAL_ZONE_METHODS = new Set([
	'getFullYear',
	'getMonth',
	'getDate',
	'getDay',
	'getHours',
	'getMinutes',
	'getSeconds',
	'setFullYear',
	'setMonth',
	'setDate',
	'setHours',
	'setMinutes',
	'setSeconds'
])

/** Callbacks these hosts run during render, so a clock read inside them is a render-time read. */
const RENDER_CALLBACK_HOSTS = new Set([
	'useMemo',
	'useState',
	'useReducer',
	'useDeferredValue',
	'map',
	'flatMap',
	'filter',
	'reduce',
	'forEach',
	'some',
	'every',
	'find',
	'findLast',
	'sort',
	'toSorted'
])

type FunctionNode = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration

function isFunctionNode(node: ts.Node): node is FunctionNode {
	return (
		ts.isFunctionDeclaration(node) ||
		ts.isFunctionExpression(node) ||
		ts.isArrowFunction(node) ||
		ts.isMethodDeclaration(node)
	)
}

function nearestFunction(node: ts.Node): FunctionNode | undefined {
	let current: ts.Node | undefined = node.parent
	while (current && !isFunctionNode(current)) current = current.parent
	return current && isFunctionNode(current) ? current : undefined
}

function functionName(fn: FunctionNode): string | null {
	if ((ts.isFunctionDeclaration(fn) || ts.isFunctionExpression(fn) || ts.isMethodDeclaration(fn)) && fn.name) {
		return fn.name.getText()
	}
	if (ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name)) return fn.parent.name.text
	return null
}

function isComponentOrHook(fn: FunctionNode, relative: string): boolean {
	const name = functionName(fn)
	if (name) return /^[A-Z]/.test(name) || /^use[A-Z0-9]/.test(name)
	// `export default function () {}` in a page file is the page component.
	return (
		ts.isFunctionDeclaration(fn) &&
		relative.startsWith('src/pages/') &&
		(fn.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) ?? false)
	)
}

function callbackHost(fn: FunctionNode): string | null {
	const parent = fn.parent
	if (!ts.isCallExpression(parent) || !parent.arguments.some((argument) => argument === fn)) return null
	const callee = parent.expression
	if (ts.isPropertyAccessExpression(callee)) return callee.name.text
	if (ts.isIdentifier(callee)) return callee.text
	return null
}

/** True when the node runs while React renders: in a component or hook body, or a callback those run inline. */
function isRenderPath(node: ts.Node, relative: string): boolean {
	let fn = nearestFunction(node)
	while (fn) {
		if (isComponentOrHook(fn, relative)) return true
		const host = callbackHost(fn)
		if (host && RENDER_CALLBACK_HOSTS.has(host)) {
			fn = nearestFunction(fn)
			continue
		}
		// Effects, handlers, query functions, timers and plain helpers run outside the render.
		return false
	}
	return false
}

/** True when the node sits in a parameter's default value: `(now = Date.now())` or `({ now = Date.now() })`. */
function isDefaultParameterValue(node: ts.Node): boolean {
	let current: ts.Node = node
	while (current.parent && !isFunctionNode(current.parent)) {
		const parent = current.parent
		if ((ts.isParameter(parent) || ts.isBindingElement(parent)) && parent.initializer === current) {
			if (ts.isParameter(parent)) return true
			// A destructured default counts when its pattern is a parameter's.
			let pattern: ts.Node = parent.parent
			while (ts.isBindingElement(pattern.parent) || ts.isObjectBindingPattern(pattern.parent)) pattern = pattern.parent
			if (ts.isParameter(pattern.parent)) return true
		}
		current = parent
	}
	return false
}

function isParameterName(name: string, fn: FunctionNode | undefined): boolean {
	for (let current = fn; current; current = nearestFunction(current)) {
		for (const parameter of current.parameters) {
			if (bindingNames(parameter.name).has(name)) return true
		}
	}
	return false
}

function bindingNames(name: ts.BindingName, names = new Set<string>()): Set<string> {
	if (ts.isIdentifier(name)) names.add(name.text)
	else for (const element of name.elements) if (!ts.isOmittedExpression(element)) bindingNames(element.name, names)
	return names
}

const ARITHMETIC_OPERATORS = new Set([
	ts.SyntaxKind.SlashToken,
	ts.SyntaxKind.AsteriskToken,
	ts.SyntaxKind.MinusToken,
	ts.SyntaxKind.PlusToken,
	ts.SyntaxKind.PercentToken
])

/** True for `param ?? Date.now()` and `param.at || Date.now() / 1000`: the clock stands in for an argument left out. */
function isParameterFallback(node: ts.Node, bindings: ReadonlySet<string>): boolean {
	// Climb out of parentheses and arithmetic such as `Date.now() / 1000` to the value the fallback supplies.
	let value: ts.Node = node
	while (
		ts.isParenthesizedExpression(value.parent) ||
		(ts.isBinaryExpression(value.parent) && ARITHMETIC_OPERATORS.has(value.parent.operatorToken.kind))
	) {
		value = value.parent
	}
	const fallback = value.parent
	if (!ts.isBinaryExpression(fallback) || fallback.right !== value) return false
	const operator = fallback.operatorToken.kind
	if (operator !== ts.SyntaxKind.QuestionQuestionToken && operator !== ts.SyntaxKind.BarBarToken) return false
	if (clockReadKind(fallback.left, bindings)) return false
	let base: ts.Expression = fallback.left
	while (
		ts.isPropertyAccessExpression(base) ||
		ts.isElementAccessExpression(base) ||
		ts.isCallExpression(base) ||
		ts.isNonNullExpression(base) ||
		ts.isParenthesizedExpression(base)
	) {
		base = base.expression
	}
	return ts.isIdentifier(base) && isParameterName(base.text, nearestFunction(fallback))
}

function isTestFile(relative: string) {
	return /(?:^|\/)(?:__tests__\/.*|[^/]+\.(?:test|spec)\.[^/]+)$/.test(relative)
}

function isDayjsNow(node: ts.CallExpression, bindings: ReadonlySet<string>): boolean {
	if (node.arguments.length > 0) return false
	const callee = node.expression
	if (ts.isIdentifier(callee)) return bindings.has(callee.text)
	// dayjs.utc() with no argument is also "now".
	return (
		ts.isPropertyAccessExpression(callee) &&
		callee.name.text === 'utc' &&
		ts.isIdentifier(callee.expression) &&
		bindings.has(callee.expression.text)
	)
}

function clockReadKind(node: ts.Node, bindings: ReadonlySet<string>): string | null {
	if (ts.isCallExpression(node)) {
		const text = node.expression.getText()
		if (text === 'Date.now' && node.arguments.length === 0) return 'Date.now()'
		if (isDayjsNow(node, bindings)) return `${node.expression.getText()}()`
		return null
	}
	if (ts.isNewExpression(node) && node.expression.getText() === 'Date' && (node.arguments?.length ?? 0) === 0) {
		return 'new Date()'
	}
	return null
}

/** `x.asPath.split('?')[1]`: the query half of the browser path, which a static page's server render never had. */
function readsAsPathQuery(node: ts.Node): boolean {
	if (!ts.isElementAccessExpression(node) || node.argumentExpression.getText() !== '1') return false
	const call = node.expression
	if (!ts.isCallExpression(call) || !ts.isPropertyAccessExpression(call.expression)) return false
	const split = call.expression
	return (
		split.name.text === 'split' &&
		ts.isPropertyAccessExpression(split.expression) &&
		split.expression.name.text === 'asPath' &&
		call.arguments[0] !== undefined &&
		ts.isStringLiteral(call.arguments[0]) &&
		call.arguments[0].text === '?'
	)
}

export function scanSource(relative: string, file: string, source: string): Array<string> {
	const violations: Array<string> = []
	if (isTestFile(relative)) return violations
	if ([...CLIENT_SURFACE_PATTERNS, ...SERVER_ONLY_PATTERNS].some((pattern) => pattern.test(relative))) return violations
	const sourceFile = ts.createSourceFile(
		file,
		source,
		ts.ScriptTarget.Latest,
		true,
		file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
	)
	const dayjsBindings = new Set<string>()
	const localZoneOwner = localZoneDateFiles.has(relative)
	/** Same-file helpers that read the clock; a render path calling one inherits the read. */
	const clockReadingHelpers = new Set<string>()

	function report(node: ts.Node, message: string) {
		const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
		violations.push(`${relative}:${line + 1} ${message}`)
	}

	function collect(node: ts.Node) {
		if (
			ts.isImportDeclaration(node) &&
			ts.isStringLiteral(node.moduleSpecifier) &&
			node.moduleSpecifier.text === 'dayjs' &&
			node.importClause?.name
		) {
			dayjsBindings.add(node.importClause.name.text)
		}
		const fn = clockReadKind(node, dayjsBindings) ? nearestFunction(node) : undefined
		const name = fn ? functionName(fn) : null
		if (fn && name && !isComponentOrHook(fn, relative) && !isRenderPath(node, relative)) {
			clockReadingHelpers.add(name)
		}
		ts.forEachChild(node, collect)
	}

	function visit(node: ts.Node) {
		if (readsAsPathQuery(node)) {
			report(
				node,
				"reads the query from router.asPath during render; a static page's HTML has none, so the first client render disagrees with it. Read the path through readyAsPath(router) from src/utils/routerQuery"
			)
		}

		if (ts.isJsxAttribute(node) && node.name.getText() === 'suppressHydrationWarning' && relative !== STALE_TEXT) {
			report(
				node,
				'uses suppressHydrationWarning outside StaleText; render the text through StaleText from src/ui/StaleText'
			)
		}

		if (
			!localZoneOwner &&
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			LOCAL_ZONE_METHODS.has(node.expression.name.text)
		) {
			const method = node.expression.name.text
			report(
				node,
				`calls ${method}() in the visitor's zone; use ${method.replace(/^(get|set)/, '$1UTC')}() or a ~/utils/dateFormat formatter`
			)
		}

		const clockRead = clockReadKind(node, dayjsBindings)
		if (clockRead && isRenderPath(node, relative)) {
			report(
				node,
				`reads ${clockRead} while rendering; use usePageClockSec for the data's period or useNowSeconds for now`
			)
		} else if (clockRead && isDefaultParameterValue(node)) {
			report(
				node,
				`reads ${clockRead} as a default parameter; callers in render inherit it, so take the clock as an argument`
			)
		} else if (clockRead && isParameterFallback(node, dayjsBindings)) {
			report(node, `falls back to ${clockRead} when the caller passes no clock; make the clock a required argument`)
		}

		if (
			ts.isCallExpression(node) &&
			ts.isIdentifier(node.expression) &&
			clockReadingHelpers.has(node.expression.text) &&
			isRenderPath(node, relative)
		) {
			report(
				node,
				`calls ${node.expression.text}() while rendering, and it reads the clock; pass it usePageClockSec or useNowSeconds`
			)
		}

		ts.forEachChild(node, visit)
	}

	collect(sourceFile)
	visit(sourceFile)
	return violations
}

const component = (body: string) => `import dayjs from 'dayjs'\nexport function Card() {\n${body}\n}`

if (process.argv.includes('--self-test')) {
	const cases: Array<{ name: string; relative?: string; source: string; violation: boolean }> = [
		{ name: 'flag outside StaleText', source: '<span suppressHydrationWarning>{x}</span>', violation: true },
		{
			name: 'flag inside StaleText',
			relative: STALE_TEXT,
			source: '<span suppressHydrationWarning>{x}</span>',
			violation: false
		},
		{ name: 'Date.now in render', source: component('const now = Date.now(); return <p>{now}</p>'), violation: true },
		{
			name: 'Date.now in useState initializer',
			source: component('const [now] = useState(() => Date.now()); return <p>{now}</p>'),
			violation: true
		},
		{
			name: 'Date.now in useMemo',
			source: component('const now = useMemo(() => Date.now(), []); return <p>{now}</p>'),
			violation: true
		},
		{
			name: 'Date.now in a map callback',
			source: component('return <ul>{items.map((item) => <li>{Date.now() - item}</li>)}</ul>'),
			violation: true
		},
		{
			name: 'Date.now in an effect',
			source: component('useEffect(() => { setNow(Date.now()) }, []); return null'),
			violation: false
		},
		{
			name: 'Date.now in a handler',
			source: component('return <button onClick={() => track(Date.now())} />'),
			violation: false
		},
		{
			name: 'Date.now in a query function',
			source: component('const q = useQuery({ queryFn: () => fetchAt(Date.now()) }); return null'),
			violation: false
		},
		{ name: 'new Date() in render', source: component('return <p>{new Date().toISOString()}</p>'), violation: true },
		{
			name: 'new Date(value) in render',
			source: component('return <p>{new Date(value).toISOString()}</p>'),
			violation: false
		},
		{ name: 'dayjs() in render', source: component('return <p>{dayjs().year()}</p>'), violation: true },
		{ name: 'dayjs(value) in render', source: component('return <p>{dayjs(value).year()}</p>'), violation: false },
		{ name: 'dayjs.utc() in render', source: component('return <p>{dayjs.utc().year()}</p>'), violation: true },
		{
			name: 'hook body',
			relative: 'src/hooks/useStamp.ts',
			source: 'export function useStamp() { return Date.now() }',
			violation: true
		},
		{
			name: 'page default export',
			relative: 'src/pages/thing.tsx',
			source: 'export default function () { return <p>{Date.now()}</p> }',
			violation: true
		},
		{
			name: 'default parameter clock',
			relative: 'src/containers/Thing/metrics.ts',
			source: 'export function metrics(rows, now = Date.now()) { return rows.filter((r) => r < now) }',
			violation: true
		},
		{
			name: 'destructured default parameter clock',
			relative: 'src/containers/Thing/metrics.ts',
			source: 'export function metrics({ rows, now = Date.now() }) { return rows.filter((r) => r < now) }',
			violation: true
		},
		{
			name: 'parameter fallback clock',
			relative: 'src/containers/Thing/metrics.ts',
			source: 'export function metrics(rows, options) { const now = options.now ?? Date.now(); return now }',
			violation: true
		},
		{
			name: 'scaled parameter fallback clock',
			relative: 'src/containers/Thing/metrics.ts',
			source: 'export function metrics(context) { return context.nowSeconds ?? Date.now() / 1000 }',
			violation: true
		},
		{
			name: 'data fallback in a data function',
			relative: 'src/pages/thing.tsx',
			source:
				'export const getServerSideProps = async () => { const at = snapshot?.generatedAt ?? Date.now(); return { props: { at } } }',
			violation: false
		},
		{
			name: 'helper read outside render',
			relative: 'src/containers/Thing/helpers.ts',
			source: 'export const stamp = () => Date.now()',
			violation: false
		},
		{
			name: 'render calls a same-file clock helper',
			source: `const ago = (t) => Date.now() - t\nexport function Card({ t }) { return <p>{ago(t)}</p> }`,
			violation: true
		},
		{
			name: 'render calls a helper that takes the clock',
			source: `const ago = (t, now) => now - t\nexport function Card({ t }) { const now = useNowSeconds(); return <p>{ago(t, now)}</p> }`,
			violation: false
		},
		{ name: 'local month arithmetic', source: 'date.setMonth(date.getMonth() - 1)', violation: true },
		{ name: 'UTC month arithmetic', source: 'date.setUTCMonth(date.getUTCMonth() - 1)', violation: false },
		{
			name: 'query read from asPath',
			source: "export function Panel({ router }) { const q = router.asPath.split('?')[1] ?? ''; return <p>{q}</p> }",
			violation: true
		},
		{
			name: 'path read from asPath',
			source: "export function Panel({ router }) { return <p>{router.asPath.split('?')[0]}</p> }",
			violation: false
		},
		{
			name: 'getStaticProps read',
			source: 'export const getStaticProps = async () => ({ props: { at: Date.now() } })',
			violation: false
		}
	]
	const failures = cases.filter(({ name, relative, source, violation }) => {
		const file = relative ?? `src/policy-self-test/${name.replace(/\W+/g, '-')}.tsx`
		const actual = scanSource(file, path.basename(file), source).length > 0
		return actual !== violation
	})
	if (failures.length > 0) {
		console.error(`Hydration policy self-test failed: ${failures.map(({ name }) => name).join(', ')}`)
		process.exit(1)
	}
	console.log(`Hydration policy self-test passed (${cases.length} cases).`)
	process.exit(0)
}

const violations = policyTargetFiles(root, sourceRoot).flatMap((file) => {
	const relative = path.relative(root, file).split(path.sep).join('/')
	return scanSource(relative, file, fs.readFileSync(file, 'utf8'))
})

if (violations.length > 0) {
	console.error(`Hydration policy violations:\n${violations.map((violation) => `- ${violation}`).join('\n')}`)
	process.exit(1)
}

console.log('Hydration policy passed.')
