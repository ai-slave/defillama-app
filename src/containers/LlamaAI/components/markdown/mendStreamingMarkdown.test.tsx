// @vitest-environment happy-dom
import type { Root } from 'mdast'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { expect, test } from 'vitest'
import { ChatMarkdownRenderer } from './ChatMarkdownRenderer'
import { mendStreamingMarkdown } from './mendStreamingMarkdown'

const parser = unified().use(remarkParse).use(remarkGfm, { singleTilde: false })
const mend = (source: string) => mendStreamingMarkdown(source, parser.parse(source) as Root) ?? source

test.each([
	// A trailing `-` after text is a setext underline until the next character makes it a list item.
	['Fees rose.\n-', 'Fees rose.\n'],
	['Fees rose.\n--', 'Fees rose.\n'],
	['Fees rose.\n=', 'Fees rose.\n'],
	// A complete underline line is a heading and stays one.
	['Fees rose.\n---\n', 'Fees rose.\n---\n'],
	// After a blank line the same characters are a thematic break or an empty item: no flip, keep them.
	['Fees rose.\n\n---', 'Fees rose.\n\n---'],
	['Fees rose.\n\n-', 'Fees rose.\n\n-'],
	// A heading with no text yet is held back until text arrives, not only until the space.
	['Intro\n\n#', 'Intro\n\n'],
	['Intro\n\n##', 'Intro\n\n'],
	['Intro\n\n## ', 'Intro\n\n'],
	['Intro\n\n##   ', 'Intro\n\n'],
	['Intro\n\n## F', 'Intro\n\n## F'],
	['Intro\n\n## Fees', 'Intro\n\n## Fees'],
	// Unclosed inline markers close; single `*` and `_` are left alone.
	['Aave **led', 'Aave **led**'],
	['Run `bun test', 'Run `bun test`'],
	['Run ``bun ` test', 'Run ``bun ` test``'],
	['Was ~~down', 'Was ~~down~~'],
	['Aave *led', 'Aave *led'],
	['snake_case', 'snake_case'],
	['**bold** and `code` done', '**bold** and `code` done'],
	// Markdown context: valid code spans and spaced literals are not markers.
	['Use ``a`b`` here', 'Use ``a`b`` here'],
	['Run `**` now', 'Run `**` now'],
	['2 ** 3 is 8', '2 ** 3 is 8'],
	['Escaped \\*\\*not bold', 'Escaped \\*\\*not bold'],
	['Escaped \\**not bold', 'Escaped \\**not bold'],
	['A literal \\` backtick', 'A literal \\` backtick'],
	['A literal \\~\\~ tilde', 'A literal \\~\\~ tilde'],
	// Markers inside a completed link, emphasis or strong are enclosed by a closed node; nothing outside
	// could pair with them, so they are not pending openers.
	['See [**Aave](https://defillama.com) now', 'See [**Aave](https://defillama.com) now'],
	['See [a `b](https://defillama.com) now', 'See [a `b](https://defillama.com) now'],
	['*a **b* c', '*a **b* c'],
	['**a `b** c', '**a `b** c'],
	['See [**Aave](https://defillama.com) and **bo', 'See [**Aave](https://defillama.com) and **bo**'],
	['A &amp; B **bo', 'A &amp; B **bo**'],
	// An unfinished link keeps its text; an unfinished image is hidden.
	['See [Aave](https://defillama.com/prot', 'See [Aave]()'],
	['See ![chart](https://defillama.com/ch', 'See '],
	['See [Aave](https://defillama.com/protocol/aave)', 'See [Aave](https://defillama.com/protocol/aave)'],
	['See [Aave', 'See [Aave'],
	['**See [Aave](https://ll', '**See [Aave]()**'],
	// Inside code, at any nesting, nothing is touched.
	['```js\nconst a = `x', '```js\nconst a = `x'],
	['```\n-', '```\n-'],
	['> ```js\n> const a = `x **', '> ```js\n> const a = `x **'],
	['- item\n\n  ```\n  -', '- item\n\n  ```\n  -'],
	['    indented `code', '    indented `code'],
	['```js\nx\n```\n\nAfter **bo', '```js\nx\n```\n\nAfter **bo**'],
	// Text inside list items and quotes is mended too.
	['- Aave **led', '- Aave **led**'],
	['> Note `bun', '> Note `bun`'],
	// Earlier blocks are never rewritten.
	['Odd ` here.\n\nNew **bold', 'Odd ` here.\n\nNew **bold**'],
	['Fees rose.\n-\n\nNext', 'Fees rose.\n-\n\nNext']
])('mends %j', (input, expected) => {
	expect(mend(input)).toBe(expected)
})

