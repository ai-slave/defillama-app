import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { policyTargetFiles } from '../lib/sourceFiles'

/*
 * Chart export policy. A reader can download every chart as .csv and .png (design.md → Charts).
 *
 * The types do most of the work: every `MultiSeriesChart`, `PieChart` and headless renderer takes a required
 * `exportButtons` (src/components/ChartExport/types.ts). A chart draws its own buttons (`'auto'` or export names), takes
 * the handle its page's buttons also take, or states `{ omit: reason }`. What the types cannot see is whether a handle
 * reaches both ends, so this script checks it per handle:
 *
 * - every handle a file creates with `useGetChartInstance()` and gives a chart as `exportButtons` also reaches
 *   `ChartExportButtons` (or `ChartCsvExportButton` / `ChartPngExportButton`) as `chart`, so its buttons render;
 * - every `chart` on export buttons names a handle that some chart or wrapper in the file takes as `exportButtons`
 *   (or that a hand-built chart reports to with `handleChartReady`), so the buttons export a drawn chart.
 *
 * So that both ends stay visible, a created handle travels only as `exportButtons` and `chart`: passing it on under
 * another prop name, storing it in an object or handing it to a function fails, and a component that draws both the
 * chart and its buttons creates its own handle. Reading its members (`.chartInstance` for a Pro card menu,
 * `.handleChartReady` for `onReady`) is fine. A handle a file receives as an `exportButtons` prop is checked in the
 * file that creates it. Names resolve to their declarations, so a same-named prop elsewhere in the file is not the
 * handle.
 *
 * It also fails a `showPng` or `showCsv` set to a literal `false` (when one format has nothing to export, such as a
 * sankey with no table, render the one button that has), and a renderer import under another name, so one name finds
 * every chart of a kind.
 */

const root = path.resolve(import.meta.dirname, '../..')
const sourceRoot = path.join(root, 'src')

/** Renderer module → the name its import binds. */
const RENDERER_NAMES = new Map<string, string>([
	['~/components/ECharts/MultiSeriesChart', 'MultiSeriesChart'],
	['~/components/ECharts/PieChart', 'PieChart'],
	['~/components/ECharts/HBarChart', 'HBarChart'],
	['~/components/ECharts/TreemapChart', 'TreemapChart'],
	['~/components/ECharts/TreemapChart/Builder', 'BuilderTreemapChart'],
	['~/components/ECharts/TreemapChart/Market', 'MarketTreemapChart'],
	['~/components/ECharts/ScatterChart', 'ScatterChart'],
	['~/components/ECharts/CandlestickChart', 'CandlestickChart'],
	['~/components/ECharts/SankeyChart', 'SankeyChart'],
	['~/components/ECharts/NetflowChart', 'NetflowChart'],
	['~/components/ECharts/RadarChart', 'RadarChart'],
	['~/components/ECharts/SparklineChart', 'SparklineChart'],
	['~/components/ECharts/BarSparkline', 'BarSparkline']
])
const EXPORT_PARTS = new Set(['ChartExportButtons', 'ChartCsvExportButton', 'ChartPngExportButton'])

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
	return sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
}

/** The module a binding comes from: a static import, or `lazy`/`dynamic` around `import('…')`. */
function importedModule(node: ts.Node): string | undefined {
	let found: string | undefined
	const visit = (child: ts.Node) => {
		if (found) return
		if (
			ts.isCallExpression(child) &&
			child.expression.kind === ts.SyntaxKind.ImportKeyword &&
			child.arguments[0] &&
			ts.isStringLiteralLike(child.arguments[0])
		) {
			found = child.arguments[0].text
			return
		}
		ts.forEachChild(child, visit)
	}
	visit(node)
	return found
}

function bindingNames(name: ts.BindingName): Array<string> {
	if (ts.isIdentifier(name)) return [name.text]
	const names: Array<string> = []
	for (const element of name.elements) if (!ts.isOmittedExpression(element)) names.push(...bindingNames(element.name))
	return names
}

