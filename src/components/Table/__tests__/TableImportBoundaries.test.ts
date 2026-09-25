import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parseSync } from 'oxc-parser'
import { expect, test } from 'vitest'

// Follow static runtime imports only: deferred table modules belong to a later chunk.
function runtimeImports(entry: string) {
	const visited = new Set<string>()
	function visit(file: string) {
		if (visited.has(file)) return
		visited.add(file)
		const program = parseSync(file, readFileSync(file, 'utf8')).program
		for (const node of program.body) {
			if (
				node.type !== 'ImportDeclaration' &&
				node.type !== 'ExportNamedDeclaration' &&
				node.type !== 'ExportAllDeclaration'
			)
				continue
			if (
				!node.source ||
				('importKind' in node && node.importKind === 'type') ||
				('exportKind' in node && node.exportKind === 'type')
			)
				continue
			if (
				'specifiers' in node &&
				node.specifiers.length > 0 &&
				node.specifiers.every((specifier) => 'importKind' in specifier && specifier.importKind === 'type')
			)
				continue
			const source = node.source.value
			if (!source.startsWith('.') && !source.startsWith('~/')) {
				visited.add(source)
				continue
			}
			const base = source.startsWith('~/')
				? path.resolve('src', source.slice(2))
				: path.resolve(path.dirname(file), source)
			const resolved = ['.ts', '.tsx', '/index.ts', '/index.tsx'].map((suffix) => base + suffix).find(existsSync)
			if (resolved) visit(resolved)
		}
	}
	visit(path.resolve(entry))
	return [...visited].map((file) => (file.startsWith(process.cwd()) ? path.relative(process.cwd(), file) : file))
}

test.each(['features/searchHook.ts', 'search/SearchTableProvider.tsx'])(
	'keeps %s free of renderer and toolbar UI',
	(entry) => {
		const imports = runtimeImports(`src/components/Table/${entry}`)
		const localImports = imports.filter((file) => file.startsWith('src/'))
		expect(localImports.length).toBeGreaterThan(1)
		for (const file of localImports) {
			expect(
				file.startsWith('src/components/Table/features/') ||
					file === 'src/components/Table/search/context.ts' ||
					file === 'src/components/Table/search/SearchTableProvider.tsx'
			).toBe(true)
		}
		expect(imports).not.toContain('src/components/Table/features/pagination.ts')
		expect(imports).not.toContain('@tanstack/react-virtual')
	}
)

test('keeps full rendering independent of virtualization and toolbar controls', () => {
	const imports = runtimeImports('src/components/Table/search/SearchTableView.tsx')
	expect(imports).not.toContain('@tanstack/react-virtual')
	expect(imports).not.toContain('src/components/CsvDownloadButton.tsx')
	expect(imports).not.toContain('src/components/Select/SelectWithCombobox.tsx')
})

test.each(['DeferredTokenMarketsTable', 'DeferredTokenLiquidationsTable'])(
	'keeps %s behind its dynamic import',
	(name) => {
		const imports = runtimeImports(`src/containers/Token/deferred/${name}.tsx`)
		expect(imports).not.toContain('@tanstack/react-table')
		expect(imports).not.toContain('@tanstack/react-virtual')
	}
)