test('the renderer holds a partial underline back while streaming and renders the final text exactly', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	const draw = (content: string, isStreaming: boolean) =>
		act(async () => root.render(<ChatMarkdownRenderer content={content} isStreaming={isStreaming} />))
	try {
		await draw('Fees rose sharply.\n-', true)
		expect(container.querySelector('h2')).toBeNull()
		expect(container.querySelector('p')?.textContent).toBe('Fees rose sharply.')

		await draw('Fees rose sharply.\n- Aave **led', true)
		expect(container.querySelector('li strong')?.textContent).toBe('led')
		expect(container.textContent).not.toContain('*')

		await draw('Fees rose sharply.\n- Aave **led**\n\n## ', true)
		expect(container.querySelector('h2')).toBeNull()

		// Valid code that merely contains a marker is left as the parser saw it.
		await draw('Run `**` now', true)
		expect(container.querySelector('code')?.textContent).toBe('**')
		expect(container.querySelector('p')?.textContent).toBe('Run ** now')

		// The same source after the stream ends is parsed as written.
		await draw('Fees rose sharply.\n-', false)
		expect(container.querySelector('h2')?.textContent).toBe('Fees rose sharply.')
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})

test.each([
	'[https://example.com/a',
	'[https://example.com/a **bold**',
	'[https://example.com/a `code`',
	'![https://example.com/a',
	'First paragraph.\n\nSecond paragraph.\n\n[https://example.com/a **bold**',
	'[https://example.com/a](https://example.com/b)',
	'[hello@example.com',
	'**Read [https://example.com/a',
	'> [https://example.com/a',
	'- [https://example.com/a'
])('renders every streaming prefix of %j and its finished form', async (source) => {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	try {
		for (let end = 1; end <= source.length; end++) {
			const content = source.slice(0, end)
			expect(() => mend(content)).not.toThrow()
			// Each prefix must commit before the next to exercise the incremental parser cache.
			await act(async () => root.render(<ChatMarkdownRenderer content={content} isStreaming />))
		}
		await act(async () => root.render(<ChatMarkdownRenderer content={source} isStreaming={false} />))
		expect(container.querySelector('a')).not.toBeNull()
		expect(container.textContent).toContain(source.includes('hello@') ? 'hello@example.com' : 'https://example.com/a')
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})

test('stress streams malformed Markdown through cached and fresh renderers', async () => {
	const fragments = [
		'[https://example.com/a **bold** and `code`',
		'![www.example.com/image] and [hello@example.com',
		'[label](https://example.com/a_(b)) and ![alt](https://example.com/image)',
		'[reference][later]\n\n[later]: https://example.com "Title"',
		'Footnote[^note]\n\n[^note]: **Details** and [link](https://example.com)',
		'| Name | Value |\n| --- | --- |\n| A [1] | **12** |\n| B | `x` |',
		'<div>\n\n**Nested** [https://example.com/a\n\n</div>',
		'<table><tr><td>Value &amp; [1]</td></tr></table>',
		'```js\nconst text = "[https://example.com/a **"\n```\n\nAfter **bold**',
		'Escaped \\[literal] &amp; &#91;https://example.com/a ~~strike~~',
		'Heading\n---\n\n## 🦙\n\nUnicode 😀 and null \u0000 text',
		'[link](javascript:alert(1)) <img src="x" onerror="alert(1)">'
	]
	const host = document.createElement('div')
	const freshHost = document.createElement('div')
	document.body.append(host, freshHost)
	const root = createRoot(host)
	const freshRoot = createRoot(freshHost)
	const snapshot = (element: HTMLElement) => ({
		text: element.textContent,
		links: [...element.querySelectorAll('a')].map((link) => link.getAttribute('href')),
		headings: [...element.querySelectorAll('h1,h2,h3')].map((heading) => heading.id),
		code: [...element.querySelectorAll('code')].map((code) => code.textContent)
	})
	let renders = 0
	try {
		for (const [index, fragment] of fragments.entries()) {
			for (const prefix of ['', '> ', '- ', '> - ']) {
				const source = `## Start\n\nStable paragraph.\n\n${prefix}${fragment}\n\n## End\n\nDone.`
				let end = 0
				while (end < source.length) {
					end = Math.min(source.length, end + [1, 2, 7, 19][(renders + index) % 4])
					const content = source.slice(0, end)
					// Commit each chunk to exercise parser reuse and streaming repair together.
					await act(async () => root.render(<ChatMarkdownRenderer content={content} isStreaming />))
					renders++
				}
				// Compare the completed streamed instance with a newly mounted, finished instance.
				await act(async () => {
					root.render(<ChatMarkdownRenderer content={source} isStreaming={false} />)
					freshRoot.render(<ChatMarkdownRenderer key={`${index}:${prefix}`} content={source} isStreaming={false} />)
				})
				expect(snapshot(host)).toEqual(snapshot(freshHost))
				expect(host.querySelector('script,[onerror]')).toBeNull()
				expect(
					[...host.querySelectorAll('a')].some((link) => link.getAttribute('href')?.startsWith('javascript:'))
				).toBe(false)
			}
		}
	} finally {
		await act(async () => {
			root.unmount()
			freshRoot.unmount()
		})
		host.remove()
		freshHost.remove()
	}
})
