// @vitest-environment happy-dom
//
// Worth running both ways: `bun run test:compiled -- <this file>` exercises the same cases against
// React Compiler output, which is where the heading ids drifted in the first place.

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { ChatMarkdownRenderer } from '../ChatMarkdownRenderer'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const ids = () => [...container.querySelectorAll('[data-section-heading]')].map((node) => node.id)

async function render(content: string, messageId?: string) {
	await act(async () => root.render(<ChatMarkdownRenderer content={content} messageId={messageId} />))
}

// The allocator this replaced counted duplicates as the headings rendered, so the compiler cached it
// against the message id and carried the counts into the next render.
test('a heading keeps its id while prose streams in below it', async () => {
	await render('## Revenue\n', 'message-1234')
	expect(ids()).toEqual(['message--revenue'])
	await render('## Revenue\n\nSome prose.\n', 'message-1234')
	expect(ids()).toEqual(['message--revenue'])
	await render('## Revenue\n\nSome prose.\n\nMore prose.\n', 'message-1234')
	expect(ids()).toEqual(['message--revenue'])
})

test('numbers repeated headings in document order', async () => {
	await render('## Revenue\n\na\n\n## Revenue\n\nb\n\n## Revenue\n')
	expect(ids()).toEqual(['revenue', 'revenue-1', 'revenue-2'])
})

// Slugs come from the parsed tree, so they match the text on screen rather than the syntax.
test('slugs the rendered text, not the markdown syntax', async () => {
	await render('## [Revenue](https://example.com)\n')
	expect(ids()).toEqual(['revenue'])
})

test('slugs decoded entities', async () => {
	await render('## Revenue &amp; Fees\n')
	expect(ids()).toEqual(['revenue-fees'])
})

test('numbers repeated setext headings', async () => {
	await render('Revenue\n-------\n\na\n\nRevenue\n-------\n')
	expect(ids()).toEqual(['revenue', 'revenue-1'])
})

test('numbers repeated headings inside a blockquote', async () => {
	await render('> ## Revenue\n\na\n\n> ## Revenue\n')
	expect(ids()).toEqual(['revenue', 'revenue-1'])
})

test('falls back to a stable slug when a heading has no sluggable text', async () => {
	await render('## ***\n\na\n\n## ***\n')
	expect(ids()).toEqual(['section', 'section-1'])
})

// h4-h6 are not mapped to the renderer's own heading component and carry no id, so they must stay out
// of the numbering: otherwise a deeper heading claims a slug first and renumbers an h1-h3 anchor.
test('a deeper heading does not renumber the headings that have ids', async () => {
	await render('#### Revenue\n\na\n\n## Revenue\n')
	expect(ids()).toEqual(['revenue'])
	expect(container.querySelector('h4')?.id).toBe('')
})

// Uniqueness across messages rests entirely on the message id prefix, which is why the numbering
// counter being per-tree is enough. Two answers sharing the first 8 characters of their id still
// collide, as they did before: see the PR notes.
test('headings in different messages do not collide', async () => {
	await act(async () =>
		root.render(
			<>
				<ChatMarkdownRenderer content={'## Revenue\n'} messageId="aaaaaaaa-1" />
				<ChatMarkdownRenderer content={'## Revenue\n'} messageId="bbbbbbbb-2" />
			</>
		)
	)
	expect(ids()).toEqual(['aaaaaaaa-revenue', 'bbbbbbbb-revenue'])
})
