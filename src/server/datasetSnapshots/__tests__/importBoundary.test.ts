import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parseSync } from 'oxc-parser'
import { describe, expect, it } from 'vitest'
import { type AstNode, identifierName, isNode, walkAst, lineOf } from '../../../../scripts/lib/oxcAst'
import { collectSourceFiles } from '../../../../scripts/lib/sourceFiles'

// Snapshot readers may only be reached through a dynamic import inside an
// exported page data function or an API handler. A lint rule cannot express
// this: oxlint's no-restricted-imports flags dynamic import() too, and the
// allowed position depends on the enclosing function, so it stays an AST walk.
const SCAN_ROOTS = ['src/pages', 'src/components', 'src/containers', 'src/layout']
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']
const SERVER_SNAPSHOT_IMPORT_PREFIXES = ['~/server/datasetSnapshots']
const PAGE_DATA_FUNCTIONS = new Set(['getStaticProps', 'getStaticPaths', 'getServerSideProps'])

function relativeSourcePath(filePath: string): string {
	return path.relative(process.cwd(), filePath).split(path.sep).join('/')
}

// Domain server modules are the typed acquisition boundary for snapshots.
function isScannedFile(filePath: string): boolean {
	const segments = relativeSourcePath(filePath).split('/')
	if (segments.includes('__tests__') || segments.includes('server')) return false
	const name = segments[segments.length - 1]
	return !name.includes('.server.') && !name.includes('.test.') && !name.includes('.spec.')
}

function isServerSnapshotImport(specifier: string): boolean {
	return (
		SERVER_SNAPSHOT_IMPORT_PREFIXES.some((prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`)) ||
		/(?:^|\/)server\/dataset(?:\.risk)?\.server$/.test(specifier)
	)
}

function isApiRouteFile(filePath: string): boolean {
	return relativeSourcePath(filePath).startsWith('src/pages/api/')
}

function isPageFile(filePath: string): boolean {
	const relativePath = relativeSourcePath(filePath)
	return relativePath.startsWith('src/pages/') && !relativePath.startsWith('src/pages/api/')
}

const FUNCTION_NODE_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])

function isInsideFunction(ancestors: readonly AstNode[]): boolean {
	return ancestors.some((node) => FUNCTION_NODE_TYPES.has(node.type))
}

/** Unwrap `as` / `satisfies` / parenthesized wrappers around an initializer. */
function unwrapExpression(node: AstNode): AstNode {
	let current = node
	while (
		(current.type === 'TSAsExpression' ||
			current.type === 'TSSatisfiesExpression' ||
			current.type === 'ParenthesizedExpression') &&
		isNode(current.expression)
	) {
		current = current.expression
	}
	return current
}

/** Names of handler functions wrapped into exported page-data consts, e.g.
    `export const getStaticProps = withPerformanceLogging('key', handler)`. */
function collectPageDataHandlerNames(program: AstNode): Set<string> {
	const handlerNames = new Set<string>()

	walkAst(program, (node) => {
		if (node.type !== 'ExportNamedDeclaration' || !isNode(node.declaration)) return
		if (node.declaration.type !== 'VariableDeclaration') return
		for (const declaration of node.declaration.declarations as AstNode[]) {
			const name = identifierName(declaration.id)
			if (!name || !PAGE_DATA_FUNCTIONS.has(name) || !isNode(declaration.init)) continue
			const initializer = unwrapExpression(declaration.init)
			const direct = identifierName(initializer)
			if (direct) {
				handlerNames.add(direct)
				continue
			}
			if (initializer.type === 'CallExpression') {
				for (const argument of initializer.arguments as AstNode[]) {
					const argumentName = identifierName(argument)
					if (argumentName) handlerNames.add(argumentName)
				}
			}
		}
	})

	return handlerNames
}

function isExportedInStack(ancestors: readonly AstNode[], index: number): boolean {
	for (let i = index; i >= 0; i--) {
		if (ancestors[i].type === 'ExportNamedDeclaration') return true
		if (ancestors[i].type === 'VariableDeclaration') continue
		if (ancestors[i].type === 'VariableDeclarator') continue
		break
	}
	return false
}

function isInsideExportedPageDataFunction(ancestors: readonly AstNode[], handlerNames: Set<string>): boolean {
	for (let i = ancestors.length - 1; i >= 0; i--) {
		const current = ancestors[i]

		if (current.type === 'FunctionDeclaration') {
			const name = identifierName(current.id)
			if (name && handlerNames.has(name)) return true
			if (name && PAGE_DATA_FUNCTIONS.has(name) && ancestors[i - 1]?.type === 'ExportNamedDeclaration') return true
		}

		if (current.type === 'VariableDeclarator') {
			const name = identifierName(current.id)
			if (name && handlerNames.has(name)) return true
			if (name && PAGE_DATA_FUNCTIONS.has(name)) return isExportedInStack(ancestors, i - 1)
		}
	}
	return false
}

describe('dataset snapshot import boundary', () => {
	it('keeps server snapshot imports inside page data functions and API handlers', () => {
		const errors: string[] = []
		const files = SCAN_ROOTS.flatMap((root) => collectSourceFiles(root, SOURCE_EXTENSIONS)).filter(isScannedFile)

		for (const filePath of files) {
			const source = readFileSync(filePath, 'utf8')
			if (!source.includes('datasetSnapshots') && !source.includes('/server/dataset.server')) continue

			const relativePath = relativeSourcePath(filePath)
			const parsed = parseSync(filePath, source)
			expect(parsed.errors).toEqual([])
			const program = parsed.program as unknown as AstNode
			const pageDataHandlerNames = collectPageDataHandlerNames(program)

			walkAst(program, (node, ancestors) => {
				if (node.type === 'ImportDeclaration' && isNode(node.source)) {
					const specifier = node.source.value as string
					const isAllowedTypeImport = node.importKind === 'type' && specifier.endsWith('.types')
					if (isServerSnapshotImport(specifier) && !isAllowedTypeImport) {
						errors.push(`${relativePath}:${lineOf(source, node.start)} static import ${specifier}`)
					}
				}

				if (node.type === 'ImportExpression' && isNode(node.source) && node.source.type === 'Literal') {
					const specifier = node.source.value
					if (typeof specifier !== 'string' || !isServerSnapshotImport(specifier)) return
					const isAllowed =
						(isPageFile(filePath) && isInsideExportedPageDataFunction(ancestors, pageDataHandlerNames)) ||
						(isApiRouteFile(filePath) && isInsideFunction(ancestors))
					if (!isAllowed) errors.push(`${relativePath}:${lineOf(source, node.start)} dynamic import ${specifier}`)
				}
			})
		}

		expect(errors).toEqual([])
	})
})
