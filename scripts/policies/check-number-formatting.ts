import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { policyTargetFiles } from '../lib/sourceFiles'

const root = path.resolve(import.meta.dirname, '../..')
const sourceRoot = path.join(root, 'src')
const canonicalFormatter = 'src/utils/numberFormat.ts'
const dateIdentifierFiles = new Set([
	'src/containers/Articles/editor/RevisionHistoryDrawer.tsx',
	'src/containers/Articles/editor/ArticleEditorUtils.ts',
	'src/containers/Articles/renderer/ArticleRenderer.tsx',
	'src/containers/Articles/landing/utils.ts'
])

// Fixed decimal text is reserved for non-locale protocols: serialized output,
// geometry/CSS, byte and duration labels, and editable numeric input drafts.
const fixedFormattingFiles = new Set([
	canonicalFormatter,
	'src/utils/numberFormat.test.ts',
	'src/utils/index.tsx',
	'src/containers/Account/ApiAccessCard.tsx',
	'src/containers/AdapterMetrics/utils.ts',
	'src/containers/Articles/upload/PdfUploadButton.tsx',
	'src/containers/Downloads/sql/format.ts',
	'src/containers/Exchanges/MiniSparkline.tsx',
	'src/containers/LlamaAI/components/AlertsModal.tsx',
	'src/containers/LlamaAI/components/PastedContentModal.tsx',
	'src/containers/LlamaAI/components/ResponseControls.tsx',
	'src/containers/LlamaAI/components/SettingsModal.tsx',
	'src/containers/LlamaAI/components/input/ImageUpload.tsx',
	'src/containers/LlamaAI/projects/format.ts',
	'src/containers/ProDashboard/components/UnifiedTable/index.tsx',
	'src/containers/ProDashboard/components/UnifiedTable/utils/csvExport.ts',
	'src/containers/ProDashboard/components/datasets/AggregatorsDataset/index.tsx',
	'src/containers/ProDashboard/components/datasets/BridgeAggregatorsDataset/index.tsx',
	'src/containers/ProDashboard/components/datasets/DexsDataset/index.tsx',
	'src/containers/ProDashboard/components/datasets/OptionsDataset/index.tsx',
	'src/containers/ProDashboard/components/datasets/PerpsDataset/index.tsx',
	'src/containers/Stablecoins/queries.server.tsx',
	'src/containers/Stablecoins/utils.ts',
	'src/containers/Yields/Tables/Sparkline.tsx',
	'src/server/datasetSnapshots/publish.server.ts'
])

const violations: Array<string> = []

const numericDisplayFormatters = new Set(['formatNumber', 'formatCompactNumber', 'formatFixedNumber', 'formatRatio'])
const optionFormatters = new Set(['formatNumber', 'formatCompactNumber', 'formatUsd', 'formatRatio', 'formatPercent'])
const canonicalFormatterExports = new Set([
	...numericDisplayFormatters,
	'formatPercent',
	'formatPercentChange',
	'formatUsd',
	'roundNumber'
])

function formatterName(node: ts.CallExpression): string | null {
	return ts.isIdentifier(node.expression) && numericDisplayFormatters.has(node.expression.text)
		? node.expression.text
		: null
}

function propertyName(property: ts.ObjectLiteralElementLike): string | null {
	if (!('name' in property) || !property.name) return null
	return ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : null
}

function literalOption(options: ts.ObjectLiteralExpression, name: string): string | number | boolean | null {
	const property = options.properties.find((candidate) => propertyName(candidate) === name)
	if (!property || !ts.isPropertyAssignment(property)) return null
	const value = property.initializer
	if (ts.isStringLiteral(value) || ts.isNumericLiteral(value)) return value.text
	if (value.kind === ts.SyntaxKind.TrueKeyword) return true
	if (value.kind === ts.SyntaxKind.FalseKeyword) return false
	return null
}

function hasOption(options: ts.ObjectLiteralExpression, name: string): boolean {
	return options.properties.some((property) => propertyName(property) === name)
}

/** Returns literal UI text immediately following an expression, if any. */
function followingLiteral(node: ts.Expression): string | null {
	let current: ts.Node = node
	while (current.parent) {
		const parent = current.parent
		if (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || ts.isNonNullExpression(parent)) {
			current = parent
			continue
		}
		if (ts.isTemplateSpan(parent) && parent.expression === current) return parent.literal.text
		if (ts.isBinaryExpression(parent) && parent.left === current && ts.isStringLiteralLike(parent.right)) {
			return parent.right.text
		}
		if (ts.isJsxExpression(parent)) {
			const container = parent.parent
			if (ts.isJsxElement(container) || ts.isJsxFragment(container)) {
				const index = container.children.indexOf(parent)
				const next = container.children[index + 1]
				return next && ts.isJsxText(next) ? next.text : null
			}
		}
		break
	}
	return null
}

