// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test } from 'vitest'
import { readTableRows } from '~/components/TableImage/TableImageButtons'
import type { UnifiedCitationReference } from '~/containers/LlamaAI/types'
import { ChatMarkdownRenderer } from './ChatMarkdownRenderer'

test('streamed blocks keep headings, links, citations and exportable tables reactive under compilation', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	const refs: Array<UnifiedCitationReference> = [{ id: 1, sourceType: 'data', label: 'Fees', value: '$12' }]
	async function render(content: string, citations?: Array<UnifiedCitationReference>, isStreaming = true) {
		await act(async () =>
			root.render(
				<ChatMarkdownRenderer
					content={content}
					citations={citations}
					isStreaming={isStreaming}
					showStreamingCaret={isStreaming}
					messageId="message-a"
				/>
			)
		)
	}
	try {
		const beginning = '## Revenue\n\n[Source][later]\n\n| Asset | Fees |\n| --- | --- |\n| Aave [1] | $12 |\n\n'
		await render(beginning)
		const heading = container.querySelector('h2')!
		const table = container.querySelector('table')!
		const continuation = '## Revenue\n\n- First\n  - Nested\n\n```js\nconst values = [1]\n```\n\nAfter the fence.'
		let content = beginning
		for (let end = 7; end < continuation.length + 7; end += 7) {
			content = beginning + continuation.slice(0, end)
			// Each chunk must commit: batching the whole loop would skip the streaming transitions.
			await render(content)
			expect(container.querySelector('h2')).toBe(heading)
			expect(heading.id).toBe('message--revenue')
			expect(container.querySelector('table')).toBe(table)
		}
		await render(content, refs)
		expect(table.querySelector('button[aria-label^="Source 1"]')).not.toBeNull()
		expect(container.querySelector('pre')?.textContent).toContain('const values = [1]')
		expect(container.querySelector('ul ul li')?.textContent).toBe('Nested')
		expect([...container.querySelectorAll('h2')].map((node) => node.id)).toEqual([
			'message--revenue',
			'message--revenue-1'
		])
		await render(`${content}\n\n[later]: https://example.com\n`, refs, false)
		expect(container.querySelector('a[href="https://example.com"]')?.textContent).toBe('Source')
		expect(readTableRows(container.querySelector('table')!)).toEqual([
			['Asset', 'Fees'],
			['Aave 1', '$12']
		])
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})
