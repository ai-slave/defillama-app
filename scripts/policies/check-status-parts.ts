import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { collectSourceFiles, policyTargetFiles } from '../lib/sourceFiles'

/*
 * Status parts policy. Loading, error and not-found states render through the parts in src/ui/Status.tsx,
 * src/ui/ChartPanel.tsx and src/ui/NoResults.tsx, so each one looks, announces and retries the same way on every page
 * (src/ui/Status.tsx header, docs/focus-and-errors.md). App code outside src/ui that hand-builds one of these shapes
 * is refused:
 *
 * 1. loading-text: an element whose text children read "Loading…", "Fetching…", "Searching…" or "Waiting…" (ending
 *    in …, ... or &hellip;, with `{expr}` pieces allowed between), or a string literal rendered as its child. Use
 *    LoadingIndicator, ListLoading, ChartPanelBodyLoading, PanelLoadingStatus or SurfaceBodyLoadingStatus
 *    (ChartPanelBodyFallback is only the box). Text under `sr-only`, a busy button's label (BUTTON_LIKE) and attribute
 *    values (pendingLabel, aria-label, label) are not checked.
 * 2. loading-dots: `<LoadingDots>`. Use LoadingIndicator; a busy button label (inside BUTTON_LIKE) may keep the dots.
 * 3. lone-spinner: a `justify-center` element whose only child is a LoadingSpinner, or a `flex-col items-center`
 *    element holding a LoadingSpinner and one line of text. Use the loading parts; LoadingSpinner is for busy buttons
 *    and inline controls.
 * 4. error-box: a whole `className` string, or a named class constant, with `bg-error-faint` or `bg-error-tint` and a
 *    `border-error*` class. Use InlineStatus or PanelStatus, which draw the error box. A ternary branch or a tone map
 *    entry is one tone of a chip, toggle or pill, not a message box, and is not checked.
 * 5. alert-line: an element with `role="alert"` (or `role={'alert'}`) and `text-error` and no `id` (a field's error
 *    carries the id its field's aria-describedby names). Use ErrorLine or InlineStatus.
 * 6. retry-gating: a ternary, `&&` or `if` that renders a retry (`refetch` or a `retry=` prop) when a query's
 *    `isError`, `isLoadingError` or `error` is set. A retry clears those, so the error and its focused Try again
 *    vanish while it runs. Gate the error on `queryReadFailed(query)` and check it before loading; PanelStatus,
 *    ChartPanelBodyError and InlineStatus take the query as `retry`. Also refused: a chain that tests the same query's
 *    `isLoading` or `isPending` before that error branch, unless the loading test excludes `queryReadFailed(query)`
 *    (docs/focus-and-errors.md → Errors and retries).
 *    "Query" means the result of useQuery, useInfiniteQuery, useSuspenseQuery, useSuspenseInfiniteQuery or a `use*`
 *    hook that returns one, or returns an object holding one (`{ query, isLoading }`; found across src), held in a
 *    variable or destructured. Such an object's `query` property is the query, and its other fields count as the
 *    query's. useMutation results are outside this rule.
 * 7. next-error: next/error's `<Error statusCode=…>` under src/pages. Render EmptyState size="lg" for a not found.
 * 8. error-copy: "Failed to …", "could not be …ed", "Something went wrong", "Oops", "Error: " or "Please" in client
 *    copy, outside console calls (docs/focus-and-errors.md, "Error copy").
 * 9. raw-error-message: `x instanceof Error ? x.message : …` or a `getErrorMessage(…)` call outside console calls in
 *    client code. Both show any error's own message, so a browser "Failed to fetch" or a status text reaches the
 *    screen. Use `httpErrorMessage(error, "Couldn't …")`, which keeps an API's 4xx reason, or narrow to the typed
 *    error whose message is written for readers. A `.message` read from an inferred `Error` (a mutation's error) has
 *    no shape to refuse here; the doc's rule covers it.
 * 10. blank-fallback: a Suspense `fallback` or a `dynamic()` `loading` that renders a ChartPanelBodyFallback or a div
 *    with no children. A fallback is a loading state: render the part for its surface with a label naming what loads
 *    (ChartPanelBodyLoading, ChartPanelExportShellLoading, SurfaceBodyLoadingStatus, PanelLoadingStatus, or
 *    ProCardLoading on a Pro dashboard card), with the reserved height on its className or style.
 * 11. hand-built-chart-loading: a ChartPanelBodyFallback whose only child is a LoadingIndicator. That is
 *    ChartPanelBodyLoading, which also announces it.
 *
 * EXCEPTIONS names files where a rule's shape is deliberate, each with its reason. An exception that no longer
 * matches fails, so the list never outlives the code it excuses.
 */

const root = path.resolve(import.meta.dirname, '../..')
const sourceRoot = path.join(root, 'src')

type RuleId =
	| 'loading-text'
	| 'loading-dots'
	| 'lone-spinner'
	| 'blank-fallback'
	| 'hand-built-chart-loading'
	| 'error-box'
	| 'alert-line'
	| 'retry-gating'
	| 'hand-placed-retry'
	| 'error-copy'
	| 'raw-error-message'
	| 'next-error'

const MESSAGES: Record<RuleId, string> = {
	'loading-text':
		'renders loading text by hand; use LoadingIndicator, ListLoading, ChartPanelBodyLoading, PanelLoadingStatus or SurfaceBodyLoadingStatus',
	'loading-dots': 'renders LoadingDots outside a busy button; use LoadingIndicator',
	'lone-spinner':
		'draws a region loading state from a lone LoadingSpinner; use PanelLoadingStatus, SurfaceBodyLoadingStatus, ListLoading, ChartPanelBodyLoading or LoadingIndicator',
	'blank-fallback':
		'renders a blank box as a Suspense or dynamic() fallback; render the loading part for its surface with a label (ChartPanelBodyLoading, ChartPanelExportShellLoading, SurfaceBodyLoadingStatus, PanelLoadingStatus, ProCardLoading)',
	'hand-built-chart-loading': 'wraps a LoadingIndicator in ChartPanelBodyFallback; use ChartPanelBodyLoading',
	'error-box': 'hand-builds an error box; use InlineStatus or PanelStatus',
	'alert-line': 'hand-builds an alert line; use ErrorLine or InlineStatus',
	'retry-gating':
		'gates a retry on a query error that clears when the retry runs; gate it on queryReadFailed(query) and check it before loading (docs/focus-and-errors.md)',
	'hand-placed-retry':
		"places a read's Try again by hand inside a status; pass the query as `retry` and the part draws it (RetryButton)",
	'error-copy':
		'writes "Failed to", "could not be …ed", "Something went wrong", "Oops", "Error:" or "Please"; say "Couldn\'t <do what>." (docs/focus-and-errors.md, "Error copy")',
	'raw-error-message':
		'shows any error\'s own message ("Failed to fetch", a status text); use httpErrorMessage(error, "Couldn\'t …") or narrow to a typed error written for readers (docs/focus-and-errors.md, "Error copy")',
	'next-error': 'renders next/error\'s Error page; render EmptyState size="lg" for a not found'
}

