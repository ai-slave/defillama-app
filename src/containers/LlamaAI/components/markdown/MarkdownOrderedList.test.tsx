// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import { expect, test } from 'vitest'
import { MarkdownOrderedList } from './MarkdownOrderedList'

function renderList(source: string) {
	const container = document.createElement('div')
	container.innerHTML = renderToStaticMarkup(
		<ReactMarkdown components={{ ol: MarkdownOrderedList }}>{source}</ReactMarkdown>
	)
	return container
}

test('preserves continued numbering across six digits', () => {
	const container = renderList('99999. First\n100000. Second')
	expect(container.querySelector('ol')?.getAttribute('start')).toBe('99999')
	expect(Array.from(container.querySelectorAll('li > span'), (marker) => marker.textContent)).toEqual([
		'99999.',
		'100000.'
	])
	expect(Array.from(container.querySelectorAll('li > div'), (item) => item.textContent)).toEqual(['First', 'Second'])
})

test('keeps nested numbering independent and preserves rich list content', () => {
	const container = renderList('1. **First**\n   1. Nested\n   2. Nested again\n2. Second')
	expect(Array.from(container.querySelectorAll('li > span'), (marker) => marker.textContent)).toEqual([
		'1.',
		'1.',
		'2.',
		'2.'
	])
	expect(container.querySelector('li > div > strong')?.textContent).toBe('First')
	expect(container.querySelector('li > div > ol')).not.toBeNull()
})

test('preserves reversed lists and explicit item values', () => {
	const container = document.createElement('div')
	container.innerHTML = renderToStaticMarkup(
		<MarkdownOrderedList reversed>
			<li>First</li>
			<li value={10}>Restart</li>
			<li>Last</li>
		</MarkdownOrderedList>
	)
	expect(Array.from(container.querySelectorAll('li > span'), (marker) => marker.textContent)).toEqual([
		'3.',
		'10.',
		'9.'
	])
})
