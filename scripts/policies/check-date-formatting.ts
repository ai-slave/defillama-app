import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { policyTargetFiles } from '../lib/sourceFiles'

const root = path.resolve(import.meta.dirname, '../..')
const sourceRoot = path.join(root, 'src')
const canonicalFormatter = 'src/utils/dateFormat.ts'
const relativeTimeComponent = 'src/ui/RelativeTime.tsx'

const canonicalExports = new Set([
	'formatDate',
	'formatDateTime',
	'formatIsoDate',
	'formatMonthYear',
	'formatRelativeTime',
	'parseDateTimestamp'
])

// These modules own deliberately non-canonical domain output documented in
// docs/date-formatting.md. Keep this list narrow: a new raw formatter should fail CI.
const intlDateFormatFiles = new Set([
	canonicalFormatter,
	'src/containers/Exchanges/DirectoryChart.tsx',
	'src/containers/Exchanges/ResearchChart.tsx',
	'src/containers/Exchanges/VenueChart.tsx',
	'src/containers/LlamaAI/components/alerts/schedule.ts',
	'src/pages/research/authors/[slug].tsx'
])

const localeDateMethodFiles = new Set([
	'src/components/ECharts/shared/formatters.ts',
	'src/containers/Articles/editor/ArticleEditorUtils.ts',
	'src/containers/Articles/editor/RevisionHistoryDrawer.tsx',
	'src/containers/Articles/landing/utils.ts',
	'src/containers/Articles/renderer/ArticleChartBlock.tsx',
	'src/containers/Articles/renderer/ArticleRenderer.tsx',
	'src/containers/Articles/renderer/EntityPreviewLink.tsx',
	'src/containers/Investors/dashboards/hyperliquid/Positions.tsx',
	'src/containers/Investors/dashboards/hyperliquid/Stats.tsx',
	'src/containers/Investors/dashboards/hyperliquid/Trades.tsx',
	'src/containers/LlamaAI/components/AddToArticle/AddToArticleModal.tsx',
	'src/containers/LlamaAI/components/AlertsModal.tsx',
	'src/containers/LlamaAI/components/alerts/createAlertForm.ts',
	'src/containers/TokenPnl/format.ts'
])

const dayjsFormatFiles = new Set([
	'src/containers/Cexs/DateFilter.tsx',
	'src/containers/Downloads/csvDateFilter.ts',
	'src/containers/Downloads/savedDownloads.ts',
	'src/containers/ProDashboard/components/CustomTimePeriodPicker.tsx',
	'src/containers/ProtocolOverview/AdditionalInfo.tsx',
	'src/containers/RWA/Perps/contractPageUtils.ts',
	'src/containers/Unlocks/CalendarDayCell.tsx',
	'src/containers/Unlocks/CalendarView.tsx',
	'src/containers/Unlocks/PastUnlockPriceImpact.tsx',
	'src/containers/Unlocks/TreemapChart/index.tsx',
	'src/containers/Unlocks/UnlocksListView.tsx',
	'src/containers/Unlocks/UpcomingEvent.tsx',
	'src/containers/Unlocks/useUnlockChartData.ts',
	'src/containers/Unlocks/WeekDayColumn.tsx',
	'src/utils/calendar.ts'
])

/**
 * Day.js parses a date-only string at local midnight and puts calendar boundaries in the visitor's zone, while date
 * keys and daily points are UTC calendar days (docs/date-formatting.md). These modules keep UTC date keys as
 * local-midnight Day.js days on purpose: each key parses and formats in the same zone, so it round-trips.
 */
const localDayjsCalendarFiles = new Map<string, string>([
	['src/containers/Unlocks/calendarUtils.ts', 'the unlocks calendar grid does its day math on local-midnight days'],
	['src/containers/Unlocks/CalendarView.tsx', 'the unlocks calendar grid does its day math on local-midnight days'],
	['src/containers/Unlocks/UnlocksListView.tsx', 'the unlocks list groups by the same local-midnight days']
])

const UTC_ZONE_NAMES = new Set(['UTC', 'Etc/UTC'])