const EXCEPTIONS: Record<RuleId, Record<string, string>> = {
	'loading-text': {
		'src/components/Select/VirtualizedSelect.tsx':
			"the select trigger's value reads Loading… while its options load, beside the trigger's busy arrow",
		'src/containers/Token/TokenDeferredPaginationControls.tsx':
			'the busy line beside the pager, the docs/focus-and-errors.md example',
		'src/containers/LlamaAI/components/IntegrationRow.tsx':
			'an instruction to finish the link in Telegram, followed by what to do if it did not open',
		'src/containers/Articles/landing/ResearchSearch.tsx':
			"the result count's own label slot, which reads Loading… until the count arrives",
		'src/containers/Articles/editor/EntitySuggestionList.tsx':
			"the result count's own label slot, which reads Searching… until the count arrives"
	},
	'loading-dots': {
		'src/containers/ProDashboard/components/ProDashboardLoader.tsx':
			"the Pro route loader's branded llama, the one accepted branded full-page loader"
	},
	'lone-spinner': {
		'src/containers/LlamaAI/components/sidebar/AgenticSessionItem.tsx':
			"a sidebar row's busy veil while its chat restores, too small for a labelled status"
	},
	'blank-fallback': {
		'src/components/Nav/Desktop/PinnedPages.tsx':
			'the reorder list opens on a click and its chunk lands within a frame; a loading line in the nav would only flash',
		'src/components/Nav/Mobile/Menu.tsx':
			'the reorder list opens on a tap and its chunk lands within a frame; a loading line in the menu would only flash',
		'src/containers/ProDashboard/components/MetricCard.tsx':
			'the sparkline under a metric that is already on screen; a loading line there reads as the metric still loading'
	},
	'hand-built-chart-loading': {},
	'error-box': {
		'src/containers/Downloads/sql/ErrorBanner.tsx': 'a SQL run error with its jump-to-line, error-coloured on purpose',
		'src/containers/Yields/poolDetail/PoolDetailView.tsx': "the exploit warning banner on a hacked pool's page"
	},
	'alert-line': {
		'src/containers/ProDashboard/ui/InlineTextField.tsx':
			"an inline field's save error under the text it failed to save"
	},
	'retry-gating': {},
	'hand-placed-retry': {
		'src/containers/Articles/editor/LlamaAIChartPicker.tsx':
			'a retry that succeeds moves focus to the search field that stays, not to the dialog'
	},
	'error-copy': {
		'src/pages/privacy-policy.tsx': 'legal prose, not an error message',
		'src/pages/report-error.tsx': 'help prose asking readers to report data issues',
		'src/pages/chatgptplugin.tsx': 'help prose pointing to the feedback form',
		'src/pages/subscription/fulfillment-policies.tsx': 'refund policy prose',
		'src/pages/_app.tsx': "matches the browser's own chunk-load error message",
		'src/containers/Yields/domain/exitPresentation.ts':
			"a vault's exit status from its last check, not a failed request",
		'src/containers/Yields/VaultRisk/components/FreshnessFooter.tsx':
			'a freshness line counting readings the last run could not refresh'
	},
	'raw-error-message': {
		'src/utils/optionalPageData.ts': "a failed optional page read's log line, never shown",
		'src/containers/Downloads/sql/executor.ts':
			"DuckDB's error names the mistake in the reader's own SQL, and one read only matches it to retry",
		'src/containers/ProtocolRankings/formula.service.ts':
			"the formula parser's error names the mistake in the formula the reader typed",
		'src/containers/LlamaAI/api/transport.ts': "a JSON parse failure's detail kept in the error body for logs",
		'src/containers/RWA/queries.tsx': 'page-build loaders; the message goes to the build log',
		'src/containers/Yields/VaultRisk/loader.ts': "a page-build loader's log line"
	},
	'next-error': {}
}

// Parts whose failure is always a read and which take `retry`; InlineStatus also holds action errors, so only a Try
// again that refetches counts there.
const READ_STATUS_PARTS = new Set(['PanelStatus', 'SurfaceBodyStatus', 'ChartPanelBodyError'])
// Case-sensitive "Failed to": a lowercase 'failed to fetch' is a browser error being matched, not copy.
const ERROR_COPY =
	/^\s*Failed to\b|\b[Pp]lease\b|\bcould not be \w+ed\b|\b[Ss]omething went wrong\b|\bOops\b|^\s*Error: /
const CONSOLE_CALL = /^console\.\w+$/

const COMPARISON = new Set([
	ts.SyntaxKind.EqualsEqualsEqualsToken,
	ts.SyntaxKind.ExclamationEqualsEqualsToken,
	ts.SyntaxKind.EqualsEqualsToken,
	ts.SyntaxKind.ExclamationEqualsToken
])

const MATCHING_METHODS = new Set(['includes', 'startsWith', 'endsWith', 'match', 'indexOf', 'search'])

// Matching the text (`.message.includes(…)`, `=== 'code'`, `/re/.test(…)`) reads it without showing it;
// `.message.trim()` still shows it.
function matchesMessage(message: ts.Node): boolean {
	return (
		(ts.isPropertyAccessExpression(message.parent) && MATCHING_METHODS.has(message.parent.name.text)) ||
		(ts.isBinaryExpression(message.parent) && COMPARISON.has(message.parent.operatorToken.kind)) ||
		(ts.isCallExpression(message.parent) && message.parent.expression.getText().endsWith('.test'))
	)
}

// `x instanceof Error ? …x.message… : …`, also inside an `&&` chain (`a && x instanceof Error ? x.message : …`).
function showsAnyErrorMessage(node: ts.ConditionalExpression): boolean {
	const subjects: Array<string> = []
	const collect = (condition: ts.Expression) => {
		const test = unwrap(condition)
		if (ts.isBinaryExpression(test) && test.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
			collect(test.left)
			collect(test.right)
		} else if (
			ts.isBinaryExpression(test) &&
			test.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword &&
			test.right.getText() === 'Error'
		) {
			subjects.push(test.left.getText())
		}
	}
	collect(node.condition)
	if (subjects.length === 0) return false
	const showsMessage = (child: ts.Node): boolean =>
		(ts.isPropertyAccessExpression(child) &&
			child.name.text === 'message' &&
			subjects.includes(child.expression.getText().replace(/[?!]/g, '')) &&
			!matchesMessage(child)) ||
		ts.forEachChild(child, showsMessage) === true
	return showsMessage(node.whenTrue)
}

// Server routes, server loaders and build-time helpers write for logs and API consumers, not readers.
function isServerSource(relative: string): boolean {
	return (
		relative.includes('/server/') ||
		relative.startsWith('src/pages/api/') ||
		relative.startsWith('src/utils/metadata/') ||
		/\.server\.tsx?$/.test(relative)
	)
}

