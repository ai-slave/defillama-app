import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { expect, test } from 'vitest'
import { rehypeCitationMarkers } from '../rehypeCitationMarkers'
import { rehypeHeadingIds } from '../rehypeHeadingIds'
import { createRemarkIncremental } from '../remarkIncremental'
import { SANITIZE_REHYPE_PLUGINS } from '../sanitizeConfig'

function freezeTree(value: object) {
	Object.freeze(value)
	for (const child of Object.values(value)) {
		if (child && typeof child === 'object') freezeTree(child)
	}
}

const processor = () => unified().use(remarkParse).use(remarkGfm, { singleTilde: false })

const fixtures = [
	'    foo  \n\n\n10) foo\n    - bar\n******foo******\n\n* Foo\n* more\n',
	'Intro\n\n>     foo\n    bar\n    foo  \n\nEnd\n',
	'Intro\n\n>     foo\n    bar\n\n1.   \n\nEnd\n',
	'[]\n\n[]: /uri\n\n    1.  A paragraph\n        with two lines.\n\n            indented code\n\n        > A block quote.\n\n\n1. - 2. foo\n\n__<a href="url">link</a>__\n',
	'* a\n*\n\n* c\n\n`foo   bar \nbaz`\n\n\n`f&ouml;&ouml;`\n<m:abc>\n-\t\tfoo\n -    one\n\n     two\n\n\n - more\n',

	'- foo\n***\n\nNext paragraph\n',
	'> Foo\n---\n\nNext paragraph\n',
	'Foo\nbar\n* * *\n\nNext paragraph\n',
	'1. foo\n2.\n3. bar\n\nNext paragraph\n',
	'1. a\n\n  2. b\n\nNext paragraph\n',
	'<table><tr><td>\n<pre>\n**Hello**,\n\n_world_.\n</pre>\n</td></tr></table>\n\nNext paragraph\n',
	'## Revenue\n\nOne **bold** paragraph [1].\n\n## Revenue\n\n[link](https://example.com) and `arr[1]`.\n',
	'Setext\n------\n\nA | B\n-- | --\n1 | 2\n3 | 4\n\nAfter the table.\n',
	'- First\n  - Nested\n\n    Still nested\n\n- Second\n\n    ```js\n    const a = [1]\n    ```\n\nOutside\n',
	'> first\ncontinued lazily\n>\n> ## Heading\n>\n> - item\n>   continued\n\nAfter\n',
	'Intro\n\n````md\n```\n# Not a heading\n\n```\n````\n\n## Heading\n',
	'[Later][ref], ![image][ref] and [ref].\n\nOther paragraph\n\n[ref]: https://example.com "title"\n\n[ref]\n',
	'[ref]: /first\n\n[ref]\n\n[ref]: /second\n\n[ref]\n',
	'A footnote[^a].\n\nOther paragraph\n\n[^a]: First line\n\n    Second line\n\nEnd[^a].\n',
	'<div>\n\n## Inside HTML\n\n</div>\n\n<table><tr><td>Revenue [1]</td></tr></table>\n\nAfter\n',
	'   ## Indented\n\n    code\n\n    more code\n\n  ## End\n',
	'## Windows\r\n\r\nOne\r\n\r\nTwo\r\n\r\n## End\r\n',
	'## Old Mac\r\rOne\r\rTwo\r\r## End\r',
	'## Start\n\n\uFEFFliteral\n\n## End\n',
	'## Unicode 🦙\n\nA\u0000B &amp; C\n\nEnd\n'
]

test.each(fixtures)('matches the complete parser at every character boundary: %s', (source) => {
	const full = processor()
	const incremental = processor().use(createRemarkIncremental())
	for (let end = 1; end <= source.length; end++) {
		const prefix = source.slice(0, end)
		expect(incremental.parse(prefix), `prefix ${JSON.stringify(prefix)}`).toEqual(full.parse(prefix))
	}
})

test('replacements, rewinds and interleaved speculative renders cannot reuse another document', () => {
	const full = processor()
	const incremental = processor().use(createRemarkIncremental())
	for (const source of [
		fixtures[0],
		fixtures[1],
		fixtures[0].slice(0, 20),
		fixtures[0],
		'',
		fixtures[5],
		fixtures[0]
	]) {
		expect(incremental.parse(source)).toEqual(full.parse(source))
	}
})

test('the document-wide HTML pipeline does not mutate cached Markdown nodes', () => {
	const pipeline = () =>
		processor()
			.use(remarkRehype, { allowDangerousHtml: true })
			.use(SANITIZE_REHYPE_PLUGINS)
			.use(rehypeCitationMarkers, { reserveInTables: true })
			.use(rehypeHeadingIds, { messageId: 'message-a' })
	const full = pipeline()
	const incremental = pipeline().use(createRemarkIncremental())
	const parts = [
		'## Revenue\n\n[Source][later]\n\n',
		'| Asset | Fees |\n| --- | --- |\n| Aave [1] | $12 |\n\n',
		'<div>\n\n## Revenue\n\n</div>\n\n',
		'```js\nconst a = [1]\n```\n\n',
		'[later]: https://example.com\n\nFinal paragraph.'
	]
	let source = ''
	for (const part of parts) {
		source += part
		const tree = incremental.parse(source)
		freezeTree(tree)
		expect(incremental.runSync(tree)).toEqual(full.runSync(full.parse(source)))
		// A citation/permission update may rerun the HTML pipeline without new Markdown.
		expect(incremental.runSync(incremental.parse(source))).toEqual(full.runSync(full.parse(source)))
	}
})

test('completed paragraphs cost a small fraction of reparsing every prefix', () => {
	let parsedChars = 0
	const incremental = processor()
		.use(function countInput() {
			const parse = this.parser!
			this.parser = (source, file) => {
				parsedChars += source.length
				return parse(source, file)
			}
		})
		.use(createRemarkIncremental())
	const source = `## Revenue\n\n${'Hypothetical fees and revenue differ. '.repeat(20)}\n\n`.repeat(30)
	let fullChars = 0
	for (let end = 100; end < source.length; end += 100) {
		fullChars += end
		incremental.parse(source.slice(0, end))
	}
	// A work budget, not a fixed count: further improvements remain valid, slow machines cannot fail.
	expect(parsedChars).toBeLessThan(fullChars / 10)
})
