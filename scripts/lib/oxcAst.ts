/** Minimal ESTree node as produced by oxc-parser: typed, with byte offsets. */
export interface AstNode {
	type: string
	start: number
	end: number
	[key: string]: unknown
}

export function isNode(value: unknown): value is AstNode {
	return typeof value === 'object' && value !== null && typeof (value as AstNode).type === 'string'
}

/** Depth-first visit of every node. `ancestors` is the path from the root, nearest last. */
export function walkAst(node: AstNode, visit: (node: AstNode, ancestors: readonly AstNode[]) => void): void {
	const ancestors: AstNode[] = []
	function step(current: AstNode) {
		visit(current, ancestors)
		ancestors.push(current)
		for (const key of Object.keys(current)) {
			const value = current[key]
			if (Array.isArray(value)) {
				for (const item of value) if (isNode(item)) step(item)
			} else if (isNode(value)) {
				step(value)
			}
		}
		ancestors.pop()
	}
	step(node)
}

export function identifierName(node: unknown): string | undefined {
	return isNode(node) && node.type === 'Identifier' ? (node.name as string) : undefined
}

export function lineOf(source: string, offset: number): number {
	let line = 1
	for (let i = 0; i < offset; i++) if (source.charCodeAt(i) === 10) line++
	return line
}