const DAYJS_CALENDAR_UNITS = new Set([
	'day',
	'date',
	'd',
	'D',
	'week',
	'w',
	'isoWeek',
	'month',
	'M',
	'quarter',
	'Q',
	'year',
	'y'
])

// These callers provide their own client clock. Other UI should use RelativeTime,
// which owns SSR fallback, exact timestamp disclosure, and ticking behavior.
const directRelativeTimeFiles = new Set([
	canonicalFormatter,
	relativeTimeComponent,
	'src/containers/Account/Team/TeamInvitesCard.tsx',
	'src/containers/Articles/editor/ArticleEditorHeader.tsx'
])

/**
 * Approved formatters that render in the visitor's locale and zone on purpose: chart tooltips and client-only grids
 * that draw after interaction, and the client-rendered product surfaces. Everywhere else an approved raw formatter
 * must name a literal locale and a timeZone, or the server and the visitor render different text.
 */
const visitorLocalePatterns = [
	/^src\/components\/ECharts\/shared\/formatters\.ts$/,
	/^src\/containers\/TokenPnl\/format\.ts$/,
	/^src\/containers\/LlamaAI\//,
	/^src\/containers\/Investors\//,
	/^src\/containers\/Articles\/(?:editor|admin)\//
]

function isVisitorLocaleFile(relative: string) {
	return visitorLocalePatterns.some((pattern) => pattern.test(relative))
}

/** `('en', { timeZone: … })`: the locale is a string literal (or the canonical constant) and the options name a zone. */
function namesLiteralLocaleAndZone(args: ReadonlyArray<ts.Expression>): boolean {
	const [locale, options] = args
	if (!locale) return false
	const literalLocale = ts.isStringLiteral(locale) || (ts.isIdentifier(locale) && locale.text === 'DISPLAY_LOCALE')
	if (!literalLocale || !options || !ts.isObjectLiteralExpression(options)) return false
	return options.properties.some(
		(property) => ts.isPropertyAssignment(property) && property.name.getText() === 'timeZone'
	)
}

const legacyNames = [
	'toNiceCsvDate',
	'toNiceDateYear',
	'toNiceDayAndHour',
	'toNiceDayMonthAndYear',
	'toNiceDayMonthAndYearAndTime',
	'toNiceDayMonthYear',
	'toNiceDaysAgo',
	'toNiceHour',
	'toYearMonth'
]

function isTestFile(relative: string) {
	return /(?:^|\/)(?:__tests__\/.*|[^/]+\.(?:test|spec)\.[^/]+)$/.test(relative)
}

function isCanonicalDateModule(relative: string, moduleName: string): boolean {
	if (moduleName === '~/utils/dateFormat') return true
	if (!moduleName.startsWith('.')) return false
	const resolved = path.posix
		.normalize(path.posix.join(path.posix.dirname(relative), moduleName))
		.replace(/\.(?:ts|tsx)$/, '')
	return resolved === 'src/utils/dateFormat'
}

function isDayjsExpression(node: ts.Expression, bindings: ReadonlySet<string>): boolean {
	if (ts.isIdentifier(node)) return bindings.has(node.text)
	if (ts.isCallExpression(node)) return isDayjsExpression(node.expression, bindings)
	if (ts.isPropertyAccessExpression(node)) return isDayjsExpression(node.expression, bindings)
	return false
}

/** A number or Date argument is an instant; anything else may be a date string that Day.js parses as local midnight. */
function isInstantArgument(node: ts.Expression): boolean {
	if (ts.isNumericLiteral(node) || ts.isNewExpression(node)) return true
	if (ts.isPrefixUnaryExpression(node)) return isInstantArgument(node.operand)
	if (ts.isParenthesizedExpression(node)) return isInstantArgument(node.expression)
	if (ts.isBinaryExpression(node)) {
		const operator = node.operatorToken.kind
		return (
			operator === ts.SyntaxKind.AsteriskToken ||
			operator === ts.SyntaxKind.SlashToken ||
			operator === ts.SyntaxKind.MinusToken
		)
	}
	return ts.isCallExpression(node) && node.expression.getText() === 'Date.now'
}

