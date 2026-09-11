// @vitest-environment happy-dom
import type { Root } from 'mdast'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { expect, test } from 'vitest'
import { ChatMarkdownRenderer } from './ChatMarkdownRenderer'
import { createSegmentProcessors, createSegmentRenderer } from './markdownSegments'
import { mendStreamingMarkdown } from './mendStreamingMarkdown'
import { detachOrderedLists, nestIndentedLists } from './repairLists'
import { SANITIZE_REHYPE_PLUGINS } from './sanitizeConfig'

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

const detached = 'Intro:\n2. two\n3. three\n\n'
const nested = '1. one\n - nested\n2. two\n\n'
const both = 'Intro:\n2. two\n3. three\n - nested\n4. four\n\n'

test.each([
	'**Contagion/Copycat**\n1. a\n2. b\n3. c\n\n**Product/Policy Response**\n4. d\n5. e\n6. f\n\n**Market/Financial Impact**\n7. g\n8. h\n9. i\n\n',
	detached,
	nested,
	both,
	`${detached}\`\`\`\nText\n4. literal\n - literal\n\`\`\`\n\n`,
	`${nested}[link][ref]\n\n[ref]: https://example.com\n\n`,
	`${both}\uFEFFtext\n\n`
])('cached repairs match full parsing through growth, rewinds and completion: %s', async (head) => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const container = document.createElement('div')
	const reference = document.createElement('div')
	document.body.append(container, reference)
	const root = createRoot(container)
	const referenceRoot = createRoot(reference)
	const renderer = createSegmentRenderer({})
	const processors = createSegmentProcessors(SANITIZE_REHYPE_PLUGINS, SANITIZE_REHYPE_PLUGINS)
	const fullParser = unified().use(remarkParse).use(remarkGfm, { singleTilde: false })
	const source = `${head}First paragraph.\n\nSecond paragraph.\n\nTrailing **bold** and [link](https://example.com).`
	const prefixes: Array<string> = []
	for (let end = 1; end <= source.length; end++) prefixes.push(source.slice(0, end))
	// Revisit earlier cache stages and replace the repaired prefix with well-formed input.
	prefixes.push(source.slice(0, 8), source, 'Intro:\n\n2. two\n3. three\n\nFinished.', source, '')
	try {
		for (const content of prefixes) {
			for (const mend of [true, false]) {
				let repaired = content
				for (const repair of [detachOrderedLists, nestIndentedLists, ...(mend ? [mendStreamingMarkdown] : [])]) {
					repaired = repair(repaired, fullParser.parse(repaired) as Root) ?? repaired
				}
				await act(async () => {
					root.render(<>{renderer.render(content, processors, mend)}</>)
					referenceRoot.render(
						<ReactMarkdown
							remarkPlugins={[[remarkGfm, { singleTilde: false }]]}
							rehypePlugins={SANITIZE_REHYPE_PLUGINS}
						>
							{repaired}
						</ReactMarkdown>
					)
				})
				expect(container.innerHTML, `${JSON.stringify(content)}, mend=${mend}`).toBe(reference.innerHTML)
			}
		}
	} finally {
		await act(async () => {
			root.unmount()
			referenceRoot.unmount()
		})
		container.remove()
		reference.remove()
	}
})
