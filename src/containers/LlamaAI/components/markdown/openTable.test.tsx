// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { expect, test } from 'vitest'
import { createSegmentProcessors, createSegmentRenderer } from './markdownSegments'
import { rehypeCitationMarkers } from './rehypeCitationMarkers'
import { rehypeStreamingCaret } from './rehypeStreamingCaret'
import { createRemarkIncremental } from './remarkIncremental'
import { SANITIZE_REHYPE_PLUGINS } from './sanitizeConfig'

const header = '| Protocol | Revenue |\n| --- | ---: |\n'
const fixtures = [
	`${header}| A | 1 |\n| B | 2 |\n| C | \`x|y\` |\n`,
	`${header}| A | 1 |\n| B | 2 |\n| C | [bad](javascript:alert(1)) |\n`,
	`${header}| A | 1 |\n| B | 2 |\n| C | \`code\n| D | continuation\` |\n`,
	'| A | B | C |\n| - | - | - |\n| one |\n| two | three | four | extra |\n| last | cell |\n',

	`${header}| Aave | $123 [1] |\n| Curve | **$45** |\n| Maker | \`a\\|b\` |\n`,
	`## Before\n\n${header}| A | 1 |\n| B | 2 |\n\nAfter the table.\n`,
	`${header}| A | [later][ref] |\n| B | 2 |\n\n[ref]: https://example.com\n`,
	`${header}| A | [^n] |\n| B | 2 |\n\n[^n]: note\n`,
	`${header}| A | 1 |\n| B | 2 |\nNot a pipe row\n\nParagraph\n`,
	`${header}| A | 1 |\n| B | 2 |\n| C | escaped \\| pipe |\n`,
	`${header}| A | 1 |\n| B | 2 |\n| C | <span>html</span> |\n`,
	`${header}| A | 1 |\n| B | 2 |\n| C | <table><tr><td>x</td></tr></table> |\n`,
	`${header.replaceAll('\n', '\r\n')}| A | 1 |\r\n| B | 2 |\r\n`,
	`> ${`${header}| A | 1 |\n| B | 2 |`.replaceAll('\n', '\n> ')}`,
	`${header}| A | 1 |\n| B | 2 |\n---\n`,
	`${header}| A | 1 |\n| B | 2 |\n\n# After\n`,
	'| One |\n| --- |\n| First |\n| Second |\n',
	`${header}| A | 1 |\n| B | 2 |\n| C | **bold\n`
]
const parse = () => unified().use(remarkParse).use(remarkGfm, { singleTilde: false })

test.each(fixtures)('open table parser matches every full prefix: %s', (source) => {
	const cached = parse().use(createRemarkIncremental())
	const reference = parse()
	for (let end = 1; end <= source.length; end++)
		expect(cached.parse(source.slice(0, end)), `prefix ${end}`).toEqual(reference.parse(source.slice(0, end)))
})

test('header and earlier row rewrites discard parsed rows', () => {
	const cached = parse().use(createRemarkIncremental()),
		reference = parse()
	const source = `${header}| A | 1 |\n| B | 2 |\n| C | 3 |`
	for (const text of [
		source,
		`${source}0`,
		source.replace('Revenue', 'Fees'),
		source.replace('| A | 1 |', '| Updated | 7 |'),
		source.slice(0, 24),
		source
	])
		expect(cached.parse(text)).toEqual(reference.parse(text))
})

test('a growing table costs a small fraction of reparsing every prefix', () => {
	let parsedChars = 0
	const parser = parse()
		.use(function countInput() {
			const full = this.parser!
			this.parser = (source, file) => {
				parsedChars += source.length
				return full(source, file)
			}
		})
		.use(createRemarkIncremental())
	let rows = ''
	for (let index = 0; index < 60; index++) rows += `| Protocol ${index} | ${index * 1000} |\n`
	const source = header + rows
	let fullChars = 0
	for (let end = header.length + 20; end <= source.length; end += 3) {
		fullChars += end
		parser.parse(source.slice(0, end))
	}
	// A work budget, not a fixed count: further improvements remain valid, slow machines cannot fail.
	expect(parsedChars).toBeLessThan(fullChars / 5)
})

const plugins = (resolvedIds = new Set<number>()) => [
	...SANITIZE_REHYPE_PLUGINS,
	[rehypeCitationMarkers, { resolvedIds, reserveInTables: true }]
]
const processors = (ids = new Set<number>()) => {
	const p = plugins(ids)
	return {
		...createSegmentProcessors(p, [...p, [rehypeStreamingCaret, { active: true }]]),
		cacheTableRows: true as const
	}
}

