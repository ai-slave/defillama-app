// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { expect, test } from 'vitest'
import { createSegmentProcessors, createSegmentRenderer } from './markdownSegments'
import { rehypeCitationMarkers } from './rehypeCitationMarkers'
import { rehypeHeadingIds } from './rehypeHeadingIds'
import { rehypeStreamingCaret } from './rehypeStreamingCaret'
import { SANITIZE_REHYPE_PLUGINS } from './sanitizeConfig'

const fixtures = [
	'## Revenue\n\nOne **bold** paragraph [1].\n\n## Revenue\n\n[link](https://example.com) and `arr[1]`.\n\n## Revenue\n',
	'Setext\n------\n\nA | B\n-- | --\n1 | 2\n3 [2] | 4\n\nAfter the table.\n',
	'- First\n  - Nested\n\n    Still nested\n\n- Second\n\n    ```js\n    const a = [1]\n    ```\n\nOutside\n',
	'> first\ncontinued lazily\n>\n> ## Heading\n>\n> - item\n>   continued\n\nAfter\n',
	'[Later][ref], ![image][ref] and [ref].\n\nOther paragraph\n\n[ref]: https://example.com "title"\n\n[ref]\n',
	'A footnote[^a].\n\nOther paragraph\n\n[^a]: First line\n\n    Second line\n\nEnd[^a].\n',
	'<div>\n\n## Inside HTML\n\n</div>\n\n<table><tr><td>Revenue [1]</td></tr></table>\n\nAfter\n',
	'<table>\n<tr><td>Fees [3]</td></tr>\n\n<tr><td>Revenue</td></tr>\n</table>\n\n## Heading\n\nText <span style="color: red">styled</span>.\n',
	'Intro\n\n````md\n```\n# Not a heading\n\n```\n````\n\n## Heading\n\n    indented code\n\nEnd\n',
	'[bad](javascript:alert(1)) and ![img](data:text/html,x) and [ok](https://example.com/a?b=c#d)\n\n- a\n- b [4]\n\n1. x\n2. y\n',
	'## Unicode 🦙\n\nA &amp; B <b>bold</b> <script>alert(1)</script>\n\n---\n\nEnd\n',
	'Inline <span class="x">open\n\n## Swallowed\n\nStill inside</span> and out\n\n## Free\n',
	'<!-- <div> -->\n\nA <br> B <img src="https://example.com/a.png"> C\n\n</div> stray\n\n## After\n'
]

const rehype = (caret: boolean) => [
	...SANITIZE_REHYPE_PLUGINS,
	[rehypeCitationMarkers, { resolvedIds: new Set([1, 2]), reserveInTables: true }],
	[rehypeHeadingIds, { messageId: 'message-a' }],
	[rehypeStreamingCaret, { active: caret }]
]

function mount() {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const container = document.createElement('div')
	document.body.append(container)
	return { container, root: createRoot(container) }
}

test.each(fixtures)(
	'segments render the same HTML as the whole document at every streamed prefix: %s',
	async (source) => {
		const reference = mount()
		const segmented = mount()
		const { render } = createSegmentRenderer({})
		const processors = createSegmentProcessors(rehype(false), rehype(true))
		try {
			for (let end = 1; end <= source.length; end += 5) {
				const content = end + 5 > source.length ? source : source.slice(0, end)
				await act(async () => {
					reference.root.render(
						<ReactMarkdown remarkPlugins={[[remarkGfm, { singleTilde: false }]]} rehypePlugins={rehype(true)}>
							{content}
						</ReactMarkdown>
					)
					segmented.root.render(<>{render(content, processors)}</>)
				})
				expect(segmented.container.innerHTML, `at ${content.length} characters`).toBe(reference.container.innerHTML)
			}
		} finally {
			await act(async () => {
				reference.root.unmount()
				segmented.root.unmount()
			})
			reference.container.remove()
			segmented.container.remove()
		}
	}
)

test('streaming rebuilds the growing block, not every finished block before it', () => {
	let builds = 0
	const countBuilds = () => () => {
		builds += 1
	}
	const { render } = createSegmentRenderer({})
	const processors = createSegmentProcessors([...rehype(false), countBuilds], [...rehype(true), countBuilds])
	const source =
		'## Revenue\n\nOne paragraph.\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n- first\n- second\n\n## Fees\n\nTrailing text grows here.\n'
	for (let end = 1; end <= source.length; end++) render(source.slice(0, end), processors)

	// Rebuilding every block on every prefix costs several builds per prefix; caching costs about one.
	expect(builds).toBeLessThan(source.length * 1.5)
})
