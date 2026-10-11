import { existsSync, readdirSync, readFileSync } from 'node:fs'
import ts from 'typescript'
import { expect, test } from 'vitest'
import { parseComponentTable } from '../componentTable'

/* The design system page shows every finished part, so a part that lands without an example fails here.

   A part is an exported function whose name starts with an uppercase letter, from:
   - a src/ui module (hooks, helpers and style recipes are lowercase, constants are not functions);
   - a src/components file that design.md's "Which component for which job" table lists, for the names its Use
     column gives (src/components parts are on the page only where that table names them).
   It counts as shown when a file under src/containers/DesignSystem imports it. Every part on the page is named by a
   design.md row, which heads its family page, or is listed in NOT_IN_TABLE with why. */

const PAGE_DIR = 'src/containers/DesignSystem'

/** Parts a reader never meets alone, with where the page shows them instead. */
const NOT_SHOWN_ALONE: Record<string, string> = {
	'src/ui/Button.tsx#ReservedLabel': 'the reserved width inside Button pending and StableLabel; shown through them',
	'src/ui/Watermark.tsx#Watermark': 'drawn by KeyMetricsPanel and SmolStatCard; shown through them',
	'src/ui/PopoverSurface.tsx#DrawerDismiss': 'renders only in phone drawers; phone-only states get a note',
	'src/ui/PopoverSurface.tsx#NestedDrawerHeader': 'renders only in phone drawers; phone-only states get a note',
	'src/ui/NestedMenu.tsx#NestedMenu':
		'the phone filter menu ResponsiveFilterLayout renders below sm; phone-only states get a note',
	'src/ui/NestedMenu.tsx#NestedMenuToggle': 'an on/off row inside the phone filter menu; phone-only states get a note',
	'src/ui/ComboboxSelectTrigger.tsx#ComboboxSelectTrigger': 'the trigger every picker renders; shown through them',
	'src/components/TokenLogo/index.tsx#TokenLogo':
		'finds a logo URL by name and draws Logo; the page shows Logo, since its demos use local images',
	'src/components/Select/UrlSelect.tsx#UrlSelect': 'Select bound to the URL; the page shows Select',
	'src/components/Select/UrlSelect.tsx#UrlSelectWithCombobox':
		'SelectWithCombobox bound to the URL; the page shows SelectWithCombobox'
}

/** Parts no design.md row names in its Use cell, with why. Each heads no row of its family's "Which one" table. */
const NOT_IN_TABLE: Record<string, string> = {
	ChartPanelExportShellLoading: 'the loading shell of a chart image export; no job picks it, the export renders it',
	SurfaceLoadingOverlay: 'the overlay a refetching surface lays over its last data; no job picks it on its own',
	DialogSearchHeader: 'a piece of Dialog, shown on its own as the palette header; the Dialog row covers it',
	DialogCloseButton: 'a piece of Dialog for a dialog that draws its own header row; the Dialog row covers it'
}

function parse(file: string) {
	const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
	return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, kind)
}

function exportedParts(file: string): Array<string> {
	const parts: Array<string> = []
	for (const statement of parse(file).statements) {
		if (
			ts.isFunctionDeclaration(statement) &&
			statement.name &&
			/^[A-Z]/.test(statement.name.text) &&
			statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
		)
			parts.push(`${file}#${statement.name.text}`)
	}
	return parts
}

const ROWS = parseComponentTable(readFileSync('design.md', 'utf8'))

function finishedParts(): Array<string> {
	const parts: Array<string> = []
	for (const name of readdirSync('src/ui')) {
		if (/\.tsx?$/.test(name)) parts.push(...exportedParts(`src/ui/${name}`))
	}
	for (const { names, files } of ROWS) {
		const named = new Set(names)
		for (const [, path] of files.matchAll(/`(src\/components\/[^`]+)`/g)) {
			const modules = path.endsWith('/')
				? readdirSync(path)
						.filter((name) => name.endsWith('.tsx'))
						.map((name) => path + name)
				: /\.tsx?$/.test(path)
					? [path]
					: []
			for (const modulePath of modules) {
				for (const part of exportedParts(modulePath)) {
					if (named.has(part.split('#')[1])) parts.push(part)
				}
			}
		}
	}
	return parts
}

function pageFiles(dir = PAGE_DIR): Array<string> {
	const files: Array<string> = []
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (entry.name !== '__tests__') files.push(...pageFiles(`${dir}/${entry.name}`))
		} else if (/\.tsx?$/.test(entry.name)) files.push(`${dir}/${entry.name}`)
	}
	return files
}

/** Every `file#name` the page imports through `~/`. */
function shownOnPage(): Set<string> {
	const shown = new Set<string>()
	for (const file of pageFiles()) {
		for (const statement of parse(file).statements) {
			if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
			const specifier = statement.moduleSpecifier.text
			if (!specifier.startsWith('~/')) continue
			const base = `src/${specifier.slice(2)}`
			const modulePath = [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`].find((candidate) => existsSync(candidate))
			const bindings = statement.importClause?.namedBindings
			if (!modulePath || !bindings || !ts.isNamedImports(bindings)) continue
			for (const element of bindings.elements) shown.add(`${modulePath}#${(element.propertyName ?? element.name).text}`)
		}
	}
	return shown
}

test('every finished part is on the design system page', () => {
	const shown = shownOnPage()
	const missing = finishedParts().filter((part) => !shown.has(part) && !NOT_SHOWN_ALONE[part])
	expect(missing).toEqual([])
})

test('parts not shown alone name parts the page does not import', () => {
	const shown = shownOnPage()
	const parts = new Set(finishedParts())
	const stale = Object.keys(NOT_SHOWN_ALONE).filter((part) => shown.has(part) || !parts.has(part))
	expect(stale).toEqual([])
})

test('every part links a file that exists and is named by a row of the component table', () => {
	const named = new Set(ROWS.flatMap((row) => row.names))
	const broken: Array<string> = []
	const unlisted = new Set(Object.keys(NOT_IN_TABLE))
	for (const file of pageFiles()) {
		const visit = (node: ts.Node) => {
			// A part or foundation entry: an object literal with `name: '…'` and `source: …`.
			if (ts.isObjectLiteralExpression(node)) {
				const value = (key: string) => {
					const property = node.properties.find(
						(item) => ts.isPropertyAssignment(item) && ts.isIdentifier(item.name) && item.name.text === key
					)
					return property && ts.isPropertyAssignment(property) ? property.initializer : undefined
				}
				const name = value('name')
				const source = value('source')
				if (name && source && ts.isStringLiteral(name)) {
					if (ts.isStringLiteral(source) && !existsSync(source.text)) broken.push(`${file}: source ${source.text}`)
					// Foundations are tokens, not components; the table names components only.
					if (file.startsWith(`${PAGE_DIR}/components/`) && !named.has(name.text) && !NOT_IN_TABLE[name.text])
						broken.push(`${file}: ${name.text} is named by no design.md row`)
					unlisted.delete(name.text)
				}
			}
			ts.forEachChild(node, visit)
		}
		visit(parse(file))
	}
	for (const name of Object.keys(NOT_IN_TABLE)) {
		if (named.has(name)) broken.push(`NOT_IN_TABLE: ${name} is named by a row now`)
		if (unlisted.has(name)) broken.push(`NOT_IN_TABLE: ${name} is not a part on the page`)
	}
	expect(broken).toEqual([])
})
