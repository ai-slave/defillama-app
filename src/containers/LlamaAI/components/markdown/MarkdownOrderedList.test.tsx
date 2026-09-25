// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import { expect, test } from 'vitest'
import { MarkdownOrderedList } from './MarkdownOrderedList'

function render(node: React.ReactElement) {
	const container = document.createElement('div')
	container.innerHTML = renderToStaticMarkup(node)
	return container
}
const renderMarkdown = (source: string) =>
	render(<ReactMarkdown components={{ ol: MarkdownOrderedList }}>{source}</ReactMarkdown>)
// Each list item as a reader sees it: its visible number followed by its content.
const items = (container: HTMLElement) =>
	Array.from(container.querySelectorAll('li'), (item) => item.textContent?.replace(/\s+/g, ' ').trim())

test('preserves continued numbering across six digits', () => {
	const container = renderMarkdown('99999. First\n100000. Second')
	expect(container.querySelector('ol')?.getAttribute('start')).toBe('99999')
	expect(items(container)).toEqual(['99999.First', '100000.Second'])
})

test('keeps nested numbering independent and preserves rich list content', () => {
	const container = renderMarkdown('1. **First**\n   1. Nested\n   2. Nested again\n2. Second')
	expect(items(container)).toEqual(['1.First 1.Nested2.Nested again', '1.Nested', '2.Nested again', '2.Second'])
	expect(container.querySelector('strong')?.textContent).toBe('First')
	expect(container.querySelectorAll('ol')).toHaveLength(2)
})

test('preserves reversed lists and explicit item values', () => {
	const container = render(
		<MarkdownOrderedList reversed>
			<li>First</li>
			<li value={10}>Restart</li>
			<li>Last</li>
		</MarkdownOrderedList>
	)
	expect(items(container)).toEqual(['3.First', '10.Restart', '9.Last'])
})