/** The declaration an identifier reads: the nearest enclosing function (or the file) that declares its name. */
function declarationOf(identifier: ts.Identifier): ts.Node | undefined {
	for (let scope: ts.Node | undefined = identifier.parent; scope; scope = scope.parent) {
		if (!ts.isFunctionLike(scope) && !ts.isSourceFile(scope)) continue
		if (ts.isFunctionLike(scope)) {
			for (const parameter of scope.parameters) {
				if (bindingNames(parameter.name).includes(identifier.text)) return parameter
			}
		}
		let found: ts.Node | undefined
		const visit = (node: ts.Node) => {
			if (found || (node !== scope && ts.isFunctionLike(node))) return
			if (ts.isVariableDeclaration(node) && bindingNames(node.name).includes(identifier.text)) found = node
			else ts.forEachChild(node, visit)
		}
		ts.forEachChild(scope, visit)
		if (found) return found
	}
	return undefined
}

/** Whether an identifier reads a variable, rather than naming a field (`data.x`, `{ x: … }`) or a JSX attribute. */
function isReference(node: ts.Identifier): boolean {
	const parent = node.parent
	return !(
		(ts.isPropertyAccessExpression(parent) && parent.name === node) ||
		(ts.isPropertyAssignment(parent) && parent.name === node) ||
		(ts.isBindingElement(parent) && parent.propertyName === node) ||
		ts.isJsxAttribute(parent) ||
		ts.isPropertySignature(parent)
	)
}

/** The `const handle = useGetChartInstance()` an identifier reads, if it reads one. */
function createdHandleOf(node: ts.Node): ts.VariableDeclaration | undefined {
	if (!ts.isIdentifier(node) || !isReference(node)) return undefined
	const declaration = declarationOf(node)
	return declaration &&
		ts.isVariableDeclaration(declaration) &&
		declaration.initializer &&
		ts.isCallExpression(declaration.initializer) &&
		declaration.initializer.expression.getText() === 'useGetChartInstance'
		? declaration
		: undefined
}

