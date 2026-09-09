import type { Element, Root } from 'hast'

// Elements that can hold the caret at the end of their own text.
const TEXT_BLOCKS = new Set(['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
// Elements whose last child continues the trailing text.
const CONTAINERS = new Set(['blockquote', 'ul', 'ol', 'li'])

function lastElementChild(node: Element | Root): Element | null {
	for (let i = node.children.length - 1; i >= 0; i--) {
		const child = node.children[i]
		if (child.type === 'element') return child
		// Trailing text means this node's own text is what ends the answer.
		if (child.type === 'text' && child.value.trim()) return null
	}
	return null
}

/**
 * Mark the element whose text ends a streaming answer, so CSS can trail a caret inside it.
 *
 * The caret used to be a sibling element after the markdown. Both the message body and the prose
 * root are flex columns, so a sibling is a flex item: it always landed on a line of its own instead
 * of following the last word. Marking the trailing block and drawing the caret with `::after` keeps
 * it in the text flow.
 *
 * Walking down the last-child chain also means only one element is ever marked. A `:last-child` rule
 * would match the trailing block of every nesting level at once.
 *
 * A trailing table or code fence gets no caret: its own frame already reads as unfinished, and a bar
 * inside a cell or a highlighted line looks like content. Place this after the sanitize plugins;
 * their schema drops attributes it does not know.
 */
export function rehypeStreamingCaret({ active }: { active?: boolean } = {}) {
	return (tree: Root) => {
		if (!active) return
		let node: Element | Root = tree
		let target: Element | null = null
		for (;;) {
			const child = lastElementChild(node)
			if (!child) break
			// A nested terminal block also rules out the enclosing list item's caret.
			if (child.tagName === 'table' || child.tagName === 'pre') return
			if (TEXT_BLOCKS.has(child.tagName)) {
				target = child
				node = child
				continue
			}
			if (CONTAINERS.has(child.tagName)) {
				node = child
				continue
			}
			break
		}
		if (target) target.properties['data-llamaai-caret'] = 'true'
	}
}
