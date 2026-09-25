// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { readTableRows } from '~/components/TableImage/TableImageButtons'
import type { UnifiedCitationReference } from '~/containers/LlamaAI/types'
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

const TABLE = `| Protocol | Fees |
| --- | --- |
| Aave [1] | 1.1m |
`

const WEB_REF: UnifiedCitationReference = {
	id: 1,
	sourceType: 'web',
	label: 'Coverage',
	url: 'https://blockworks.co/news/ethena-fees'
}
const DATA_REF: UnifiedCitationReference = { id: 1, sourceType: 'data', label: 'Aave fees row', value: '1.1m' }

async function render(content: string, citations: Array<UnifiedCitationReference> | undefined, isStreaming = true) {
	await act(async () =>
		root.render(
			<ChatMarkdownRenderer content={content} citations={citations} isStreaming={isStreaming} messageId="m1" />
		)
	)
}

const marker = () => container.querySelector('[data-citation-pending], button[aria-label^="Source"]')

// The pending marker reserves the text the resolved pill shows, so the cell does not change width.
test('a pending marker in a cell reserves the number its resolved pill shows', async () => {
	await render(TABLE, undefined)
	expect(marker()?.textContent).toBe('1')

	await render(TABLE, [DATA_REF])
	expect(container.querySelector('[data-citation-pending]')).toBeNull()
	expect(container.querySelector('td button[aria-label^="Source"]')?.textContent).toBe('1')
})

// A domain is wider than the number the marker reserved, so in a cell the number stays.
test('a web citation in a cell keeps its number and keeps the source reachable', async () => {
	await render(TABLE, [WEB_REF])
	const pill = container.querySelector('button[aria-label^="Source"]')
	expect(pill?.textContent).toBe('1')
	expect(pill?.getAttribute('aria-label')).toContain('Source 1')
	expect(container.textContent).not.toContain('blockworks.co')
})

test('a web citation in a paragraph still shows its domain', async () => {
	await render('Fees fell [1] this quarter.', [WEB_REF])
	expect(container.querySelector('button[aria-label^="Source"]')?.textContent).toBe('blockworks.co')
})

test('an unresolved marker in a paragraph shows nothing', async () => {
	await render('Fees fell [1] this quarter.', undefined)
	expect(marker()).toBeNull()
	// The marker leaves an empty element behind, which HTML collapses; a reader sees one space.
	expect(container.textContent?.replace(/\s+/g, ' ')).toBe('Fees fell this quarter.')
})

// Exports read the rendered cells, so an unresolved marker must leave the text it was sitting in
// intact. Read through the real export helper rather than a copy of its normalization.
test('an export of a settled cell carries no gap from an unresolved marker', async () => {
	await render('| Protocol | Note |\n| --- | --- |\n| Aave | grew [1] fast |\n', undefined, false)
	const table = container.querySelector('table.llamaai-table-inline') as HTMLTableElement | null
	expect(readTableRows(table)).toEqual([
		['Protocol', 'Note'],
		['Aave', 'grew fast']
	])
})

test('a pending marker does not read as a resolved source', async () => {
	await render(TABLE, undefined)
	const pending = container.querySelector('[data-citation-pending]')
	expect(pending?.tagName).toBe('SPAN')
	expect(pending?.getAttribute('aria-hidden')).toBe('true')
	expect(container.querySelector('button[aria-label^="Source"]')).toBeNull()
})

test('a multi-digit reference reserves its own digits', async () => {
	const table = TABLE.replace('[1]', '[12]')
	await render(table, undefined)
	expect(marker()?.textContent).toBe('12')
	await render(table, [{ ...DATA_REF, id: 12 }])
	expect(marker()?.textContent).toBe('12')
})

// `[0]` is array syntax in a data cell, not a reference that has yet to land.
test('does not reserve a slot for a zero marker', async () => {
	await render(TABLE.replace('[1]', '[0]'), undefined)
	expect(container.querySelector('[data-citation-pending]')).toBeNull()
	expect(container.querySelector('td')?.textContent).toMatch(/^Aave/)
})

test('a settled answer keeps no pending markers', async () => {
	await render(TABLE, undefined, false)
	expect(container.querySelector('[data-citation-pending]')).toBeNull()
	expect(container.querySelector('td')?.textContent?.trim()).toBe('Aave')
})

// Punctuation cleanup runs on the markdown string, so a marker that is removed during rendering
// leaves the space it was sitting in behind.
test('an unresolved marker in prose leaves no gap before punctuation', async () => {
	await render('Fees rose [1].', undefined)
	expect(container.textContent).toBe('Fees rose.')
})

test('a resolved marker in prose keeps one space before the pill', async () => {
	await render('Fees rose [1].', [WEB_REF])
	expect(container.textContent).toBe('Fees rose blockworks.co.')
})

// Substitution must not reach inside code: a fenced example is text a reader copies.
test('leaves array syntax in a fenced code block alone', async () => {
	await render('```js\nconst first = arr[1]\n```\n', [DATA_REF])
	expect(container.querySelector('pre')?.textContent).toContain('const first = arr[1]')
	expect(container.querySelector('button[aria-label^="Source"]')).toBeNull()
})

test('leaves array syntax in an inline code span alone', async () => {
	await render('Read `arr[1]` first.', [DATA_REF])
	const code = container.querySelector('code')?.textContent ?? ''
	expect(code).toBe('arr[1]')
})

const HTML_TABLE = `<table><thead><tr><th>Metric</th></tr></thead><tbody><tr><td>Revenue [1]</td></tr></tbody></table>`

// Models sometimes emit a table as HTML rather than markdown. `rehypeRaw` turns it into real
// elements, so citations inside it must resolve like any other cell.
test('resolves a citation inside a raw HTML table cell', async () => {
	await render(HTML_TABLE, [DATA_REF])
	const pill = container.querySelector('td button[aria-label^="Source"]')
	expect(pill?.textContent).toBe('1')
	expect(container.querySelector('td')?.textContent).toBe('Revenue 1')
})

test('reserves a pending marker inside a raw HTML table cell', async () => {
	await render(HTML_TABLE, undefined)
	expect(container.querySelector('td [data-citation-pending]')?.textContent).toBe('1')
})