function scanSource(relative: string, file: string, source: string): Array<string> {
	const violations: Array<string> = []
	const sourceFile = ts.createSourceFile(
		file,
		source,
		ts.ScriptTarget.Latest,
		true,
		file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
	)
	const testFile = isTestFile(relative)
	const dayjsBindings = new Set<string>()
	const localDayjsCalendarOwner = localDayjsCalendarFiles.has(relative)
	/** Same-file `const` initializers, so `const today = dayjs()` carries its zone to `today.format(…)`. */
	const constInitializers = new Map<string, ts.Expression | null>()
	;(function collectConsts(node: ts.Node) {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
			// A name declared twice is ambiguous without scope analysis, so it resolves to unknown.
			const name = node.name.text
			constInitializers.set(name, constInitializers.has(name) ? null : node.initializer)
		}
		ts.forEachChild(node, collectConsts)
	})(sourceFile)

	/**
	 * Whether a Day.js chain ends in UTC or in another zone (the visitor's or a named one), or null when the chain does
	 * not start from Day.js in this file. The zone call nearest the end wins, so `.utc().local()` is not UTC.
	 */
	function dayjsZone(node: ts.Expression, seen = new Set<string>()): 'utc' | 'zoned' | null {
		if (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)) return dayjsZone(node.expression, seen)
		if (ts.isIdentifier(node)) {
			const initializer = constInitializers.get(node.text)
			if (!initializer || seen.has(node.text)) return null
			seen.add(node.text)
			return dayjsZone(initializer, seen)
		}
		if (!ts.isCallExpression(node)) return null
		const callee = node.expression
		if (ts.isIdentifier(callee)) return dayjsBindings.has(callee.text) ? 'zoned' : null
		if (!ts.isPropertyAccessExpression(callee)) return null
		const isDayjsStatic = ts.isIdentifier(callee.expression) && dayjsBindings.has(callee.expression.text)
		if (callee.name.text === 'utc') return 'utc'
		if (callee.name.text === 'local') return 'zoned'
		if (callee.name.text === 'tz') {
			// `dayjs.tz(value, zone)` and `value.tz(zone)`; no zone means the visitor's guessed zone.
			const zone = node.arguments[isDayjsStatic ? 1 : 0]
			return zone && ts.isStringLiteralLike(zone) && UTC_ZONE_NAMES.has(zone.text) ? 'utc' : 'zoned'
		}
		if (isDayjsStatic) return 'zoned'
		return dayjsZone(callee.expression, seen)
	}

	function report(node: ts.Node, message: string) {
		const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
		violations.push(`${relative}:${line + 1} ${message}`)
	}

	function visit(node: ts.Node) {
		if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
			const moduleName = node.moduleSpecifier.text
			const importsCanonicalDateModule = isCanonicalDateModule(relative, moduleName)
			if (moduleName === 'dayjs') {
				if (node.importClause?.name) dayjsBindings.add(node.importClause.name.text)
				if (node.importClause?.namedBindings && ts.isNamespaceImport(node.importClause.namedBindings)) {
					dayjsBindings.add(node.importClause.namedBindings.name.text)
				}
			}
			if (/^dayjs\/plugin\/relativeTime(?:\.js)?$/.test(moduleName)) {
				report(node, 'imports Day.js relative time instead of using RelativeTime')
			}
			if (
				importsCanonicalDateModule &&
				node.importClause?.namedBindings &&
				ts.isNamespaceImport(node.importClause.namedBindings)
			) {
				report(node.importClause.namedBindings, 'uses a namespace import; import canonical date functions by name')
			}
			if (
				moduleName === '~/utils' &&
				node.importClause?.namedBindings &&
				ts.isNamedImports(node.importClause.namedBindings)
			) {
				for (const element of node.importClause.namedBindings.elements) {
					if (canonicalExports.has((element.propertyName ?? element.name).text)) {
						report(element, `${element.name.text} must be imported directly from ~/utils/dateFormat`)
					}
				}
			}
			if (
				importsCanonicalDateModule &&
				node.importClause?.namedBindings &&
				ts.isNamedImports(node.importClause.namedBindings)
			) {
				for (const element of node.importClause.namedBindings.elements) {
					if (element.propertyName && canonicalExports.has(element.propertyName.text)) {
						report(element, `${element.propertyName.text} must not be locally aliased`)
					}
				}
			}
		}

		if (ts.isExportDeclaration(node)) {
			const moduleName =
				node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : null
			if (moduleName && isCanonicalDateModule(relative, moduleName)) {
				report(node, 're-exports canonical date formatters; consumers must import the canonical file directly')
			} else if (node.exportClause && ts.isNamedExports(node.exportClause)) {
				for (const element of node.exportClause.elements) {
					if (canonicalExports.has((element.propertyName ?? element.name).text)) {
						report(element, 're-exports a canonical date formatter')
					}
				}
			}
		}

		if (!testFile && ts.isNewExpression(node) && node.expression.getText(sourceFile) === 'Intl.DateTimeFormat') {
			if (!intlDateFormatFiles.has(relative)) {
				report(node, 'constructs Intl.DateTimeFormat outside the canonical formatter or an approved domain policy')
			} else if (
				relative !== canonicalFormatter &&
				!isVisitorLocaleFile(relative) &&
				!namesLiteralLocaleAndZone(node.arguments ?? [])
			) {
				report(
					node,
					'constructs Intl.DateTimeFormat without a literal locale and a timeZone; the server and the visitor would format differently'
				)
			}
		}

		if (!testFile && ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
			const method = node.expression.name.text
			if (['toLocaleDateString', 'toLocaleTimeString', 'toLocaleString'].includes(method)) {
				const receiver = node.expression.expression
				const isBigIntResultCell =
					relative === 'src/containers/Downloads/sql/ResultsGrid.tsx' &&
					method === 'toLocaleString' &&
					ts.isIdentifier(receiver) &&
					receiver.text === 'value'
				if (!localeDateMethodFiles.has(relative) && !isBigIntResultCell) {
					report(node, `calls ${method} outside the canonical formatter or an approved domain policy`)
				} else if (
					localeDateMethodFiles.has(relative) &&
					!isVisitorLocaleFile(relative) &&
					!namesLiteralLocaleAndZone(node.arguments)
				) {
					report(
						node,
						`calls ${method} without a literal locale and a timeZone; the server and the visitor would format differently`
					)
				}
			}
			if (
				dayjsBindings.size > 0 &&
				['from', 'fromNow', 'to', 'toNow'].includes(method) &&
				isDayjsExpression(node.expression.expression, dayjsBindings)
			) {
				report(node, `uses Day.js ${method} relative time instead of RelativeTime`)
			}
			if (method === 'format' && dayjsBindings.size > 0 && !dayjsFormatFiles.has(relative)) {
				report(node, 'uses Day.js display formatting outside an approved domain policy')
			}
			const [firstArgument] = node.arguments
			if (
				dayjsBindings.size > 0 &&
				!localDayjsCalendarOwner &&
				firstArgument &&
				ts.isStringLiteral(firstArgument) &&
				(((method === 'startOf' || method === 'endOf') && DAYJS_CALENDAR_UNITS.has(firstArgument.text)) ||
					(method === 'format' && firstArgument.text.includes('YYYY-MM-DD'))) &&
				dayjsZone(node.expression.expression) === 'zoned'
			) {
				report(
					node,
					`calls Day.js ${method}('${firstArgument.text}') outside UTC; date keys are UTC days, so use dayjs.utc() or compare YYYY-MM-DD strings`
				)
			}
		}

		if (
			!testFile &&
			!localDayjsCalendarOwner &&
			ts.isCallExpression(node) &&
			ts.isIdentifier(node.expression) &&
			dayjsBindings.has(node.expression.text) &&
			node.arguments[0] &&
			!isInstantArgument(node.arguments[0])
		) {
			report(
				node,
				"parses with Day.js in the visitor's zone, where a date-only string becomes local midnight; use dayjs.utc(value)"
			)
		}

		if (
			!testFile &&
			ts.isCallExpression(node) &&
			node.expression.getText(sourceFile) === 'Intl.DateTimeFormat' &&
			!intlDateFormatFiles.has(relative)
		) {
			const parent = node.parent
			const readsResolvedOptions =
				ts.isPropertyAccessExpression(parent) && parent.expression === node && parent.name.text === 'resolvedOptions'
			if (!readsResolvedOptions) {
				report(node, 'calls Intl.DateTimeFormat outside the canonical formatter or an approved domain policy')
			}
		}
		if (
			!testFile &&
			ts.isCallExpression(node) &&
			node.expression.getText(sourceFile) === 'Intl.DateTimeFormat' &&
			intlDateFormatFiles.has(relative) &&
			relative !== canonicalFormatter &&
			!isVisitorLocaleFile(relative) &&
			node.arguments.length > 0 &&
			!namesLiteralLocaleAndZone(node.arguments)
		) {
			report(
				node,
				'calls Intl.DateTimeFormat without a literal locale and a timeZone; the server and the visitor would format differently'
			)
		}

		if (
			!testFile &&
			ts.isCallExpression(node) &&
			ts.isIdentifier(node.expression) &&
			node.expression.text === 'formatRelativeTime' &&
			!directRelativeTimeFiles.has(relative)
		) {
			report(node, 'calls formatRelativeTime without the shared hydration-safe RelativeTime component')
		}

		ts.forEachChild(node, visit)
	}

	visit(sourceFile)

	for (const legacyName of legacyNames) {
		if (new RegExp(`\\b${legacyName}\\b`).test(source)) violations.push(`${relative} references legacy ${legacyName}`)
	}
	return violations
}

