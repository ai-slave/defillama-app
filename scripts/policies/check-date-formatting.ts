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
	'src/components/ECharts/MultiSeriesChart/eventRail.ts',
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
	'src/containers/DAT/Company.tsx',
	'src/containers/Downloads/DateRangePicker.tsx',
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

// These callers provide their own client clock. Other UI should use RelativeTime,
// which owns SSR fallback, exact timestamp disclosure, and ticking behavior.
const directRelativeTimeFiles = new Set([
	canonicalFormatter,
	relativeTimeComponent,
	'src/containers/Account/Team/TeamInvitesCard.tsx',
	'src/containers/Articles/editor/ArticleEditorClient.tsx'
])

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

function scanSource(relative: string, file: string, source: string): string[] {
	const violations: string[] = []
	const sourceFile = ts.createSourceFile(
		file,
		source,
		ts.ScriptTarget.Latest,
		true,
		file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
	)
	const testFile = isTestFile(relative)
	const dayjsBindings = new Set<string>()

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
	const cases: Array<{ name: string; source: string; violation: boolean }> = [
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
		{ name: 'relative string', source: 'formatRelativeTime(value)', violation: true }
	]
	const failures = cases.filter(({ name, source, violation }) => {
		const actual = scanSource(`src/policy-self-test/${name}.tsx`, `${name}.tsx`, source).length > 0
		return actual !== violation
	})
	if (failures.length) {
		console.error(`Date formatting policy self-test failed: ${failures.map(({ name }) => name).join(', ')}`)
		process.exit(1)
	}
	console.log(`Date formatting policy self-test passed (${cases.length} cases).`)
	process.exit(0)
}

const violations = policyTargetFiles(root, sourceRoot).flatMap((file) => {
	const relative = path.relative(root, file)
	return scanSource(relative, file, fs.readFileSync(file, 'utf8'))
})

if (violations.length) {
	console.error(`Date formatting policy violations:\n${violations.map((violation) => `- ${violation}`).join('\n')}`)
	process.exit(1)
}

console.log('Date formatting policy passed.')
