import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { parseSync } from 'oxc-parser'
import { describe, expect, it } from 'vitest'

const SRC_DIR = path.join(process.cwd(), 'src')
const TABLE_USAGE_PATTERN =
	/components\/Table\/(Table|TableWithSearch)['"]|<VirtualTable\b|<TableWithSearch\b|\b\w+TableWrapper\b|<\w+TableWrapper\b/

/** Minimal ESTree node as produced by oxc-parser: typed, with byte offsets. */
interface AstNode {
	type: string
	start: number
	end: number
	[key: string]: unknown
}

function isNode(value: unknown): value is AstNode {
	return typeof value === 'object' && value !== null && typeof (value as AstNode).type === 'string'
}

function walk(node: AstNode, visit: (node: AstNode) => void) {
	visit(node)
	for (const key of Object.keys(node)) {
		const value = node[key]
		if (Array.isArray(value)) {
			for (const item of value) if (isNode(item)) walk(item, visit)
		} else if (isNode(value)) {
			walk(value, visit)
		}
	}
}

function lineOf(source: string, offset: number): number {
	let line = 1
	for (let i = 0; i < offset; i++) if (source.charCodeAt(i) === 10) line++
	return line
}

function sourceFiles(dir: string): string[] {
	const files: string[] = []
	for (const entry of readdirSync(dir)) {
		const fullPath = path.join(dir, entry)
		if (fullPath.includes(`${path.sep}containers${path.sep}ProDashboard${path.sep}`)) {
			continue
		}
		const stats = statSync(fullPath)
		if (stats.isDirectory()) {
			files.push(...sourceFiles(fullPath))
		} else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
			files.push(fullPath)
		}
	}
	return files
}

function propertyName(prop: AstNode): string | undefined {
	if (!isNode(prop.key)) return undefined
	if (prop.key.type === 'Identifier') return prop.key.name as string
	if (prop.key.type === 'Literal') return String(prop.key.value)
	return undefined
}

function getObjectProperty(node: AstNode, property: string): AstNode | undefined {
	for (const prop of node.properties as AstNode[]) {
		if (prop.type !== 'Property' || (prop.computed as boolean)) continue
		if (propertyName(prop) === property) return isNode(prop.value) ? prop.value : prop
	}
	return undefined
}

function hasObjectProperty(node: AstNode, property: string): boolean {
	return getObjectProperty(node, property) !== undefined
}

function hasMetaProperty(config: AstNode, property: string): boolean {
	const meta = getObjectProperty(config, 'meta')
	return Boolean(meta && meta.type === 'ObjectExpression' && hasObjectProperty(meta, property))
}

function hasLiteralMetaFlag(config: AstNode, property: string): boolean {
	const meta = getObjectProperty(config, 'meta')
	if (!meta || meta.type !== 'ObjectExpression') return false
	const value = getObjectProperty(meta, property)
	return value?.type === 'Literal' && value.value === true
}

function compactNodeText(source: string, node: AstNode | undefined): string {
	return node ? source.slice(node.start, node.end).replace(/\s+/g, ' ').slice(0, 120) : ''
}

describe('VirtualTable column sizing', () => {
	it('keeps shared VirtualTable leaf columns explicitly CSS-sized through headerClassName', () => {
		const failures: string[] = []

		for (const file of sourceFiles(SRC_DIR)) {
			const source = readFileSync(file, 'utf8')
			if (!TABLE_USAGE_PATTERN.test(source)) {
				continue
			}

			const parsed = parseSync(file, source)
			expect(parsed.errors).toEqual([])
			const relativePath = path.relative(process.cwd(), file)

			walk(parsed.program as unknown as AstNode, (node) => {
				if (node.type !== 'CallExpression' || !isNode(node.callee)) return
				if (node.callee.type !== 'MemberExpression' || (node.callee.computed as boolean)) return

				const method = identifier(node.callee.property)
				if (method !== 'accessor' && method !== 'display') return

				const callArguments = node.arguments as AstNode[]
				const config = callArguments[callArguments.length - 1]
				if (!config || config.type !== 'ObjectExpression') return
				// Hidden export-only columns never participate in table layout.
				if (hasLiteralMetaFlag(config, 'hidden')) return

				const id = compactNodeText(source, getObjectProperty(config, 'id') ?? callArguments[0])
				const header = compactNodeText(source, getObjectProperty(config, 'header'))
				const label = `${relativePath}:${lineOf(source, node.start)} ${method} ${id}${header ? ` / ${header}` : ''}`

				if (hasObjectProperty(config, 'size')) {
					failures.push(`${label} still uses size`)
				}
				if (hasMetaProperty(config, 'colClassName')) {
					failures.push(`${label} still uses meta.colClassName`)
				}
				if (!hasMetaProperty(config, 'headerClassName')) {
					failures.push(`${label} missing meta.headerClassName`)
				}
			})
		}

		expect(failures).toEqual([])
	}, 30_000)
})

function identifier(node: unknown): string | undefined {
	return isNode(node) && node.type === 'Identifier' ? (node.name as string) : undefined
}

if (!existsSync(SRC_DIR)) {
	throw new Error(`Missing source directory: ${SRC_DIR}`)
}