test.each(fixtures)('cached table HTML matches the full pipeline at every prefix: %s', (source) => {
	const renderer = createSegmentRenderer({}),
		p = processors()
	for (let end = 1; end <= source.length; end++) {
		const text = source.slice(0, end)
		const expected = renderToStaticMarkup(
			<ReactMarkdown
				remarkPlugins={[[remarkGfm, { singleTilde: false }]]}
				rehypePlugins={[...plugins(), [rehypeStreamingCaret, { active: true }]]}
			>
				{text}
			</ReactMarkdown>
		)
		expect(renderToStaticMarkup(<>{renderer.render(text, p)}</>), `prefix ${end}`).toBe(expected)
	}
})

test('late citations and rewrites update cached rows', () => {
	const renderer = createSegmentRenderer({})
	const source = `${header}| A | [1] |\n| B | 2 |\n| C | 3 |`
	renderer.render(source, processors())
	for (const text of [
		source,
		source.replace('Revenue', 'Fees'),
		source.replace('| A |', '| Updated |'),
		`${source}\n\nDone`
	]) {
		const p = processors(new Set([1]))
		const fresh = createSegmentRenderer({})
		expect(renderToStaticMarkup(<>{renderer.render(text, p)}</>)).toBe(
			renderToStaticMarkup(<>{fresh.render(text, p)}</>)
		)
	}
})

test('unchanged rows do not rerender and custom table components see the complete HAST', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const calls = new Map<number, number>()
	const seen: Array<unknown> = []
	const components = {
		tr: ({ node, children, ...props }: any) => {
			const offset = node.position.start.offset
			calls.set(offset, (calls.get(offset) || 0) + 1)
			return <tr {...props}>{children}</tr>
		},
		table: ({ node, children, ...props }: any) => {
			seen.push(structuredClone(node))
			return <table {...props}>{children}</table>
		}
	}
	const container = document.createElement('div'),
		root = createRoot(container)
	const renderer = createSegmentRenderer(components),
		p = processors()
	const source = `${header}| A | 1 |\n| B | 2 |\n| C | 3`
	try {
		await act(() => root.render(<>{renderer.render(source, p)}</>))
		const first = new Map(calls)
		await act(() => root.render(<>{renderer.render(`${source}0 |`, p)}</>))
		expect(calls.get(header.length)).toBe(first.get(header.length))
		expect(calls.get(header.length + '| A | 1 |\n'.length)).toBe(first.get(header.length + '| A | 1 |\n'.length))
		expect(container.querySelectorAll('tbody tr')).toHaveLength(3)
		expect(container.querySelector('tbody')!.textContent).toContain('30')
		const expected: Array<unknown> = []
		renderToStaticMarkup(
			<ReactMarkdown
				components={{
					table: ({ node, children, ...props }) => {
						expected.push(structuredClone(node))
						return <table {...props}>{children}</table>
					}
				}}
				remarkPlugins={[[remarkGfm, { singleTilde: false }]]}
				rehypePlugins={plugins()}
			>
				{`${source}0 |`}
			</ReactMarkdown>
		)
		expect(seen.at(-1)).toEqual(expected.at(-1))
		const firstRow = container.querySelector('tbody tr')
		await act(() => root.render(<>{renderer.render(`${source.replace('Revenue', 'Total fees')}0 |`, p)}</>))
		expect(container.querySelector('tbody tr')).toBe(firstRow)
	} finally {
		await act(() => root.unmount())
	}
})

test('a hot row cache invalidates on source edits and citation changes', () => {
	const renderer = createSegmentRenderer({}),
		unresolved = processors(),
		resolved = processors(new Set([1]))
	const source = `${header}| A | [1] |\n| B | 2 |\n| C | 3`
	renderer.render(source, unresolved)
	renderer.render(`${source}0 |`, unresolved)
	for (const [text, p] of [
		[source.replace('Revenue', 'Fees'), unresolved],
		[source.replace('| A |', '| Changed |'), unresolved],
		[`${source}0 |\n\nParagraph`, unresolved],
		[`${source}0 |`, unresolved],
		[`${source}0 |\n| D | 4 |`, unresolved],
		[`${source}0 |\n| D | 4 |`, resolved]
	] as const) {
		const actual = renderToStaticMarkup(<>{renderer.render(text, p)}</>)
		const reference = createSegmentRenderer({})
		expect(actual).toBe(renderToStaticMarkup(<>{reference.render(text, { body: p.body, tail: p.tail })}</>))
	}
})