for (const file of policyTargetFiles(root, sourceRoot)) {
	const relative = path.relative(root, file)
	const source = fs.readFileSync(file, 'utf8')
	const sourceFile = ts.createSourceFile(
		file,
		source,
		ts.ScriptTarget.Latest,
		true,
		file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
	)

	function report(node: ts.Node, message: string) {
		const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
		violations.push(`${relative}:${line + 1} ${message}`)
	}

	function visit(node: ts.Node) {
		if (
			ts.isImportDeclaration(node) &&
			ts.isStringLiteral(node.moduleSpecifier) &&
			node.moduleSpecifier.text === '~/utils' &&
			node.importClause?.namedBindings &&
			ts.isNamedImports(node.importClause.namedBindings)
		) {
			for (const element of node.importClause.namedBindings.elements) {
				if (canonicalFormatterExports.has((element.propertyName ?? element.name).text)) {
					report(element, `${element.name.text} must be imported directly from ~/utils/numberFormat`)
				}
			}
		}
		if (ts.isCallExpression(node)) {
			const name = formatterName(node)
			if (name === 'formatFixedNumber' && !fixedFormattingFiles.has(relative)) {
				report(node, 'uses fixed decimal formatting for a display value; use a canonical semantic formatter')
			}
			const suffix = name ? followingLiteral(node) : null
			if (suffix?.startsWith('%')) {
				report(node, `${name} manually appends % instead of using formatPercent or formatPercentChange`)
			}
			if (suffix && /^\s*[KMBTkmbt](?:\s|$|[),</])/.test(suffix)) {
				report(node, `${name} manually appends a compact suffix instead of using formatCompactNumber or formatUsd`)
			}

			const optionFormatter = ts.isIdentifier(node.expression) && optionFormatters.has(node.expression.text)
			const options = optionFormatter && node.arguments[1]
			if (options && ts.isObjectLiteralExpression(options)) {
				const formatter = (node.expression as ts.Identifier).text
				if (options.properties.length === 0) report(options, `${formatter} passes an empty options object`)
				if (literalOption(options, 'minimumFractionDigits') === '0') {
					report(options, `${formatter} redundantly sets minimumFractionDigits to its default of 0`)
				}
				if (literalOption(options, 'useGrouping') === true) {
					report(options, `${formatter} redundantly enables grouping, which is already the default`)
				}
				if (literalOption(options, 'signDisplay') === 'auto') {
					report(options, `${formatter} redundantly uses the default signDisplay`)
				}
				if (literalOption(options, 'compact') === false) {
					report(options, `${formatter} redundantly disables compact formatting`)
				}
				if (literalOption(options, 'compactSuffix') === 'uppercase') {
					report(options, `${formatter} redundantly uses the default uppercase compact suffix`)
				}
				if (Number(literalOption(options, 'minimumCompactValue')) === 1000) {
					report(options, `${formatter} redundantly uses the default compact threshold of 1,000`)
				}
				if (
					formatter === 'formatRatio' &&
					literalOption(options, 'maximumFractionDigits') === '2' &&
					!hasOption(options, 'minimumFractionDigits') &&
					!hasOption(options, 'maximumSignificantDigits')
				) {
					report(options, 'formatRatio redundantly uses its default maximumFractionDigits of 2')
				}
				if (
					formatter === 'formatPercent' &&
					literalOption(options, 'smallValueDisplay') === 'threshold' &&
					!hasOption(options, 'minimumFractionDigits')
				) {
					report(options, 'formatPercent redundantly requests threshold display without fixed trailing digits')
				}
			}
		}
		if (
			ts.isNewExpression(node) &&
			node.expression.getText(sourceFile) === 'Intl.NumberFormat' &&
			relative !== canonicalFormatter
		) {
			report(node, 'constructs Intl.NumberFormat outside the canonical formatter')
		}
		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			node.expression.name.text === 'toFixed' &&
			relative !== canonicalFormatter
		) {
			report(node, 'calls toFixed outside the canonical formatter')
		}
		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			node.expression.name.text === 'toLocaleString'
		) {
			const receiver = node.expression.expression
			const isDateConstruction = ts.isNewExpression(receiver) && receiver.expression.getText(sourceFile) === 'Date'
			const isKnownDateIdentifier =
				dateIdentifierFiles.has(relative) &&
				ts.isIdentifier(receiver) &&
				(receiver.text === 'date' || receiver.text === 'd')
			const isBigIntResultCell =
				relative === 'src/containers/Downloads/sql/ResultsGrid.tsx' &&
				ts.isIdentifier(receiver) &&
				receiver.text === 'value'
			if (!isDateConstruction && !isKnownDateIdentifier && !isBigIntResultCell) {
				report(node, 'uses toLocaleString for a non-date value')
			}
		}
		ts.forEachChild(node, visit)
	}

	visit(sourceFile)

	for (const legacyName of ['formattedNum', 'abbreviateNumber', 'formatNum', 'formatCanonicalNumber']) {
		if (new RegExp(`\\b${legacyName}\\b`).test(source)) violations.push(`${relative} references legacy ${legacyName}`)
	}
}

if (violations.length > 0) {
	console.error(`Number formatting policy violations:\n${violations.map((violation) => `- ${violation}`).join('\n')}`)
	process.exit(1)
}

console.log('Number formatting policy passed.')