if (process.argv.includes('--self-test')) {
	const cases: Array<{ name: string; relative?: string; source: string; violation: boolean }> = [
		{
			name: 'approved Intl with literal locale and zone',
			relative: 'src/containers/Exchanges/VenueChart.tsx',
			source: "new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' })",
			violation: false
		},
		{
			name: 'approved Intl without a zone',
			relative: 'src/containers/Exchanges/VenueChart.tsx',
			source: "new Intl.DateTimeFormat('en', { dateStyle: 'medium' })",
			violation: true
		},
		{
			name: 'approved Intl with the visitor locale',
			relative: 'src/containers/Exchanges/VenueChart.tsx',
			source: "new Intl.DateTimeFormat(undefined, { timeZone: 'UTC' })",
			violation: true
		},
		{
			name: 'approved visitor-locale surface',
			relative: 'src/containers/Investors/dashboards/hyperliquid/Stats.tsx',
			source: "new Date(ts).toLocaleString('en-US', { month: 'short' })",
			violation: false
		},
		{ name: 'canonical import', source: "import { formatDate } from '~/utils/dateFormat'", violation: false },
		{ name: 'barrel import', source: "import { formatDate } from '~/utils'", violation: true },
		{ name: 'local alias', source: "import { formatDate as pretty } from '~/utils/dateFormat'", violation: true },
		{
			name: 'relative local alias',
			source: "import { formatDate as pretty } from '../utils/dateFormat'",
			violation: true
		},
		{ name: 'namespace import', source: "import * as dates from '~/utils/dateFormat'", violation: true },
		{ name: 're-export', source: "export { formatDate } from '~/utils/dateFormat'", violation: true },
		{ name: 'Intl construction', source: 'new Intl.DateTimeFormat()', violation: true },
		{ name: 'callable Intl', source: "Intl.DateTimeFormat('en').format(new Date())", violation: true },
		{ name: 'timezone discovery', source: 'Intl.DateTimeFormat().resolvedOptions().timeZone', violation: false },
		{ name: 'locale method', source: 'new Date().toLocaleDateString()', violation: true },
		{ name: 'Day.js display', source: "import dayjs from 'dayjs'; dayjs().format('YYYY')", violation: true },
		{ name: 'Day.js relative', source: "import dayjs from 'dayjs'; dayjs().to(dayjs(value))", violation: true },
		{ name: 'aliased Day.js relative', source: "import d from 'dayjs'; d().fromNow()", violation: true },
		{ name: 'Day.js relative plugin', source: "import relativeTime from 'dayjs/plugin/relativeTime'", violation: true },
		{
			name: 'Day.js relative plugin suffix',
			source: "import relativeTime from 'dayjs/plugin/relativeTime.js'",
			violation: true
		},
		{ name: 'relative string', source: 'formatRelativeTime(value)', violation: true },
		{ name: 'local Day.js parse', source: "import dayjs from 'dayjs'; dayjs(item.date).unix()", violation: true },
		{ name: 'UTC Day.js parse', source: "import dayjs from 'dayjs'; dayjs.utc(item.date).unix()", violation: false },
		{ name: 'Day.js instant', source: "import dayjs from 'dayjs'; dayjs(timestamp * 1e3)", violation: false },
		{ name: 'Day.js now', source: "import dayjs from 'dayjs'; dayjs().subtract(30, 'day').unix()", violation: false },
		{ name: 'local Day.js year start', source: "import dayjs from 'dayjs'; dayjs().startOf('year')", violation: true },
		{
			name: 'converted year start',
			source: "import dayjs from 'dayjs'; dayjs().utc().startOf('year')",
			violation: false
		},
		{
			name: 'converted back to the local zone',
			source: "import dayjs from 'dayjs'; dayjs().utc().local().startOf('year')",
			violation: true
		},
		{
			name: 'named non-UTC zone',
			source: "import dayjs from 'dayjs'; dayjs().tz('America/Los_Angeles').startOf('year')",
			violation: true
		},
		{ name: 'guessed zone', source: "import dayjs from 'dayjs'; dayjs.tz(value).startOf('day')", violation: true },
		{
			name: 'named UTC zone',
			source: "import dayjs from 'dayjs'; dayjs().tz('UTC').startOf('year')",
			violation: false
		},
		{
			name: 'static UTC zone',
			source: "import dayjs from 'dayjs'; dayjs.tz(value, 'UTC').startOf('day')",
			violation: false
		},
		{ name: 'local Day.js hour start', source: "import dayjs from 'dayjs'; dayjs().startOf('hour')", violation: false },
		{
			name: 'local Day.js date key through a const',
			relative: 'src/containers/Downloads/csvDateFilter.ts',
			source: "import dayjs from 'dayjs'; const today = dayjs(); today.subtract(6, 'day').format('YYYY-MM-DD')",
			violation: true
		},
		{
			name: 'UTC Day.js date key through a const',
			relative: 'src/containers/Downloads/csvDateFilter.ts',
			source: "import dayjs from 'dayjs'; const today = dayjs.utc(); today.subtract(6, 'day').format('YYYY-MM-DD')",
			violation: false
		},
		{
			name: 'Day.js value of unknown zone',
			source: "import dayjs from 'dayjs'; function f(day: Dayjs) { return day.startOf('month') }",
			violation: false
		},
		{
			name: 'approved local calendar grid',
			relative: 'src/containers/Unlocks/calendarUtils.ts',
			source: "import dayjs from 'dayjs'; dayjs(dateParam).startOf('month')",
			violation: false
		}
	]
	const failures = cases.filter(({ name, relative, source, violation }) => {
		const file = relative ?? `src/policy-self-test/${name}.tsx`
		const actual = scanSource(file, path.basename(file), source).length > 0
		return actual !== violation
	})
	if (failures.length > 0) {
		console.error(`Date formatting policy self-test failed: ${failures.map(({ name }) => name).join(', ')}`)
		process.exit(1)
	}
	console.log(`Date formatting policy self-test passed (${cases.length} cases).`)
	process.exit(0)
}

const violations = policyTargetFiles(root, sourceRoot).flatMap((file) => {
	// Posix separators: every allowlist above is written with forward slashes, and on
	// Windows path.relative hands back backslashes, so every allowed file would fail.
	const relative = path.relative(root, file).split(path.sep).join('/')
	return scanSource(relative, file, fs.readFileSync(file, 'utf8'))
})

if (violations.length > 0) {
	console.error(`Date formatting policy violations:\n${violations.map((violation) => `- ${violation}`).join('\n')}`)
	process.exit(1)
}

console.log('Date formatting policy passed.')
