import type { Element, Root } from 'hast'
import { visit } from 'unist-util-visit'

// h1-h3 only, matching the headings the renderer maps to its own component. Numbering h4-h6 as well
// would let a deeper heading claim a slug first and renumber an existing h1-h3 anchor.
const HEADINGS = new Set(['h1', 'h2', 'h3'])

export function headingSlug(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
}

function headingText(node: Element): string {
	let text = ''
	visit(node, 'text', (child: { value: string }) => {
		text += child.value
	})
	return text
}

/**
 * Assign an id to every heading, numbering repeats in document order.
 *
 * Runs over the parsed tree rather than the markdown source so the ids match what renders: entities
 * are already decoded, and a heading wrapped in a link or emphasis slugs from its text instead of its
 * syntax. Reading the source instead means maintaining a second, less capable markdown parser.
 *
 * Allocating ids here also keeps them stable while an answer streams. A per-heading allocator has to
 * reset every render, and under the React compiler it cannot: the compiler caches such a call against
 * the message id, so counts carry over and headings renumber themselves as prose arrives below them.
 *
 * Place this after the sanitize plugins; the schema drops unknown ids.
 */
export function rehypeHeadingIds({ messageId }: { messageId?: string } = {}) {
	return (tree: Root) => {
		const counts = new Map<string, number>()
		visit(tree, 'element', (node: Element) => {
			if (!HEADINGS.has(node.tagName)) return
			const slug = headingSlug(headingText(node)) || 'section'
			const baseId = messageId ? `${messageId.slice(0, 8)}-${slug}` : slug
			const occurrence = counts.get(baseId) ?? 0
			counts.set(baseId, occurrence + 1)
			node.properties.id = occurrence === 0 ? baseId : `${baseId}-${occurrence}`
		})
	}
}
