import type { Paragraph, Root, RootContent } from 'mdast'

const SETEXT_UNDERLINE = /^ {0,3}(-+|=+) *$/
const INCOMPLETE_LINK = /(!?)\[([^\]\n]*)\]\([^)\n]*$/
const BACKTICK_RUN = /`+/g
const OPENING_STRONG = /\*\*(?=\S)/
const OPENING_STRIKE = /~~(?=\S)/
// A backslash before ASCII punctuation escapes it; drop both so `\`` and `\**` are not markers.
const ESCAPE = /\\[!-/:-@[-`{-~]/g

// The paragraph whose text ends the document, through list items and block quotes.
function trailingParagraph(node: RootContent): Paragraph | null {
	if (node.type === 'paragraph') return node
	if (node.type === 'blockquote' || node.type === 'list' || node.type === 'listItem') {
		const last = node.children.at(-1)
		return last ? trailingParagraph(last as RootContent) : null
	}
	return null
}

// Text the parser could not match as markup, as raw source. Code spans, links and emphasis it did
// recognise are separate nodes, and a marker inside one of them is enclosed by something already
// closed, so a closer appended after the paragraph could never pair with it: only direct children
// of the paragraph can hold an opener that is still pending.
function unmatchedText(paragraph: Paragraph, source: string): string {
	let literal = ''
	for (const child of paragraph.children) {
		if (child.type === 'text') literal += source.slice(child.position!.start.offset, child.position!.end.offset)
	}
	return literal.replace(ESCAPE, '')
}

/**
 * Repair the unfinished tail of streaming markdown so it does not render as something it is not.
 *
 * With text arriving a few characters at a time, every marker exists on its own for a moment. A
 * `-` on the line after a paragraph is a setext underline that turns the paragraph into a heading
 * until the next character makes it a list item, `##` is an empty heading, `**bo` shows two literal
 * asterisks, and `[Aave](https://ll` is a growing line of URL text that collapses into one word
 * when the `)` lands. Each flip moves the layout, and a shrink clamps the scroll position.
 *
 * The decisions come from the parsed tree, not from the source: a backtick inside a code span, a
 * fence inside a block quote or a `-` inside a code block are already something else to the parser
 * and are never touched. Only the block that ends exactly at the end of the source can still
 * change, so only it is considered. An empty heading is held back until it has text, a setext
 * underline until its line is complete; unclosed inline code, bold and strikethrough are closed;
 * an unfinished link keeps its text and drops its partial URL; an unfinished image is hidden.
 * Single `*` and `_` are left alone: they are also list markers and identifier characters.
 *
 * Returns the mended source, or null when nothing needs mending. Never called on finished text.
 */
export function mendStreamingMarkdown(source: string, tree: Root): string | null {
	const last = tree.children.at(-1)
	if (!last || last.position!.end.offset !== source.length) return null

	if (last.type === 'heading') {
		// `#`, `## `: nothing to show yet, and showing an empty heading moves the layout twice.
		if (last.children.length === 0) return source.slice(0, last.position!.start.offset)
		const lineStart = source.lastIndexOf('\n') + 1
		// `Text\n-` is a heading now and a list item one character later; hold the underline back.
		if (lineStart > last.position!.start.offset && SETEXT_UNDERLINE.test(source.slice(lineStart))) {
			return source.slice(0, lineStart)
		}
		return null
	}

	const paragraph = trailingParagraph(last)
	if (!paragraph) return null
	let mended = source
	// An unfinished link is text up to the `(` and, thanks to GFM autolink literals, often a link node
	// for the partial URL after it. Scan the raw source of that trailing run only, so a `[a](b` inside
	// a code span is never mistaken for one.
	let runStart = source.length
	for (let i = paragraph.children.length - 1; i >= 0; i--) {
		const child = paragraph.children[i]
		if (child.type !== 'text' && child.type !== 'link') break
		runStart = child.position!.start.offset
	}
	if (runStart < source.length && paragraph.position!.end.offset === source.length) {
		const link = INCOMPLETE_LINK.exec(source.slice(runStart))
		if (link) mended = source.slice(0, runStart + link.index) + (link[1] ? '' : `[${link[2]}]()`)
	}
	const literal = unmatchedText(paragraph, source)
	// A backtick run still in text is one the parser could not pair (matched spans are inlineCode
	// nodes); the first such run is the opener, and the closer must match its length.
	const backticks = literal.match(BACKTICK_RUN)
	if (backticks) mended += backticks[0]
	// Likewise `**` in text is unmatched, but `a ** b` is a literal that can never open; only a run
	// followed by a character is a pending opener.
	if (OPENING_STRONG.test(literal)) mended += '**'
	if (OPENING_STRIKE.test(literal)) mended += '~~'
	return mended === source ? null : mended
}