function inConsoleCall(node: ts.Node): boolean {
	for (let parent = node.parent; parent && !ts.isSourceFile(parent); parent = parent.parent) {
		if (ts.isCallExpression(parent) && CONSOLE_CALL.test(parent.expression.getText())) return true
	}
	return false
}

const BUTTON_LIKE = new Set(['button', 'Button', 'ProButton', 'Ariakit.Button', 'option'])
const LOADING_TEXT = /^(?:Loading|Fetching|Searching|Waiting)\b[\s\S]*(?:…|\.\.\.)$/
const QUERY_HOOKS = new Set(['useQuery', 'useInfiniteQuery', 'useSuspenseQuery', 'useSuspenseInfiniteQuery'])
const ERROR_FIELDS = new Set(['isError', 'isLoadingError', 'error'])
const LOADING_FIELDS = new Set(['isLoading', 'isPending'])

type Violation = { rule: RuleId; file: string; line: number }

function tagName(node: ts.JsxOpeningLikeElement): string {
	return node.tagName.getText()
}

function attribute(node: ts.JsxOpeningLikeElement, name: string): ts.JsxAttribute | undefined {
	for (const property of node.attributes.properties) {
		if (ts.isJsxAttribute(property) && property.name.getText() === name) return property
	}
	return undefined
}

/** The text of `name="x"`, `name={'x'}` or `name={`x`}`. */
function attributeText(jsxAttribute: ts.JsxAttribute): string | undefined {
	const initializer = jsxAttribute.initializer
	if (!initializer) return undefined
	if (ts.isStringLiteral(initializer)) return initializer.text
	return ts.isJsxExpression(initializer) && initializer.expression
		? literalText(unwrap(initializer.expression))
		: undefined
}

/** A Try again button the status parts would draw: no focus handling of its own beyond focusRegionOnLeave. With
    `refetchOnly`, only one whose click reruns a query. */
