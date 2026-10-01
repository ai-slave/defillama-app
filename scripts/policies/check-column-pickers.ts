import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { policyTargetFiles } from '../lib/sourceFiles'

/*
 * Column picker policy. Every table marks the column that names its rows with `enableHiding: false`, and its
 * column picker builds the options from `getHideableColumns` (or `getColumnSelectState`, or renders
 * `TableColumnSelect`) in src/components/Table/search/columnSelect.ts. That function leaves the identity column out
 * of the options and throws when a table has none, so "Only" or an uncheck can never leave rows without a name.
 *
 * This script finds pickers by their `label="Columns"` and fails a file that renders one without going through
 * that function. A picker under another label is not caught; name it "Columns" or route it the same way.
 */

const root = path.resolve(import.meta.dirname, '../..')
const sourceRoot = path.join(root, 'src')

const PICKER_SOURCES = new Set(['getHideableColumns', 'getColumnSelectState', 'TableColumnSelect'])

/** "Columns" controls whose options are not table leaf columns, with the reason. */
const allowedFiles = new Map<string, string>([
	[
		'src/containers/Tokens/index.tsx',
		'options are TOKENS_HIDEABLE_COLUMN_SPECS, which leaves out the rank and name columns (enableHiding: false)'
	],
	[
		'src/containers/Yields/Filters/ColumnsSelect.tsx',
		'adds optional extra columns through the URL; pool and project always show'
	],
	['src/pages/top-protocols.tsx', 'filters protocol categories through the URL; the chain column always shows']
])

function isColumnsLabel(node: ts.JsxAttribute): boolean {
	if (node.name.getText() !== 'label' || !node.initializer) return false
	if (ts.isStringLiteral(node.initializer)) return node.initializer.text === 'Columns'
	const expression = ts.isJsxExpression(node.initializer) ? node.initializer.expression : undefined
	return expression != null && ts.isStringLiteralLike(expression) && expression.text === 'Columns'
}

export function scanSource(relative: string, source: string): Array<string> {
	if (allowedFiles.has(relative) || relative.includes('/__tests__/')) return []
	const sourceFile = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
	const pickerLines: Array<number> = []
	let usesPickerSource = false
	const visit = (node: ts.Node) => {
		if (ts.isJsxAttribute(node) && isColumnsLabel(node)) {
			pickerLines.push(sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1)
		}
		if (ts.isIdentifier(node) && PICKER_SOURCES.has(node.text)) usesPickerSource = true
		ts.forEachChild(node, visit)
	}
	visit(sourceFile)
	if (usesPickerSource) return []
	return pickerLines.map(
		(line) =>
			`${relative}:${line} renders a Columns picker without getHideableColumns; build its options from the table's leaf columns through src/components/Table/search/columnSelect.ts`
	)
}

if (process.argv.includes('--self-test')) {
	const cases: Array<{ name: string; relative?: string; source: string; violation: boolean }> = [
		{
			name: 'hand-built picker',
			source: 'export const Picker = () => <SelectWithCombobox allValues={columnOptions} label="Columns" />',
			violation: true
		},
		{
			name: 'hand-built picker with an expression label',
			source: "export const Picker = () => <SelectWithCombobox allValues={columnOptions} label={'Columns'} />",
			violation: true
		},
		{
			name: 'picker built from getHideableColumns',
			source:
				'const options = getHideableColumns(table.getAllLeafColumns())\nexport const Picker = () => <SelectWithCombobox allValues={options} label="Columns" />',
			violation: false
		},
		{
			name: 'picker built from getColumnSelectState',
			source:
				'const state = getColumnSelectState(columns, visibility)\nexport const Picker = () => <SelectWithCombobox allValues={state.options} label="Columns" />',
			violation: false
		},
		{
			name: 'another label',
			source: 'export const Picker = () => <SelectWithCombobox allValues={chains} label="Chains" />',
			violation: false
		},
		{
			name: 'allowed file',
			relative: 'src/pages/top-protocols.tsx',
			source: 'export const Picker = () => <SelectWithCombobox allValues={categories} label="Columns" />',
			violation: false
		}
	]
	const failures = cases.filter(({ name, relative, source, violation }) => {
		const file = relative ?? `src/policy-self-test/${name.replace(/\W+/g, '-')}.tsx`
		return scanSource(file, source).length > 0 !== violation
	})
	if (failures.length > 0) {
		console.error(`Column picker policy self-test failed: ${failures.map(({ name }) => name).join(', ')}`)
		process.exit(1)
	}
	console.log(`Column picker policy self-test passed (${cases.length} cases).`)
	process.exit(0)
}

const violations = policyTargetFiles(root, sourceRoot).flatMap((file) => {
	const relative = path.relative(root, file).split(path.sep).join('/')
	return scanSource(relative, fs.readFileSync(file, 'utf8'))
})

if (violations.length > 0) {
	console.error(`Column picker policy violations:\n${violations.map((violation) => `- ${violation}`).join('\n')}`)
	process.exit(1)
}

console.log('Column picker policy passed.')
