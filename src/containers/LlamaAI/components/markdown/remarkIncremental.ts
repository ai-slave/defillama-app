import type { Root } from 'mdast'
import type { Processor } from 'unified'
import { visit } from 'unist-util-visit'

/** One cache per Markdown renderer. Dropping it changes cost, never the parsed document. */
export function createRemarkIncremental() {
	let cached:
		| { source: string; tree: Root; boundary: number; line: number; count: number; needsFullParse: boolean }
		| undefined

	return function remarkIncremental(this: Processor<Root>) {
		const parse = this.parser!
		this.parser = (source, file) => {
			if (cached?.source === source) return cached.tree
			const previous = cached
			// Definitions resolve earlier references; indented code carries parser interruption state.
			// Untagged fences share its AST shape, so conservatively use the full parser for those too.
			// A BOM is special at the start of input; never turn an interior BOM into a suffix start.
			const reuse =
				previous &&
				!previous.needsFullParse &&
				!source.includes('\uFEFF') &&
				source.startsWith(previous.source.slice(0, previous.boundary))
			const offset = reuse ? previous.boundary : 0
			const line = reuse ? previous.line : 1
			let tree = parse(source.slice(offset), file)
			let needsFullParse = false
			visit(tree, (node) => {
				if (node.type === 'definition' || node.type === 'footnoteDefinition' || (node.type === 'code' && !node.lang))
					needsFullParse = true
			})
			if (offset && needsFullParse) {
				tree = parse(source, file)
			} else if (offset) {
				visit(tree, (node) => {
					if (!node.position) return
					for (const point of [node.position.start, node.position.end]) {
						point.offset! += offset
						point.line += line - 1
					}
				})
				// The first reparsed block overlaps the previous tree. Check that restarting here
				// preserves the preceding block (notably container exits and indented code).
				if (JSON.stringify(tree.children[0]) !== JSON.stringify(previous.tree.children[previous.count])) {
					tree = parse(source, file)
				} else {
					tree = {
						...tree,
						children: [...previous.tree.children.slice(0, previous.count), ...tree.children],
						position: { start: previous.tree.position!.start, end: tree.position!.end }
					}
				}
			}
			// Keep two trailing blocks open: an unfinished marker can become a lazy continuation
			// of the preceding block. Parser positions retain its indentation and line endings.
			const count = Math.max(0, tree.children.length - 2)
			const start = tree.children[count]?.position?.start
			cached = {
				source,
				tree,
				count,
				needsFullParse,
				boundary: count ? start!.offset! - start!.column + 1 : 0,
				line: count ? start!.line : 1
			}

			return tree
		}
	}
}
