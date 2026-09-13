import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parseSync } from 'oxc-parser'
import { describe, expect, test } from 'vitest'
import { type AstNode, identifierName, isNode, lineOf, walkAst } from '../../../../scripts/lib/oxcAst'
import { collectSourceFiles } from '../../../../scripts/lib/sourceFiles'

const SRC_DIR = path.join(process.cwd(), 'src')
const TABLE_USAGE_PATTERN =
	/components\/Table\/(Table|VirtualTable)['"]|<VirtualTable\b|<SearchTableProvider\b|\b\w+TableWrapper\b|<\w+TableWrapper\b/

function sourceFiles(): Array<string> {
	return collectSourceFiles(SRC_DIR, ['.ts', '.tsx']).filter(
		(file) => !file.includes(`${path.sep}containers${path.sep}ProDashboard${path.sep}`)
	)
}

function propertyName(prop: AstNode): string | undefined {
	if (!isNode(prop.key)) return undefined
	if (prop.key.type === 'Identifier') return prop.key.name as string
	if (prop.key.type === 'Literal') return String(prop.key.value)
	return undefined
}

function getObjectProperty(node: AstNode, property: string): AstNode | undefined {
	for (const prop of node.properties as Array<AstNode>) {
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
	test('keeps shared VirtualTable leaf columns explicitly CSS-sized through headerClassName', () => {
		const failures: Array<string> = []

		for (const file of sourceFiles()) {
			const source = readFileSync(file, 'utf8')
			if (!TABLE_USAGE_PATTERN.test(source)) {
				continue
			}

			const parsed = parseSync(file, source)
			expect(parsed.errors).toEqual([])
			const relativePath = path.relative(process.cwd(), file)

			walkAst(parsed.program as unknown as AstNode, (node) => {
				if (node.type !== 'CallExpression' || !isNode(node.callee)) return
				if (node.callee.type !== 'MemberExpression' || (node.callee.computed as boolean)) return

				const method = identifierName(node.callee.property)
				if (method !== 'accessor' && method !== 'display') return

				const callArguments = node.arguments as Array<AstNode>
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

if (!existsSync(SRC_DIR)) {
	throw new Error(`Missing source directory: ${SRC_DIR}`)
}
