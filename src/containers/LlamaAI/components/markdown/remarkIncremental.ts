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
			const table = previous?.tree.children.at(-1)
			// Only an append to a top-level pipe table can reuse finished rows. The last row
			// stays open; parsing its suffix with the original header retains GFM cell rules.
			if (
				previous &&
				!previous.needsFullParse &&
				table?.type === 'table' &&
				table.children.length > 1 &&
				table.position!.start.column === 1 &&
				source.startsWith(previous.source) &&
				!source.includes('\r') &&
				!source.includes('\uFEFF') &&
				source[table.position!.start.offset!] === '|'
			) {
				const lastRow = table.children.at(-1)!
				const boundary = lastRow.position!.start.offset!
				const headerEnd = source.indexOf('\n', source.indexOf('\n', table.position!.start.offset!) + 1) + 1
				const header = source.slice(table.position!.start.offset, headerEnd)
				const suffixSource = header + source.slice(boundary)
				// Escapes and code delimiters use the complete parser until that row closes.
				if (lastRow.position!.start.column === 1 && source[boundary] === '|' && !/[\\`]/.test(suffixSource)) {
					const suffix = parse(suffixSource, file)
					const nextTable = suffix.children[0]
					// A terminating block or definition needs the original document context.
					if (suffix.children.length === 1 && nextTable?.type === 'table' && nextTable.children.length > 1) {
						const offsetDelta = boundary - header.length
						const lineDelta = lastRow.position!.start.line - 3
						for (const row of nextTable.children.slice(1)) {
							visit(row, (node) => {
								for (const point of [node.position!.start, node.position!.end]) {
									point.offset! += offsetDelta
									point.line += lineDelta
								}
							})
						}
						const end = suffix.position!.end
						const tree: Root = {
							...previous.tree,
							children: [
								...previous.tree.children.slice(0, -1),
								{
									...table,
									children: [...table.children.slice(0, -1), ...nextTable.children.slice(1)],
									position: { start: table.position!.start, end: nextTable.children.at(-1)!.position!.end }
								}
							],
							position: {
								start: previous.tree.position!.start,
								end: { ...end, offset: end.offset! + offsetDelta, line: end.line + lineDelta }
							}
						}
						cached = { ...previous, source, tree }
						return tree
					}
				}
			}
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
