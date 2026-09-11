import type { Root } from 'mdast'
import { visit } from 'unist-util-visit'

// A line break followed by an ordered-list marker other than `1.`, which CommonMark reads as
// paragraph continuation instead of a list.
const LIST_AFTER_BREAK = /\n(?= {0,3}(?:[02-9]|\d{2,})[.)] )/

/**
 * Put a blank line between a paragraph and an ordered list that starts above 1, so the list renders
 * as a list. Only paragraphs are rewritten; code and other blocks are untouched.
 *
 * Returns the rewritten source, or null when nothing needs detaching.
 */
export function detachOrderedLists(source: string, tree: Root): string | null {
	let out = ''
	let cursor = 0
	visit(tree, 'paragraph', (paragraph) => {
		const start = paragraph.position!.start.offset!
		const end = paragraph.position!.end.offset!
		const text = source.slice(start, end)
		const fixed = text.replace(LIST_AFTER_BREAK, '\n\n')
		if (fixed === text) return
		out += source.slice(cursor, start) + fixed
		cursor = end
	})
	return cursor === 0 ? null : out + source.slice(cursor)
}

/**
 * Indent a list that follows a list item and is indented less than that item's content, so it
 * nests instead of splitting the outer list. A list flush with the outer marker is left alone.
 *
 * Returns the rewritten source, or null when nothing needs nesting.
 */
export function nestIndentedLists(source: string, tree: Root): string | null {
	const edits: Array<[start: number, end: number, pad: string]> = []
	visit(tree, (node) => {
		if (node.type !== 'root' && node.type !== 'listItem') return
		for (let i = 1; i < node.children.length; i++) {
			const outer = node.children[i - 1]
			const inner = node.children[i]
			if (outer.type !== 'list' || inner.type !== 'list') continue
			const content = outer.children.at(-1)?.children[0]
			if (!content) continue
			const column = content.position!.start.column - 1
			const indent = inner.position!.start.column - 1
			if (indent === 0 || indent >= column) continue
			edits.push([inner.position!.start.offset!, inner.position!.end.offset!, ' '.repeat(column - indent)])
		}
	})
	if (edits.length === 0) return null
	edits.sort((a, b) => a[0] - b[0])
	let out = ''
	let cursor = 0
	for (const [start, end, pad] of edits) {
		out += source.slice(cursor, start) + pad + source.slice(start, end).replaceAll('\n', `\n${pad}`)
		cursor = end
	}
	return out + source.slice(cursor)
}
