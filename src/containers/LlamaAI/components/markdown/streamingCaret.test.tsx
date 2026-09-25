// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { ChatMarkdownRenderer } from './ChatMarkdownRenderer'

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

const carets = () =>
	[...container.querySelectorAll('[data-llamaai-caret]')].map(
		(node) => `${node.tagName.toLowerCase()}:${node.textContent}`
	)

async function render(content: string, showStreamingCaret = true) {
	await act(async () =>
		root.render(<ChatMarkdownRenderer content={content} isStreaming showStreamingCaret={showStreamingCaret} />)
	)
}

test('marks the paragraph the answer currently ends in', async () => {
	await render('Revenue grew.\n\nFees fell')
	expect(carets()).toEqual(['p:Fees fell'])
})

// One mark, not one per nesting level: a `:last-child` rule would draw a caret on the list, the item
// and the paragraph at once.
test('marks the deepest trailing item of a nested list', async () => {
	await render('- Chains\n  - Ethereum\n  - Solana')
	expect(carets()).toEqual(['li:Solana'])
})

test('marks a trailing item inside a quote', async () => {
	await render('> Quoted claim\n>\n> Second line')
	expect(carets()).toEqual(['p:Second line'])
})

test('marks a trailing heading', async () => {
	await render('Intro text.\n\n## Revenue')
	expect(carets()).toEqual(['h2:Revenue'])
})

// The caret belongs to the block, not to whichever inline element happens to end it.
test('marks the paragraph, not a trailing inline element', async () => {
	await render('Call `getRevenue`')
	expect(carets()).toEqual(['p:Call getRevenue'])
})

test.each([
	['code block', '<pre><code>select 1</code></pre>'],
	['table', '<table><tbody><tr><td>123</td></tr></tbody></table>']
])('leaves a trailing nested %s alone, then resumes on following text', async (_, block) => {
	await render(`<ul><li>Details:${block}</li></ul>`)
	expect(carets()).toEqual([])

	await render(`<ul><li>Details:${block}<p>More details</p></li></ul>`)
	expect(carets()).toEqual(['p:More details'])
})

test('draws no caret once the answer is not the one streaming', async () => {
	await render('Revenue grew.\n\nFees fell', false)
	expect(container.textContent).toContain('Fees fell')
	expect(carets()).toEqual([])
})
