// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test } from 'vitest'
import { ChatMarkdownRenderer } from './ChatMarkdownRenderer'

test('a bold header directly followed by a list starting at 4 renders as a list, streaming and finished', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	const source = '**Contagion**\n1. a\n2. b\n\n**Product**\n4. c\n5. d'
	const draw = (content: string, isStreaming: boolean) =>
		act(async () => root.render(<ChatMarkdownRenderer content={content} isStreaming={isStreaming} />))
	try {
		for (const isStreaming of [true, false]) {
			await draw(source, isStreaming)
			expect(Array.from(container.querySelectorAll('ol'), (ol) => ol.getAttribute('start'))).toEqual([null, '4'])
			expect(Array.from(container.querySelectorAll('li > span'), (m) => m.textContent)).toEqual([
				'1.',
				'2.',
				'4.',
				'5.'
			])
			expect(container.querySelectorAll('p strong')[1]?.textContent).toBe('Product')
		}
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})

test('bullets indented one space under a numbered item render nested, streaming and finished', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	const source = '1. a\n2. **b**\n - x\n - y\n3. c'
	const draw = (content: string, isStreaming: boolean) =>
		act(async () => root.render(<ChatMarkdownRenderer content={content} isStreaming={isStreaming} />))
	try {
		for (const isStreaming of [true, false]) {
			await draw(source, isStreaming)
			expect(container.querySelectorAll('ol')).toHaveLength(1)
			expect(Array.from(container.querySelectorAll('ol > li > span'), (m) => m.textContent)).toEqual(['1.', '2.', '3.'])
			expect(container.querySelectorAll('ol > li ul > li')).toHaveLength(2)
		}
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})