export function scanSource(relative: string, source: string): Array<string> {
	if (relative.includes('/__tests__/') || relative.startsWith('src/components/ECharts/')) return []
	const sourceFile = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
	const violations: Array<string> = []
	// Per handle this file creates: where a chart takes it and where buttons take it. A handle the file receives (a
	// prop or parameter) is checked where its caller creates it.
	const chartEnds = new Map<ts.VariableDeclaration, ts.Node>()
	const buttonEnds = new Map<ts.VariableDeclaration, ts.Node>()

	const visit = (node: ts.Node) => {
		if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
			const expected = RENDERER_NAMES.get(node.moduleSpecifier.text)
			const binding = node.importClause?.name?.text
			if (expected && binding && binding !== expected) {
				violations.push(
					`${relative}:${lineOf(sourceFile, node)} imports ${expected} as ${binding}; import it as ${expected}`
				)
			}
		}
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
			const importPath = importedModule(node.initializer)
			const expected = importPath ? RENDERER_NAMES.get(importPath) : undefined
			if (expected && node.name.text !== expected) {
				violations.push(
					`${relative}:${lineOf(sourceFile, node)} loads ${expected} as ${node.name.text}; name it ${expected}`
				)
			}
		}
		if (ts.isJsxAttribute(node)) {
			const name = node.name.getText()
			const expression =
				node.initializer && ts.isJsxExpression(node.initializer) ? node.initializer.expression : undefined
			const tag = node.parent.parent.tagName.getText()
			if ((name === 'showPng' || name === 'showCsv') && expression?.kind === ts.SyntaxKind.FalseKeyword) {
				violations.push(
					`${relative}:${lineOf(sourceFile, node)} turns off ${name === 'showPng' ? '.png' : '.csv'} export; export both formats, or render the one button that has something to export`
				)
			}
			const handle = expression && createdHandleOf(expression)
			if (name === 'exportButtons' && handle) chartEnds.set(handle, node)
			// The shared parts, or a page's own wrapper around them (a menu slot, a styled button).
			if (name === 'chart' && (EXPORT_PARTS.has(tag) || /Export/.test(tag))) {
				if (handle) buttonEnds.set(handle, node)
				else if (!expression || !(ts.isIdentifier(expression) || ts.isPropertyAccessExpression(expression))) {
					violations.push(
						`${relative}:${lineOf(sourceFile, node)} gives ${tag} a chart that is not a handle; pass the handle the chart takes as exportButtons`
					)
				}
			}
		}
		// A hand-built chart reporting its instance (`handle.handleChartReady(instance)`, not a reset to null) is the
		// chart end.
		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			node.expression.name.text === 'handleChartReady' &&
			node.arguments[0]?.kind !== ts.SyntaxKind.NullKeyword
		) {
			const handle = createdHandleOf(node.expression.expression)
			if (handle) chartEnds.set(handle, node)
		}
		// A created handle travels only as `exportButtons` and `chart`; under any other name (a prop, an object field,
		// an argument) this check could no longer see whether it reaches both ends. Reading its members
		// (`.chartInstance` for a card menu, `.handleChartReady` for `onReady`) and listing it as a dependency are fine.
		if (ts.isIdentifier(node) && createdHandleOf(node)) {
			const parent = node.parent
			const attribute = ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent) ? parent.parent : undefined
			const attributeName = attribute?.name.getText()
			const allowed =
				(ts.isVariableDeclaration(parent) && parent.name === node) ||
				(ts.isPropertyAccessExpression(parent) && parent.expression === node) ||
				(ts.isArrayLiteralExpression(parent) && ts.isCallExpression(parent.parent)) ||
				attributeName === 'exportButtons' ||
				attributeName === 'chart'
			if (!allowed) {
				violations.push(
					`${relative}:${lineOf(sourceFile, node)} passes the export handle ${node.text} on as ${attributeName ?? 'a value'}; pass it only as exportButtons (to the chart) and chart (to the buttons), and let a component that draws both create its own`
				)
			}
		}
		ts.forEachChild(node, visit)
	}
	visit(sourceFile)

	for (const [handle, node] of chartEnds) {
		if (!buttonEnds.has(handle)) {
			violations.push(
				`${relative}:${lineOf(sourceFile, node)} gives a chart the export handle ${handle.name.getText()} but renders no buttons with chart={${handle.name.getText()}}; render ChartExportButtons, or pass { omit: reason }`
			)
		}
	}
	for (const [handle, node] of buttonEnds) {
		if (!chartEnds.has(handle)) {
			violations.push(
				`${relative}:${lineOf(sourceFile, node)} renders export buttons for ${handle.name.getText()}, which no chart in this file takes as exportButtons; pass the same handle to the chart`
			)
		}
	}
	return violations
}

