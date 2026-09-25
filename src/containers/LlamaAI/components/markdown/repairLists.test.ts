import type { Root } from 'mdast'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { expect, test } from 'vitest'
import { createSegmentProcessors, createSegmentRenderer } from './markdownSegments'
import { mendStreamingMarkdown } from './mendStreamingMarkdown'
import { detachOrderedLists, nestIndentedLists } from './repairLists'
import { SANITIZE_REHYPE_PLUGINS } from './sanitizeConfig'

const parser = unified().use(remarkParse).use(remarkGfm, { singleTilde: false })
const parse = (source: string) => parser.parse(source) as Root
const detach = (source: string) => detachOrderedLists(source, parse(source))

test.each([
	// CommonMark lets only a `1.` item interrupt a paragraph; a header followed by `4.` is one paragraph.
	['**Product**\n4. a\n5. b', '**Product**\n\n4. a\n5. b'],
	['Text\n10. a', 'Text\n\n10. a'],
	['Text\n4) a', 'Text\n\n4) a'],
	// Only the first break needs a blank line; splitting every item would make the list loose.
	['**H**\n4. a\n5. b\n6. c', '**H**\n\n4. a\n5. b\n6. c'],
	// A `1.` item already interrupts the paragraph.
	['**Contagion**\n1. a\n2. b', null],
	// Already separated.
	['**H**\n\n4. a', null],
	// Items inside a list continue it; nothing to detach.
	['1. a\n4. b', null],
	// Not a paragraph: code is never rewritten.
	['```\nfoo\n4. bar\n```', null],
	// A number without a marker space is prose.
	['Text\n4.5 million', null]
])('detachOrderedLists(%j)', (source, expected) => {
	expect(detach(source)).toBe(expected)
})

const nest = (source: string) => nestIndentedLists(source, parse(source))

test.each([
	// A sub-list nests only at the item's content column (3 after `2. `); shallower indents split the list.
	['1. a\n2. b\n - x\n - y\n3. c', '1. a\n2. b\n   - x\n   - y\n3. c'],
	['1. a\n2. b\n  - x\n3. c', '1. a\n2. b\n   - x\n3. c'],
	['9. a\n10. b\n  - x\n11. c', '9. a\n10. b\n    - x\n11. c'],
	// Every line of the sub-list moves, including its own nested content.
	['1. a\n - x\n   more\n2. b', '1. a\n   - x\n     more\n2. b'],
	// Already nested.
	['1. a\n   - x\n2. b', null],
	// Flush-left bullets after a numbered list are a separate list on purpose.
	['1. a\n\n- x\n- y', null],
	['1. a\n- x', null],
	// Not lists: code is never rewritten.
	['```\n1. a\n - x\n```', null]
])('nestIndentedLists(%j)', (source, expected) => {
	expect(nest(source)).toBe(expected)
})

const detached = 'Intro:\n2. two\n3. three\n\n'
const nested = '1. one\n - nested\n2. two\n\n'
const both = 'Intro:\n2. two\n3. three\n - nested\n4. four\n\n'
const repairStages = [detachOrderedLists, nestIndentedLists]

test.each([
	'**Contagion**\n1. a\n2. b\n\n**Product**\n4. c\n5. d\n\n',
	both,
	`${detached}\`\`\`\nText\n4. literal\n - literal\n\`\`\`\n\n`,
	`${nested}[link][ref]\n\n[ref]: https://example.com\n\n`,
	`${both}\uFEFFtext\n\n`
])(
	'cached segment rendering matches repairing and rendering the whole prefix, through growth, rewinds and completion: %j',
	(head) => {
		const renderer = createSegmentRenderer({})
		const processors = createSegmentProcessors(SANITIZE_REHYPE_PLUGINS, SANITIZE_REHYPE_PLUGINS)
		const source = `${head}First paragraph.\n\nSecond paragraph.\n\nTrailing **bold** and [link](https://example.com).`
		const prefixes: Array<string> = []
		for (let end = 1; end <= source.length; end++) prefixes.push(source.slice(0, end))
		// Revisit earlier cache stages and replace the repaired prefix with well-formed input.
		prefixes.push(source.slice(0, 8), source, 'Intro:\n\n2. two\n3. three\n\nFinished.', source, '')
		// One renderer instance across every prefix is what exercises the segment and parser caches.
		for (const content of prefixes) {
			for (const mend of [true, false]) {
				let repaired = content
				for (const repair of mend ? [...repairStages, mendStreamingMarkdown] : repairStages) {
					repaired = repair(repaired, parse(repaired)) ?? repaired
				}
				const expected = renderToStaticMarkup(
					createElement(
						ReactMarkdown,
						{ remarkPlugins: [[remarkGfm, { singleTilde: false }]], rehypePlugins: SANITIZE_REHYPE_PLUGINS },
						repaired
					)
				)
				const actual = renderToStaticMarkup(createElement(Fragment, null, renderer.render(content, processors, mend)))
				expect(actual, `${JSON.stringify(content)}, mend=${mend}`).toBe(expected)
			}
		}
	}
)