function handPlacedRetry(node: ts.Node, refetchOnly: boolean): ts.Node | null {
	if (ts.isJsxElement(node) && ['Button', 'button'].includes(tagName(node.openingElement))) {
		const opening = node.openingElement
		const label = node.children.map((child) => (ts.isJsxText(child) ? child.text : '')).join('')
		const ref = attribute(opening, 'ref')
		const onClick = attribute(opening, 'onClick')
		if (
			label.trim() === 'Try again' &&
			(!ref || ref.initializer?.getText() === '{focusRegionOnLeave}') &&
			(!refetchOnly || (!!onClick && /\brefetch\w*\(/.test(onClick.getText())))
		) {
			return opening
		}
	}
	let found: ts.Node | null = null
	ts.forEachChild(node, (child) => {
		found ??= handPlacedRetry(child, refetchOnly)
	})
	return found
}

function openingOf(node: ts.Node): ts.JsxOpeningLikeElement | null {
	return ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null
}

function literalText(node: ts.Node): string | undefined {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
	if (ts.isTemplateExpression(node)) {
		return node.head.text + node.templateSpans.map((span) => `{}${span.literal.text}`).join('')
	}
	return undefined
}

function isLoadingText(text: string): boolean {
	return LOADING_TEXT.test(
		text
			.replace(/&hellip;|&#8230;|&#x2026;/g, '…')
			.replace(/\s+/g, ' ')
			.trim()
	)
}

function unwrap(node: ts.Expression): ts.Expression {
	return ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node
}

/** The literal leaves of `a ? 'x' : 'y'`, `a && 'x'` and `a ?? 'x'`: each one renders as the element's text. */
function conditionalLeaves(node: ts.Expression, into: Array<string>) {
	const expression = unwrap(node)
	const text = literalText(expression)
	if (text !== undefined) into.push(text)
	else if (ts.isConditionalExpression(expression)) {
		conditionalLeaves(expression.whenTrue, into)
		conditionalLeaves(expression.whenFalse, into)
	} else if (ts.isBinaryExpression(expression)) {
		const operator = expression.operatorToken.kind
		if (operator === ts.SyntaxKind.AmpersandAmpersandToken) conditionalLeaves(expression.right, into)
		if (operator === ts.SyntaxKind.BarBarToken || operator === ts.SyntaxKind.QuestionQuestionToken) {
			conditionalLeaves(expression.left, into)
			conditionalLeaves(expression.right, into)
		}
	}
}

function isMeaningful(child: ts.JsxChild): boolean {
	if (ts.isJsxText(child)) return child.text.trim() !== ''
	if (ts.isJsxExpression(child)) return child.expression !== undefined
	return true
}

const BLANK_BOX_TAGS = new Set(['ChartPanelBodyFallback', 'div'])

/** A ChartPanelBodyFallback or div that draws nothing inside. */
function isBlankBox(node: ts.Expression): boolean {
	const expression = unwrap(node)
	if (ts.isJsxSelfClosingElement(expression)) return BLANK_BOX_TAGS.has(tagName(expression))
	return (
		ts.isJsxElement(expression) &&
		BLANK_BOX_TAGS.has(tagName(expression.openingElement)) &&
		!expression.children.some(isMeaningful)
	)
}

/** `<Suspense fallback={…}>` or `dynamic(…, { loading: () => … })`: what renders while a lazy part loads. */
function lazyFallback(node: ts.Node): ts.Expression | undefined {
	if (ts.isJsxAttribute(node) && node.name.getText() === 'fallback') {
		const opening = node.parent.parent
		const isSuspense = ['Suspense', 'React.Suspense'].includes(tagName(opening))
		return isSuspense && node.initializer && ts.isJsxExpression(node.initializer)
			? node.initializer.expression
			: undefined
	}
	if (
		ts.isPropertyAssignment(node) &&
		node.name.getText() === 'loading' &&
		ts.isCallExpression(node.parent.parent) &&
		node.parent.parent.expression.getText() === 'dynamic' &&
		ts.isArrowFunction(node.initializer) &&
		!ts.isBlock(node.initializer.body)
	) {
		return node.initializer.body
	}
	return undefined
}

function isQueryCall(node: ts.Expression | undefined, queryHooks: ReadonlySet<string>): boolean {
	if (!node) return false
	const expression = unwrap(node)
	if (!ts.isCallExpression(expression)) return false
	const callee = expression.expression
	if (ts.isIdentifier(callee)) return QUERY_HOOKS.has(callee.text) || queryHooks.has(callee.text)
	return ts.isPropertyAccessExpression(callee) && QUERY_HOOKS.has(callee.name.text)
}

type Binding = { declaration: ts.VariableDeclaration; element: ts.BindingElement | null }

/** How `name` binds `identifier`: the whole value (element null), one destructured element, or not at all (null). */
function bindsName(name: ts.BindingName, identifier: string): Pick<Binding, 'element'> | null {
	if (ts.isIdentifier(name)) return name.text === identifier ? { element: null } : null
	if (ts.isObjectBindingPattern(name)) {
		for (const element of name.elements) {
			if (ts.isIdentifier(element.name) && element.name.text === identifier) return { element }
		}
	}
	return null
}

/** The property a destructured element reads: `b` in `{ a: b }` is `a`. */
function elementKey(element: ts.BindingElement): string {
	return (element.propertyName ?? element.name).getText()
}

/** The nearest `const` that declares `identifier` in a block enclosing `from`; a parameter stops the search. */
function resolveBinding(from: ts.Node, identifier: string): Binding | null {
	for (let scope: ts.Node | undefined = from.parent; scope; scope = scope.parent) {
		if (ts.isFunctionLike(scope) && scope.parameters.some((parameter) => bindsName(parameter.name, identifier))) {
			return null
		}
		if (!ts.isBlock(scope) && !ts.isSourceFile(scope)) continue
		for (const statement of scope.statements) {
			if (!ts.isVariableStatement(statement)) continue
			for (const declaration of statement.declarationList.declarations) {
				const bound = bindsName(declaration.name, identifier)
				if (bound) return { declaration, element: bound.element }
			}
		}
	}
	return null
}

type QueryRef = { query: number; field: string }

/** Where the query `declaration` holds lives: its own start for `const q = useQuery()`, or the start of `q` for
    `const { error } = q` and `const { error } = holder.query`. Null when it holds no query. */
function queryOf(declaration: ts.VariableDeclaration, queryHooks: ReadonlySet<string>): number | null {
	const initializer = declaration.initializer && unwrap(declaration.initializer)
	if (isQueryCall(initializer, queryHooks)) return declaration.getStart()
	return initializer ? queryOfExpression(initializer, queryHooks) : null
}

/** The query `expression` is: an identifier bound to one, a destructured `query` property of a hook's `{ query, … }`,
    or `holder.query`. */
function queryOfExpression(expression: ts.Expression, queryHooks: ReadonlySet<string>): number | null {
	if (
		ts.isPropertyAccessExpression(expression) &&
		expression.name.text === 'query' &&
		ts.isIdentifier(expression.expression)
	) {
		return queryOfExpression(expression.expression, queryHooks)
	}
	if (!ts.isIdentifier(expression)) return null
	const binding = resolveBinding(expression, expression.text)
	if (!binding || (binding.element && elementKey(binding.element) !== 'query')) return null
	return queryOf(binding.declaration, queryHooks)
}

/** The query fields `node` reads: `q.isError`, a destructured `isLoading`, `queryReadFailed(q)` (field "failed"), or
    a const whose initializer reads one. Function bodies and JSX inside the expression are not conditions. */
function queryRefs(node: ts.Node, queryHooks: ReadonlySet<string>, depth = 0): Array<QueryRef> {
	const refs: Array<QueryRef> = []
	const visit = (child: ts.Node) => {
		if (ts.isFunctionLike(child) || ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) return
		if (ts.isPropertyAccessExpression(child)) {
			const query = queryOfExpression(child.expression, queryHooks)
			if (query !== null) {
				refs.push({ query, field: child.name.text })
				return
			}
		}
		if (
			ts.isCallExpression(child) &&
			ts.isIdentifier(child.expression) &&
			child.expression.text === 'queryReadFailed' &&
			child.arguments[0]
		) {
			const query = queryOfExpression(child.arguments[0], queryHooks)
			if (query !== null) refs.push({ query, field: 'failed' })
			return
		}
		if (ts.isIdentifier(child) && !(ts.isPropertyAccessExpression(child.parent) && child.parent.name === child)) {
			const binding = resolveBinding(child, child.text)
			const query = binding ? queryOf(binding.declaration, queryHooks) : null
			if (binding?.element && query !== null) {
				const element = binding.element
				refs.push({ query, field: elementKey(element) })
			} else if (binding && !binding.element && query === null && binding.declaration.initializer && depth < 2) {
				refs.push(...queryRefs(binding.declaration.initializer, queryHooks, depth + 1))
			}
		}
		ts.forEachChild(child, visit)
	}
	visit(node)
	return refs
}

function containsJsx(node: ts.Node): boolean {
	if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return true
	return ts.forEachChild(node, containsJsx) ?? false
}

function containsRetry(node: ts.Node): boolean {
	if (ts.isIdentifier(node) && node.text === 'refetch') return true
	if (ts.isJsxAttribute(node) && node.name.getText() === 'retry') return true
	return ts.forEachChild(node, containsRetry) ?? false
}

function isNegated(condition: ts.Expression): boolean {
	const expression = unwrap(condition)
	return ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.ExclamationToken
}

type Branch = { condition: ts.Expression; renders: ts.Node | undefined }

/** The branch a condition renders when it holds; a negated condition renders its else. */
function heldBranch(condition: ts.Expression, whenTrue: ts.Node, whenFalse: ts.Node | undefined): Branch {
	return { condition, renders: isNegated(condition) ? whenFalse : whenTrue }
}

function rendersRetry(branch: Branch): boolean {
	return branch.renders !== undefined && containsJsx(branch.renders) && containsRetry(branch.renders)
}

/** `a ? x : b ? y : z` as [a → x, b → y], and `if (a) …; if (b) …` in one block as [a → …, b → …]. */
function conditionChain(node: ts.Node): Array<Branch> | null {
	if (ts.isConditionalExpression(node)) {
		// A ternary in another's else is part of that chain, which starts at the outer one.
		let outer: ts.Node = node.parent
		while (ts.isParenthesizedExpression(outer)) outer = outer.parent
		if (ts.isConditionalExpression(outer) && unwrap(outer.whenFalse) === node) return null
		const chain: Array<Branch> = []
		let current: ts.Expression = node
		while (ts.isConditionalExpression(current)) {
			chain.push({ condition: current.condition, renders: current.whenTrue })
			current = unwrap(current.whenFalse)
		}
		return chain
	}
	if (ts.isBlock(node) || ts.isSourceFile(node)) {
		const chain: Array<Branch> = []
		for (const statement of node.statements) {
			let current: ts.Statement | undefined = statement
			while (current && ts.isIfStatement(current)) {
				chain.push({ condition: current.expression, renders: current.thenStatement })
				current = current.elseStatement
			}
		}
		return chain.length > 1 ? chain : null
	}
	return null
}

/** Names of `use*` hooks in `sourceFile` that return a query result, or an object holding one (`{ query, isLoading }`),
    so their callers' results are queries too. */
export function collectQueryHooks(sourceFile: ts.SourceFile, queryHooks: Set<string>) {
	const isQuery = (node: ts.Expression): boolean => {
		const expression = unwrap(node)
		if (isQueryCall(expression, queryHooks)) return true
		if (!ts.isIdentifier(expression)) return false
		const binding = resolveBinding(expression, expression.text)
		return binding !== null && !binding.element && isQueryCall(binding.declaration.initializer, queryHooks)
	}
	const holdsQuery = (node: ts.Expression): boolean => {
		const expression = unwrap(node)
		if (isQuery(expression)) return true
		if (!ts.isObjectLiteralExpression(expression)) return false
		return expression.properties.some(
			(property) =>
				(ts.isPropertyAssignment(property) && isQuery(property.initializer)) ||
				(ts.isShorthandPropertyAssignment(property) && isQuery(property.name))
		)
	}
	const returnsQuery = (body: ts.ConciseBody): boolean => {
		if (!ts.isBlock(body)) return holdsQuery(body)
		let found = false
		const visit = (node: ts.Node) => {
			if (found || ts.isFunctionLike(node)) return
			if (ts.isReturnStatement(node) && node.expression && holdsQuery(node.expression)) found = true
			ts.forEachChild(node, visit)
		}
		ts.forEachChild(body, visit)
		return found
	}
	const visit = (node: ts.Node) => {
		if (
			ts.isFunctionDeclaration(node) &&
			node.name &&
			/^use[A-Z]/.test(node.name.text) &&
			node.body &&
			returnsQuery(node.body)
		)
			queryHooks.add(node.name.text)
		if (
			ts.isVariableDeclaration(node) &&
			ts.isIdentifier(node.name) &&
			/^use[A-Z]/.test(node.name.text) &&
			node.initializer &&
			(ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) &&
			returnsQuery(node.initializer.body)
		) {
			queryHooks.add(node.name.text)
		}
		ts.forEachChild(node, visit)
	}
	visit(sourceFile)
}

/** A class string that is a whole `className` or a named constant. A branch of a ternary or a tone map entry is one
    tone of a chip, toggle or pill, and an error tone there is not a message box. */
function isStaticClassName(node: ts.Node): boolean {
	const parent = ts.isJsxExpression(node.parent) ? node.parent.parent : node.parent
	if (ts.isJsxAttribute(parent)) return parent.name.getText() === 'className'
	return ts.isVariableDeclaration(parent)
}

function parse(relative: string, source: string): ts.SourceFile {
	return ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function isScanned(relative: string): boolean {
	return !(
		relative.startsWith('src/ui/') ||
		relative.includes('/__tests__/') ||
		relative.startsWith('src/utils/testing/') ||
		/\.test\.tsx?$/.test(relative) ||
		relative.startsWith('src/dev/')
	)
}

export function scanSource(
	relative: string,
	sourceFile: ts.SourceFile,
	queryHooks: ReadonlySet<string>
): Array<Violation> {
	if (!isScanned(relative)) return []
	const violations: Array<Violation> = []
	const reported = new Set<string>()
	const report = (rule: RuleId, node: ts.Node) => {
		const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
		if (reported.has(`${rule}:${line}`)) return
		reported.add(`${rule}:${line}`)
		violations.push({ rule, file: relative, line })
	}

	const checkCopy = !isServerSource(relative)
	let nextErrorName: string | null = null
	let getErrorMessageName: string | null = null
	for (const statement of sourceFile.statements) {
		const bindings =
			ts.isImportDeclaration(statement) &&
			ts.isStringLiteral(statement.moduleSpecifier) &&
			statement.moduleSpecifier.text === '~/utils/error'
				? statement.importClause?.namedBindings
				: undefined
		if (!bindings || !ts.isNamedImports(bindings)) continue
		for (const element of bindings.elements) {
			if ((element.propertyName ?? element.name).text === 'getErrorMessage') getErrorMessageName = element.name.text
		}
	}
	if (relative.startsWith('src/pages/')) {
		for (const statement of sourceFile.statements) {
			if (
				ts.isImportDeclaration(statement) &&
				ts.isStringLiteral(statement.moduleSpecifier) &&
				statement.moduleSpecifier.text === 'next/error' &&
				statement.importClause?.name
			) {
				nextErrorName = statement.importClause.name.text
			}
		}
	}

	const checkRetryGating = (branch: Branch) => {
		if (!rendersRetry(branch)) return
		// `queryReadFailed(q) && !notFound(q.error)` gates on the failed read; the error only refines it.
		const refs = queryRefs(branch.condition, queryHooks)
		const gated = (query: number) => refs.some((ref) => ref.query === query && ref.field === 'failed')
		if (refs.some((ref) => ERROR_FIELDS.has(ref.field) && !gated(ref.query))) report('retry-gating', branch.condition)
	}

	const visit = (node: ts.Node, srOnly: boolean, inButton: boolean) => {
		const opening = openingOf(node)
		let hidden = srOnly
		let busyLabel = inButton
		if (opening) {
			const tag = tagName(opening)
			const className = attribute(opening, 'className')
			const classText = className ? className.getText() : ''
			if (/(?:^|[\s"'`{])sr-only(?:[\s"'`}]|$)/.test(classText)) hidden = true
			if (BUTTON_LIKE.has(tag)) busyLabel = true

			if (tag === 'LoadingDots' && !inButton) report('loading-dots', opening)

			const role = attribute(opening, 'role')
			if (
				role &&
				attributeText(role) === 'alert' &&
				/(?:^|[\s"'`{])text-error(?:[\s"'`}]|$)/.test(classText) &&
				!attribute(opening, 'id')
			) {
				report('alert-line', opening)
			}

			if (READ_STATUS_PARTS.has(tag) && ts.isJsxElement(node)) {
				for (const child of node.children) {
					const retry = handPlacedRetry(child, false)
					if (retry) report('hand-placed-retry', retry)
				}
			}
			const action = tag === 'InlineStatus' ? attribute(opening, 'action') : undefined
			const actionRetry = action?.initializer ? handPlacedRetry(action.initializer, true) : null
			if (actionRetry) report('hand-placed-retry', actionRetry)

			if (nextErrorName && tag === nextErrorName && attribute(opening, 'statusCode')) report('next-error', opening)

			if (tag === 'ChartPanelBodyFallback' && ts.isJsxElement(node)) {
				const children = node.children.filter(isMeaningful)
				if (
					children.length === 1 &&
					ts.isJsxSelfClosingElement(children[0]) &&
					tagName(children[0]) === 'LoadingIndicator'
				) {
					report('hand-built-chart-loading', opening)
				}
			}

			if (ts.isJsxElement(node) && !BUTTON_LIKE.has(tag)) {
				const children = node.children.filter(isMeaningful)
				const isSpinner = (child: ts.JsxChild) =>
					ts.isJsxSelfClosingElement(child) && tagName(child) === 'LoadingSpinner'
				const isTextLine = (child: ts.JsxChild) =>
					ts.isJsxText(child) ||
					(ts.isJsxElement(child) && child.children.every((inner) => !openingOf(inner)) && !isSpinner(child))
				if (children.length === 1 && isSpinner(children[0]) && /\bjustify-center\b/.test(classText)) {
					report('lone-spinner', opening)
				}
				if (
					children.length === 2 &&
					/\bflex-col\b/.test(classText) &&
					/\bitems-center\b/.test(classText) &&
					children.some(isSpinner) &&
					children.some(isTextLine)
				) {
					report('lone-spinner', opening)
				}
			}
		}

		if ((ts.isJsxElement(node) || ts.isJsxFragment(node)) && !hidden && !busyLabel) {
			let text = ''
			const leaves: Array<string> = []
			for (const child of node.children) {
				if (ts.isJsxText(child)) text += child.text
				else if (ts.isJsxExpression(child)) {
					const literal = child.expression ? literalText(unwrap(child.expression)) : undefined
					if (literal !== undefined) text += literal
					else if (child.expression) {
						text += '{}'
						conditionalLeaves(child.expression, leaves)
					}
				} else text += ' '
			}
			if (isLoadingText(text) || leaves.some(isLoadingText)) report('loading-text', opening ?? node)
		}

		if (checkCopy && node.parent && !ts.isImportDeclaration(node.parent) && !ts.isExportDeclaration(node.parent)) {
			const copy = ts.isJsxText(node)
				? node.text
				: ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)
					? literalText(node)
					: undefined
			if (copy !== undefined && ERROR_COPY.test(copy) && !inConsoleCall(node)) report('error-copy', node)
		}

		if (
			checkCopy &&
			((ts.isConditionalExpression(node) && showsAnyErrorMessage(node)) ||
				(ts.isCallExpression(node) && node.expression.getText() === getErrorMessageName)) &&
			!inConsoleCall(node)
		) {
			report('raw-error-message', node)
		}

		if (
			(ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) &&
			isStaticClassName(node)
		) {
			const classes = (
				ts.isTemplateExpression(node)
					? [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(' ')
					: node.text
			).split(/\s+/)
			if (
				classes.some((name) => /^bg-error-(?:faint|tint)(?:\/\d+)?$/.test(name)) &&
				classes.some((name) => /^(?:[\w-]+:)*border(?:-[trblxyse])?-error(?:-[a-z]+)?(?:\/\d+)?$/.test(name))
			) {
				report('error-box', node)
			}
		}

		const fallback = lazyFallback(node)
		if (fallback && isBlankBox(fallback)) report('blank-fallback', fallback)

		if (ts.isConditionalExpression(node)) checkRetryGating(heldBranch(node.condition, node.whenTrue, node.whenFalse))
		if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
			checkRetryGating({ condition: node.left, renders: node.right })
		}
		if (ts.isIfStatement(node)) checkRetryGating(heldBranch(node.expression, node.thenStatement, node.elseStatement))

		const chain = conditionChain(node)
		if (chain) {
			for (let i = 0; i < chain.length; i++) {
				if (isNegated(chain[i].condition) || !chain[i].renders || !containsJsx(chain[i].renders!)) continue
				const refs = queryRefs(chain[i].condition, queryHooks)
				for (const loading of refs) {
					if (!LOADING_FIELDS.has(loading.field)) continue
					if (refs.some((ref) => ref.query === loading.query && ref.field === 'failed')) continue
					const failsLater = chain
						.slice(i + 1)
						.some(
							(later) =>
								!isNegated(later.condition) &&
								rendersRetry(later) &&
								queryRefs(later.condition, queryHooks).some(
									(ref) => ref.query === loading.query && (ref.field === 'failed' || ERROR_FIELDS.has(ref.field))
								)
						)
					if (failsLater) report('retry-gating', chain[i].condition)
				}
			}
		}

		ts.forEachChild(node, (child) => visit(child, hidden, busyLabel))
	}
	visit(sourceFile, false, false)
	return violations
}

if (process.argv.includes('--self-test')) {
	const cases: Array<{ name: string; source: string; rule: RuleId | null; relative?: string }> = [
		{ name: 'loading text', source: 'export const F = () => <p>Loading…</p>', rule: 'loading-text' },
		{
			name: 'loading text with an expression',
			source: 'export const F = () => <p className="text-tertiary">Loading {name}...</p>',
			rule: 'loading-text'
		},
		{
			name: 'searching with an entity',
			source: 'export const F = () => <span>Searching&hellip;</span>',
			rule: 'loading-text'
		},
		{
			name: 'loading literal in a ternary child',
			source: "export const F = () => <span>{isLoading ? 'Fetching data…' : `${count} rows`}</span>",
			rule: 'loading-text'
		},
		{
			name: 'loading text under sr-only',
			source: 'export const F = () => <div><span className="sr-only">Loading…</span></div>',
			rule: null
		},
		{
			name: 'loading text as a prop',
			source: 'export const F = () => <Button pendingLabel="Loading…" aria-label="Loading…">Load</Button>',
			rule: null
		},
		{
			name: 'loading literal assigned to a variable',
			source:
				"export const F = () => { const label = isLoading ? 'Loading…' : 'Done'; return <Field label={label} /> }",
			rule: null
		},
		{
			name: 'busy button label',
			source: "export const F = () => <button type=\"button\">{busy ? 'Loading…' : 'Load more'}</button>",
			rule: null
		},
		{ name: 'loading without an ellipsis', source: 'export const F = () => <p>Loading complete</p>', rule: null },
		{
			name: 'loading dots in a panel',
			source: 'export const F = () => <p>Loading<LoadingDots /></p>',
			rule: 'loading-dots'
		},
		{
			name: 'loading dots in a busy button',
			source: 'export const F = () => <Ariakit.Button>Loading<LoadingDots /></Ariakit.Button>',
			rule: null
		},
		{
			name: 'lone centred spinner',
			source:
				'export const F = () => <div className="flex min-h-40 items-center justify-center"><LoadingSpinner size={16} /></div>',
			rule: 'lone-spinner'
		},
		{
			name: 'spinner stacked over a caption',
			source:
				'export const F = () => <div className="flex flex-col items-center gap-2"><LoadingSpinner size={16} /><p>Preparing</p></div>',
			rule: 'lone-spinner'
		},
		{
			name: 'spinner in a centred button',
			source: 'export const F = () => <Button className="justify-center"><LoadingSpinner size={12} /></Button>',
			rule: null
		},
		{
			name: 'spinner beside a control',
			source:
				'export const F = () => <div className="flex justify-center gap-2"><LoadingSpinner size={12} /><Select /></div>',
			rule: null
		},
		{
			name: 'hand-built error box',
			source:
				'export const F = () => <div className="rounded-md border border-error-muted bg-error-faint p-3">Failed</div>',
			rule: 'error-box'
		},
		{
			name: 'error box in a constant',
			source: "const BOX = 'border border-l-error bg-error-tint/50'",
			rule: 'error-box'
		},
		{
			name: 'error tone of a toggle',
			source:
				"export const F = () => <button className={`border ${bad ? 'border-error bg-error-tint' : 'border-medium'}`}>Bad</button>",
			rule: null
		},
		{
			name: 'strong error fill',
			source: 'export const F = () => <div className="border border-error-muted bg-error-strong">x</div>',
			rule: null
		},
		{
			name: 'error tint on hover only',
			source: 'export const F = () => <button className="border border-error-muted hover:bg-error-faint">x</button>',
			rule: null
		},
		{
			name: 'hand-built alert line',
			source: 'export const F = () => <p role="alert" className="body-sm text-error">Load failed</p>',
			rule: 'alert-line'
		},
		{
			name: 'field error with an id',
			source: 'export const F = () => <p id={errorId} role="alert" className="body-sm text-error">Required</p>',
			rule: null
		},
		{
			name: 'alert role in an expression',
			source: 'export const F = () => <p role={\'alert\'} className="body-sm text-error">Load failed</p>',
			rule: 'alert-line'
		},
		{
			name: 'status line',
			source: 'export const F = () => <p role="status" className="body-sm text-error">Failed</p>',
			rule: null
		},
		{
			name: 'retry gated on isError',
			source:
				'export function F() { const q = useQuery(o); return q.isError ? <PanelStatus variant="error" retry={q}>Failed</PanelStatus> : <Table /> }',
			rule: 'retry-gating'
		},
		{
			name: 'retry gated on a destructured error',
			source:
				'export function F() { const { data, error, refetch } = useQuery(o); if (error) return <p>Failed <Button onClick={() => refetch()}>Try again</Button></p>; return <Table data={data} /> }',
			rule: 'retry-gating'
		},
		{
			name: 'retry gated on an error destructured from a query variable',
			source:
				'export function F() { const q = useInfiniteQuery(o); const { error } = q; return error ? <InlineStatus variant="error" retry={q}>x</InlineStatus> : null }',
			rule: 'retry-gating'
		},
		{
			name: 'retry gated on a wrapper hook error',
			source:
				'function useRows() { return useQuery(o) } export function F() { const rows = useRows(); return rows.error && <PanelStatus variant="error" retry={rows}>x</PanelStatus> }',
			rule: 'retry-gating'
		},
		{
			name: 'retry gated on the query a hook returns in an object',
			source:
				'function useRows() { const query = useQuery(o); return { query, isLoading: query.isLoading } } export function F() { const rows = useRows(); return rows.query.isError ? <PanelStatus variant="error" retry={rows.query}>x</PanelStatus> : null }',
			rule: 'retry-gating'
		},
		{
			name: 'retry gated on a destructured query from a hook object',
			source:
				'function useRows() { return { query: useQuery(o) } } export function F() { const { query } = useRows(); if (query.error) return <PanelStatus variant="error" retry={query}>x</PanelStatus>; return null }',
			rule: 'retry-gating'
		},
		{
			name: 'hook object checked for loading before its failed read',
			source:
				'function useRows() { const query = useQuery(o); return { query, isLoading: query.isLoading } } export function F() { const { query, isLoading } = useRows(); if (isLoading) return <PanelLoadingStatus />; if (queryReadFailed(query)) return <PanelStatus variant="error" retry={query}>x</PanelStatus>; return <Table /> }',
			rule: 'retry-gating'
		},
		{
			name: 'hook object gated on queryReadFailed',
			source:
				'function useRows() { const query = useQuery(o); return { query, isLoading: query.isLoading } } export function F() { const rows = useRows(); if (queryReadFailed(rows.query)) return <PanelStatus variant="error" retry={rows.query}>x</PanelStatus>; if (rows.isLoading) return <PanelLoadingStatus />; return <Table /> }',
			rule: null
		},
		{
			name: 'retry gated on queryReadFailed',
			source:
				'export function F() { const q = useQuery(o); return queryReadFailed(q) ? <PanelStatus variant="error" retry={q}>Failed</PanelStatus> : q.isLoading ? <PanelLoadingStatus /> : <Table /> }',
			rule: null
		},
		{
			name: 'failed read refined by its error',
			source:
				'export function F() { const q = useQuery(o); const { error } = q; const notFound = error?.status === 404; if (queryReadFailed(q) && !notFound) return <PanelStatus variant="error" retry={q}>Failed</PanelStatus>; return <Table /> }',
			rule: null
		},
		{
			name: 'loading checked before the failed read',
			source:
				'export function F() { const q = useQuery(o); if (q.isLoading) return <PanelLoadingStatus />; if (queryReadFailed(q)) return <PanelStatus variant="error" retry={q}>Failed</PanelStatus>; return <Table /> }',
			rule: 'retry-gating'
		},
		{
			name: 'loading that excludes the failed read',
			source:
				'export function F() { const q = useQuery(o); return q.isLoading && !queryReadFailed(q) ? <PanelLoadingStatus /> : queryReadFailed(q) ? <PanelStatus variant="error" retry={q}>Failed</PanelStatus> : <Table /> }',
			rule: null
		},
		{
			name: 'error without a retry',
			source: 'export function F() { const q = useQuery(o); return q.isError ? <p>Failed</p> : <Table /> }',
			rule: null
		},
		{
			name: 'mutation error with a retry',
			source:
				'export function F() { const m = useMutation(o); return m.error ? <Button onClick={() => m.mutate()} retry>Try again</Button> : null }',
			rule: null
		},
		{
			name: 'retry in an effect',
			source:
				'export function F() { const { error, refetch } = useQuery(o); useEffect(() => { if (error) refetch() }, [error]); return null }',
			rule: null
		},
		{
			name: 'next/error page',
			relative: 'src/pages/policy-self-test.tsx',
			source: "import Error from 'next/error'\nexport default function P() { return <Error statusCode={404} /> }",
			rule: 'next-error'
		},
		{
			name: 'Failed to toast',
			source: "export const f = () => toast.error('Failed to save chart')",
			rule: 'error-copy'
		},
		{ name: 'Please in JSX', source: 'export const F = () => <p>Please sign in to continue.</p>', rule: 'error-copy' },
		{
			name: 'passive could not be loaded',
			source: 'export const m = `Data for ${name} could not be loaded.`',
			rule: 'error-copy'
		},
		{
			name: 'Failed to thrown',
			source: "export function f() { throw new Error('Failed to load') }",
			rule: 'error-copy'
		},
		{
			name: 'any error message in a toast',
			source: 'export const f = (error) => toast.error(error instanceof Error ? error.message : "Couldn\'t save.")',
			rule: 'raw-error-message'
		},
		{
			name: 'any error message behind a truthy check',
			source:
				"export const f = (error) => { throw new Error(error instanceof Error && error.message ? error.message : 'x') }",
			rule: 'raw-error-message'
		},
		{
			name: 'any error message in a template',
			source: "export const m = (e) => (e instanceof Error ? `Couldn't render: ${e.message}` : String(e))",
			rule: 'raw-error-message'
		},
		{
			name: 'any error message after another test',
			source: "export const m = (failed, error) => (failed && error instanceof Error ? error.message.trim() : 'x')",
			rule: 'raw-error-message'
		},
		{
			name: 'getErrorMessage into state',
			source:
				"import { getErrorMessage } from '~/utils/error'\nexport const f = (error) => setViewError(getErrorMessage(error))",
			rule: 'raw-error-message'
		},
		{
			name: 'typed error message',
			source:
				'export const f = (error) => toast.error(error instanceof UploadError ? error.message : "Couldn\'t upload.")',
			rule: null
		},
		{
			name: 'any error message in a console call',
			source:
				"import { getErrorMessage } from '~/utils/error'\nexport const f = (error) => console.error('save', error instanceof Error ? error.message : error, getErrorMessage(error))",
			rule: null
		},
		{
			name: 'any error message matched, not shown',
			source:
				"export const f = (error) => (error instanceof Error ? error.message.includes('[404]') || /x/.test(error.message) || error.message === 'gone' : false)",
			rule: null
		},
		{
			name: 'a local getErrorMessage that reads a response body',
			source:
				'const getErrorMessage = (body, fallback) => body.error ?? fallback\nexport const m = (body) => getErrorMessage(body, "x")',
			rule: null
		},
		{
			name: 'server message',
			relative: 'src/containers/Foo/server/api.ts',
			source: 'export const body = (error) => ({ error: error instanceof Error ? error.message : String(error) })',
			rule: null
		},
		{
			name: "Couldn't copy",
			source: 'export const f = () => toast.error("Couldn\'t save the chart. Try again.")',
			rule: null
		},
		{ name: 'console message', source: "export const f = () => console.error('Failed to load', e)", rule: null },
		{
			name: 'server route message',
			relative: 'src/containers/Foo/server/api.ts',
			source: "export const body = { error: 'Failed to fetch data' }",
			rule: null
		},
		{
			name: 'next/error outside pages',
			source: "import Error from 'next/error'\nexport function P() { return <Error statusCode={404} /> }",
			rule: null
		},
		{
			name: 'Try again inside a surface status',
			source:
				'export const F = ({ q }) => <SurfaceBodyStatus variant="error"><p>Couldn\'t load.</p><Button size="sm" onClick={() => void q.refetch()}>Try again</Button></SurfaceBodyStatus>',
			rule: 'hand-placed-retry'
		},
		{
			name: 'refetching Try again in an InlineStatus action',
			source:
				'export const F = ({ refetch }) => <InlineStatus variant="error" action={<Button ref={focusRegionOnLeave} size="sm" onClick={() => void refetch()}>Try again</Button>}>Couldn\'t load.</InlineStatus>',
			rule: 'hand-placed-retry'
		},
		{
			name: 'mutation Try again in an InlineStatus action',
			source:
				'export const F = ({ save }) => <InlineStatus variant="error" action={<Button size="sm" onClick={() => save.mutate()}>Try again</Button>}>Couldn\'t save.</InlineStatus>',
			rule: null
		},
		{
			name: 'Try again with its own focus handoff',
			source:
				'export const F = ({ q }) => <InlineStatus variant="error" action={<Button ref={takeLostFocus} size="sm" onClick={() => void q.refetch()}>Try again</Button>}>Couldn\'t load.</InlineStatus>',
			rule: null
		},
		{
			name: 'blank chart body as a Suspense fallback',
			source:
				'export const F = () => <Suspense fallback={<ChartPanelBodyFallback className="min-h-[600px]" />}><Chart /></Suspense>',
			rule: 'blank-fallback'
		},
		{
			name: 'blank div as a React.Suspense fallback',
			source:
				'export const F = () => <React.Suspense fallback={(<div style={{ height }}></div>)}><Chart /></React.Suspense>',
			rule: 'blank-fallback'
		},
		{
			name: 'blank div as a dynamic loading',
			source:
				'const C = dynamic(() => import(\'./C\'), { ssr: false, loading: () => <div className="min-h-[572px]" /> })',
			rule: 'blank-fallback'
		},
		{
			name: 'loading part as a Suspense fallback',
			source:
				'export const F = () => <Suspense fallback={<ChartPanelBodyLoading className="min-h-[600px]" />}><Chart /></Suspense>',
			rule: null
		},
		{
			name: 'wrapper holding a loading part as a fallback',
			source:
				'export const F = () => <Suspense fallback={<div style={{ minHeight }}><SurfaceBodyLoadingStatus label="Loading table" /></div>}><T /></Suspense>',
			rule: null
		},
		{
			name: "another component's fallback prop",
			source: 'export const F = () => <ErrorBoundary fallback={<div />}><Chart /></ErrorBoundary>',
			rule: null
		},
		{
			name: 'LoadingIndicator in a chart body box',
			source:
				'export const F = () => <ChartPanelBodyFallback role="status" aria-live="polite"><LoadingIndicator /></ChartPanelBodyFallback>',
			rule: 'hand-built-chart-loading'
		},
		{
			name: 'note in a chart body box',
			source:
				'export const F = () => <ChartPanelBodyFallback className="body-sm text-tertiary">No data</ChartPanelBodyFallback>',
			rule: null
		}
	]
	const failures = cases.filter(({ name, source, rule, relative }) => {
		const sourceFile = parse(relative ?? `src/policy-self-test/${name.replace(/\W+/g, '-')}.tsx`, source)
		const queryHooks = new Set<string>()
		collectQueryHooks(sourceFile, queryHooks)
		const rules = new Set(scanSource(sourceFile.fileName, sourceFile, queryHooks).map((violation) => violation.rule))
		return rule === null ? rules.size > 0 : rules.size !== 1 || !rules.has(rule)
	})
	if (failures.length > 0) {
		console.error(`Status parts policy self-test failed: ${failures.map(({ name }) => name).join(', ')}`)
		process.exit(1)
	}
	console.log(`Status parts policy self-test passed (${cases.length} cases).`)
	process.exit(0)
}

const relativeOf = (file: string) => path.relative(root, file).split(path.sep).join('/')
const parsed = new Map<string, ts.SourceFile>()
for (const file of collectSourceFiles(sourceRoot, ['.ts', '.tsx'])) {
	parsed.set(relativeOf(file), parse(relativeOf(file), fs.readFileSync(file, 'utf8')))
}
// Two passes, so a hook that returns another file's query hook counts too.
const queryHooks = new Set<string>()
for (let pass = 0; pass < 2; pass++) {
	for (const sourceFile of parsed.values()) collectQueryHooks(sourceFile, queryHooks)
}

const scanned = policyTargetFiles(root, sourceRoot).map(relativeOf)
const failures: Array<string> = []
const excused = new Set<string>()
for (const relative of scanned) {
	const sourceFile = parsed.get(relative) ?? parse(relative, fs.readFileSync(path.join(root, relative), 'utf8'))
	for (const { rule, file, line } of scanSource(relative, sourceFile, queryHooks)) {
		if (EXCEPTIONS[rule][file]) excused.add(`${rule} ${file}`)
		else failures.push(`${rule}: ${file}:${line} ${MESSAGES[rule]}`)
	}
}
for (const rule of Object.keys(EXCEPTIONS) as Array<RuleId>) {
	for (const file of Object.keys(EXCEPTIONS[rule])) {
		if (scanned.includes(file) && !excused.has(`${rule} ${file}`)) {
			failures.push(`${rule}: ${file} no longer matches; remove it from the rule's exceptions`)
		}
	}
}

if (failures.length > 0) {
	console.error(`Status parts policy violations:\n${failures.map((failure) => `- ${failure}`).join('\n')}`)
	process.exit(1)
}

console.log('Status parts policy passed.')