if (process.argv.includes('--self-test')) {
	const cases: Array<{ name: string; source: string; violation: boolean }> = [
		{
			name: 'handle reaching chart and buttons',
			source:
				'export function A() {\n\tconst chartExport = useGetChartInstance()\n\treturn <><ChartExportButtons chart={chartExport} csvSource={s} /><HBarChart exportButtons={chartExport} /></>\n}',
			violation: false
		},
		{
			name: 'handle given to a chart without buttons',
			source:
				'export function A() {\n\tconst chartExport = useGetChartInstance()\n\treturn <HBarChart exportButtons={chartExport} />\n}',
			violation: true
		},
		{
			name: 'buttons for a handle no chart takes',
			source:
				'export function A() {\n\tconst chartExport = useGetChartInstance()\n\treturn <ChartExportButtons chart={chartExport} csvSource={s} />\n}',
			violation: true
		},
		{
			name: 'buttons given a hand-built chart',
			source: 'export const A = () => <ChartExportButtons chart={{ chartInstance: get }} csvSource={s} />',
			violation: true
		},
		{
			name: 'wrapper forwarding the handle it receives',
			source: 'export const A = ({ exportButtons }) => <HBarChart exportButtons={exportButtons} />',
			violation: false
		},
		{
			name: 'handle held on a list entry',
			source:
				'export function A() {\n\treturn rows.map((row) => <><ChartExportButtons chart={row.chartExport} /><HBarChart exportButtons={row.chartExport} /></>)\n}',
			violation: false
		},
		{
			name: 'hand-built chart reporting to its handle',
			source:
				'export function A() {\n\tconst chartExport = useGetChartInstance()\n\tuseEffect(() => chartExport.handleChartReady(init()), [])\n\treturn <ChartExportButtons chart={chartExport} />\n}',
			violation: false
		},
		{
			name: 'export slot receiving the handle',
			source: 'export const Slot = ({ chart }) => <ChartPngExportButton chart={chart} />',
			violation: false
		},
		{
			name: 'handle passed on under another prop name',
			source:
				'export function A() {\n\tconst chartExport = useGetChartInstance()\n\treturn <Content handle={chartExport} />\n}',
			violation: true
		},
		{
			name: 'handle stored on a list entry',
			source:
				'export function A() {\n\tconst chartExport = useGetChartInstance()\n\tconst rows = [{ handle: chartExport }]\n\treturn rows.map((row) => <HBarChart exportButtons={row.handle} />)\n}',
			violation: true
		},
		{
			name: 'handle read by a card menu and listed as a dependency',
			source:
				'export function A() {\n\tconst chartExport = useGetChartInstance()\n\tconst reset = useCallback(() => chartExport.handleChartReady(null), [chartExport])\n\treturn <><Menu image={() => chartExport.chartInstance()} /><PieChart onReady={chartExport.handleChartReady} exportButtons={MENU} /></>\n}',
			violation: false
		},
		{
			name: 'a same-named prop in another component is not the handle',
			source:
				'function Card({ chartExport }) {\n\treturn <><ChartExportButtons chart={chartExport} /><HBarChart exportButtons={chartExport} /></>\n}\nexport function A() {\n\tconst chartExport = useGetChartInstance()\n\treturn <><ChartExportButtons chart={chartExport} /><PieChart exportButtons={chartExport} /></>\n}',
			violation: false
		},
		{
			name: 'omitted export',
			source: "export const A = () => <HBarChart exportButtons={{ omit: 'preview inside a dialog' }} />",
			violation: false
		},
		{
			name: 'png turned off on the buttons',
			source: 'export const A = () => <ChartExportButtons showPng={false} />',
			violation: true
		},
		{
			name: 'png following a view',
			source: "export const A = () => <ChartExportButtons showPng={view !== 'table'} />",
			violation: false
		},
		{ name: 'renamed import', source: "import Chart from '~/components/ECharts/PieChart'", violation: true },
		{
			name: 'renamed lazy import',
			source: "const Chart = lazy(() => import('~/components/ECharts/HBarChart'))",
			violation: true
		},
		{
			name: 'lazy import under its own name',
			source: "const HBarChart = lazy(() => import('~/components/ECharts/HBarChart'))",
			violation: false
		}
	]
	const failures = cases.filter(
		({ name, source, violation }) =>
			scanSource(`src/policy-self-test/${name.replace(/\W+/g, '-')}.tsx`, source).length > 0 !== violation
	)
	if (failures.length > 0) {
		console.error(`Chart export policy self-test failed: ${failures.map(({ name }) => name).join(', ')}`)
		process.exit(1)
	}
	console.log(`Chart export policy self-test passed (${cases.length} cases).`)
	process.exit(0)
}

const violations = policyTargetFiles(root, sourceRoot).flatMap((file) => {
	const relative = path.relative(root, file).split(path.sep).join('/')
	return scanSource(relative, fs.readFileSync(file, 'utf8'))
})

if (violations.length > 0) {
	console.error(`Chart export policy violations:\n${violations.map((violation) => `- ${violation}`).join('\n')}`)
	process.exit(1)
}

console.log('Chart export policy passed.')
