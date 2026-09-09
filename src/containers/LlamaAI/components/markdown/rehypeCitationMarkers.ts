import type { Element, ElementContent, Root } from 'hast'
import {
	citationMarkerRegex,
	expandCitationIds,
	normalizeCitationMarkerWhitespace
} from '~/containers/LlamaAI/utils/markdownHelpers'

// A fenced block is `pre > code` and a code span is `code`; neither should have its text rewritten.
const CODE = new Set(['pre', 'code'])
const TABLE_CELLS = new Set(['td', 'th'])

function pill(id: number, unresolved: boolean): Element {
	return {
		type: 'element',
		tagName: 'fact-check-pill',
		properties: unresolved ? { dataRef: String(id), dataUnresolved: 'true' } : { dataRef: String(id) },
		children: []
	}
}

/**
 * Turn citation markers into pill elements over the HTML tree.
 *
 * Rewriting markers in the markdown source instead reaches consumers that only want the text, and
 * it reaches inside code: a fenced example holding `arr[1]` came out as pill markup a reader would
 * copy. Doing it on the tree skips code without a second parser deciding where code begins.
 *
 * It runs on the HTML tree rather than the markdown one because an answer can carry a table as raw
 * HTML. Markdown parsing leaves that as a single opaque node, so a pass over the markdown tree
 * cannot see the cells inside it; after `rehypeRaw` they are ordinary elements.
 *
 * The tree is also what makes a table cell recognizable, which is what a reserved marker needs. A
 * marker whose reference has not arrived holds the width of its number inside a cell: references
 * land in batches while an answer streams, and a marker that fills in afterwards re-proportions
 * every column of a table that has already finished. In ordinary prose an unresolved marker is
 * dropped and the text around it normalized, so nothing is left sitting before a full stop.
 *
 * Place this after the sanitize plugins, whose schema would otherwise have to allow the attributes
 * these elements carry, and before the heading and caret plugins, which read the finished tree.
 */
export function rehypeCitationMarkers({
	resolvedIds,
	reserveInTables = false
}: {
	resolvedIds?: Set<number>
	reserveInTables?: boolean
} = {}) {
	const isResolved = (id: number) => resolvedIds?.has(id) ?? false
	const keeps = (id: number, inCell: boolean) =>
		isResolved(id) || (inCell && reserveInTables && Number.isInteger(id) && id >= 1)

	const splitText = (value: string, inCell: boolean): Array<ElementContent> => {
		const nodes: Array<ElementContent> = []
		let text = ''
		const flushText = () => {
			if (!text) return
			nodes.push({ type: 'text', value: normalizeCitationMarkerWhitespace(text) })
			text = ''
		}

		const regex = citationMarkerRegex()
		let cursor = 0
		let match: RegExpExecArray | null
		while ((match = regex.exec(value)) !== null) {
			const kept = expandCitationIds(match[1] ?? match[2] ?? '').filter((id) => keeps(id, inCell))
			text += value.slice(cursor, match.index)
			cursor = match.index + match[0].length
			// A dropped marker leaves the text on both sides in one buffer, so the space it sat in
			// collapses with what follows it.
			if (kept.length === 0) continue
			flushText()
			for (const id of kept) nodes.push(pill(id, !isResolved(id)))
		}
		text += value.slice(cursor)
		flushText()
		return nodes
	}

	const transform = (parent: Root | Element, inCell: boolean) => {
		const next: Array<ElementContent> = []
		for (const child of parent.children as Array<ElementContent>) {
			if (child.type === 'element') {
				if (!CODE.has(child.tagName)) transform(child, inCell || TABLE_CELLS.has(child.tagName))
				next.push(child)
				continue
			}
			if (child.type === 'text') {
				next.push(...splitText(child.value, inCell))
				continue
			}
			next.push(child)
		}
		parent.children = next as Root['children']
	}

	return (tree: Root) => {
		transform(tree, false)
	}
}
