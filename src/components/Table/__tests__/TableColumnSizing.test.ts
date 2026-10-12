import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parseSync } from 'oxc-parser'
import { describe, expect, test } from 'vitest'
import { type AstNode, identifierName, isNode, lineOf, walkAst } from '../../../../scripts/lib/oxcAst'
import { collectSourceFiles } from '../../../../scripts/lib/sourceFiles'

const SRC_DIR = path.join(process.cwd(), 'src')
const TABLE_USAGE_PATTERN =
	/components\/Table\/(Table|VirtualTable)['"]|<VirtualTable\b|<SearchTableProvider\b|\wTableWrapper\b/

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

function compactNodeText(source: string, node: AstNode | undefined): string {
	return node ? source.slice(node.start, node.end).replace(/\s+/g, ' ').slice(0, 120) : ''
}

describe('Table column sizing', () => {
	// The shared renderers size columns from meta.headerClassName (see "Column widths" in the Table README) and never
	// read TanStack's size, so a size there silently does nothing.
	test('leaves TanStack size off shared table columns', () => {
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

				const id = compactNodeText(source, getObjectProperty(config, 'id') ?? callArguments[0])
				const header = compactNodeText(source, getObjectProperty(config, 'header'))
				const label = `${relativePath}:${lineOf(source, node.start)} ${method} ${id}${header ? ` / ${header}` : ''}`

				if (hasObjectProperty(config, 'size')) {
					failures.push(`${label} uses size`)
				}
			})
		}

		expect(failures).toEqual([])
		// Reads every source file under src/, which exceeds the default budget on a loaded machine.
	}, 30_000)
})

if (!existsSync(SRC_DIR)) {
	throw new Error(`Missing source directory: ${SRC_DIR}`)
}
