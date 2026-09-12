import type { Root as HastRoot, Element as HastElement } from 'hast'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { urlAttributes } from 'html-url-attributes'
import type { Root as MdastRoot, RootContent, Table } from 'mdast'
import { cloneElement, createElement, Fragment, type ReactElement, type ReactNode } from 'react'
import type { Components } from 'react-markdown'
import { defaultUrlTransform } from 'react-markdown'
import { jsx, jsxs } from 'react/jsx-runtime'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified, type PluggableList, type Processor } from 'unified'
import { visit } from 'unist-util-visit'
import { VFile } from 'vfile'
import { mendStreamingMarkdown } from './mendStreamingMarkdown'
import type { HeadingCounts } from './rehypeHeadingIds'
import { createRemarkIncremental } from './remarkIncremental'
import { detachOrderedLists, nestIndentedLists } from './repairLists'

export type SegmentProcessors = {
	/** Row-local plugins must preserve standard table structure and render tables identically in body and tail. */
	cacheTableRows?: true
	/** Runs on every segment but the last. */
	body: Processor<undefined, MdastRoot, HastRoot>
	/** Runs on the last segment; the only place a streaming caret can land. */
	tail: Processor<undefined, MdastRoot, HastRoot>
}

type TableRows = {
	markdown: Table
	prefix: string
	hast: HastRoot
	table: HastElement
	head: HastElement
	body: HastElement
	heading: ReactNode
	rows: Array<ReactNode>
}

type Entry = {
	tableRows?: TableRows
	source: string
	start: number
	end: number
	/** Rendered through the caret-placing processor. */
	tail: boolean
	/** Renders to nothing visible (a comment, a stripped tag), so the caret belongs to an earlier segment. */
	empty: boolean
	counts: HeadingCounts
	node: ReactNode
}

const buildProcessor = (plugins: PluggableList) =>
	unified().use(remarkRehype, { allowDangerousHtml: true }).use(plugins).freeze() as unknown as Processor<
		undefined,
		MdastRoot,
		HastRoot
	>

export function createSegmentProcessors(bodyPlugins: PluggableList, tailPlugins: PluggableList): SegmentProcessors {
	return { body: buildProcessor(bodyPlugins), tail: buildProcessor(tailPlugins) }
}

// Mirrors react-markdown's own post-processing: leftover raw nodes become text, and URL attributes
// pass through the same protocol allowlist, so a segment renders exactly as the whole document did.
function toReact(tree: HastRoot, components: Components): ReactNode {
	visit(tree, (node, index, parent) => {
		if (node.type === 'raw' && parent && typeof index === 'number') {
			parent.children[index] = { type: 'text', value: node.value }
			return index
		}
		if (node.type !== 'element') return
		for (const key in urlAttributes) {
			if (!Object.hasOwn(node.properties, key)) continue
			const tags = urlAttributes[key]
			if (tags === null || tags.includes(node.tagName)) {
				node.properties[key] = defaultUrlTransform(String(node.properties[key] || ''))
			}
		}
	})
	return toJsxRuntime(tree, {
		Fragment,
		components: components as Parameters<typeof toJsxRuntime>[1]['components'],
		ignoreInvalidStyle: true,
		jsx,
		jsxs,
		passKeys: true,
		passNode: true
	})
}

// HTML can change neighboring rows during raw-HTML parsing. Such tables stay whole.
function rowLocalTable(table: Table): boolean {
	let local = true
	visit(table, 'html', () => {
		local = false
	})
	return local
}

function tableParts(hast: HastRoot) {
	const [space, table] = hast.children
	if (
		hast.children.length !== 2 ||
		space.type !== 'text' ||
		!/^\n*$/.test(space.value) ||
		table.type !== 'element' ||
		table.tagName !== 'table'
	)
		return null
	const [head, body] = table.children
	if (
		table.children.length !== 2 ||
		head.type !== 'element' ||
		head.tagName !== 'thead' ||
		body.type !== 'element' ||
		body.tagName !== 'tbody' ||
		head.children.some((node) => node.type !== 'element' || node.tagName !== 'tr') ||
		body.children.some((node) => node.type !== 'element' || node.tagName !== 'tr')
	)
		return null
	return { table, head, body }
}

function rowElement(row: HastElement, components: Components, index: number): ReactNode {
	return cloneElement(toReact({ type: 'root', children: [row] }, components) as ReactElement, {
		key: `row-${index}`
	})
}

type TableWrapper = ReactElement<{ children: ReactNode; node?: HastElement }>

function fillTableWrapper(element: TableWrapper, node: HastElement, children: ReactNode) {
	return cloneElement(element, { ...('node' in element.props ? { node } : {}), children })
}

// Convert only empty wrappers, then supply cached rows and complete node props. The cached
// HAST stays immutable so previously returned elements remain safe during concurrent renders.
// The table component reads the complete node, including cached rows, for CSV export.
function tableElement(cache: TableRows, components: Components): ReactNode {
	const shell: HastRoot = {
		...cache.hast,
		children: [
			cache.hast.children[0],
			{
				...cache.table,
				children: [
					{ ...cache.head, children: [] },
					{ ...cache.body, children: [] }
				]
			}
		]
	}
	const root = toReact(shell, components) as ReactElement<{ children: Array<ReactNode> }>
	const table = root.props.children[1] as TableWrapper
	const [head, body] = table.props.children as Array<TableWrapper>
	return cloneElement(
		root,
		{},
		root.props.children[0],
		fillTableWrapper(table, cache.table, [
			fillTableWrapper(head, cache.head, cache.heading),
			fillTableWrapper(body, cache.body, cache.rows)
		])
	)
}

// Elements whose tags never open anything, so they cannot leave HTML unclosed.
const VOID_TAGS = new Set([
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'source',
	'track',
	'wbr'
])
const TAG = /<\/?([a-zA-Z][\w-]*)[^>]*>/g

// Whether every tag opened in this HTML is closed in it. The raw-HTML pass parses the whole document
// as one stream, so an element left open here swallows the blocks after it; only balanced HTML can
// end a segment. Counting tags is a conservative stand-in for the HTML parser: an unbalanced verdict
// only costs caching, and a balanced verdict means the parser's stack is back where it started.
function htmlBalanced(value: string): boolean {
	let depth = 0
	for (const match of value.replace(/<!--[\s\S]*?-->/g, '').matchAll(TAG)) {
		const name = match[1].toLowerCase()
		if (VOID_TAGS.has(name) || match[0].endsWith('/>')) continue
		depth += match[0].startsWith('</') ? -1 : 1
		if (depth < 0) return false
	}
	return depth === 0
}

function blockHtmlBalanced(block: RootContent): boolean {
	let balanced = true
	visit(block, 'html', (node: { value: string }) => {
		if (!htmlBalanced(node.value)) balanced = false
	})
	return balanced
}

// Definitions and footnotes resolve references anywhere in the document, so such a document renders as
// one segment. A block with unclosed HTML renders together with every block after it, so the fragments
// meet the same way they do in a whole document.
function segmentRanges(tree: MdastRoot): Array<[number, number]> {
	const blocks = tree.children
	let wholeDocument = false
	visit(tree, (node) => {
		if (node.type === 'definition' || node.type === 'footnoteDefinition') wholeDocument = true
	})
	if (wholeDocument) return [[0, blocks.length - 1]]
	const ranges: Array<[number, number]> = []
	for (let i = 0; i < blocks.length; i++) {
		if (!blockHtmlBalanced(blocks[i])) {
			ranges.push([i, blocks.length - 1])
			break
		}
		ranges.push([i, i])
	}
	return ranges
}

const createParser = () =>
	unified().use(remarkParse).use(remarkGfm, { singleTilde: false }).use(createRemarkIncremental())

/**
 * Render markdown as independently cached top-level segments.
 *
 * A streaming answer changes only at its end, yet the HTML pipeline (raw HTML, sanitizing, citation
 * pills, heading ids) and React element creation ran over the whole document on every chunk, so the
 * cost of each frame grew with the length of the answer. Here each top-level block goes through the
 * pipeline on its own and is kept as finished React elements. On the next render a block whose
 * source, and every block before it, is unchanged returns the same elements, so React skips it too.
 *
 * Heading numbering runs left to right across segments through the counts a segment leaves behind,
 * which is why reuse stops at the first changed block. The last segment renders through `tail`, the
 * processor that may place the caret; when it stops being last it renders again through `body`. A
 * trailing segment with nothing visible passes the caret back to the last one that has content, as
 * the caret pass would do walking a whole document.
 *
 * Each list-repair stage has its own parser cache so raw and repaired prefixes never compete.
 * With `mend`, only the unfinished tail changes (see `mendStreamingMarkdown`); reparsing through
 * the final active stage keeps that change inside its open suffix.
 *
 * `lastCostMs` is how long the previous `render` took. The reveal loop paces commits from it: the
 * active suffix still needs processing, even when completed table rows are cached.
 */
export function createSegmentRenderer(components: Components) {
	const rawParser = createParser()
	const repairs = [
		{ repair: detachOrderedLists, parser: createParser() },
		{ repair: nestIndentedLists, parser: createParser() }
	]
	let entries: Array<Entry> = []
	let processors: SegmentProcessors | undefined
	let lastCostMs = 0

	function render(input: string, next: SegmentProcessors, mend = false): Array<ReactNode> {
		const startedAt = performance.now()
		try {
			return renderSegments(input, next, mend)
		} finally {
			lastCostMs = performance.now() - startedAt
		}
	}

	function renderSegments(input: string, next: SegmentProcessors, mend: boolean): Array<ReactNode> {
		if (next !== processors) {
			entries = []
			processors = next
		}
		let source = input
		let parser = rawParser
		let tree = parser.parse(new VFile(source)) as MdastRoot
		for (const stage of repairs) {
			const repaired = stage.repair(source, tree)
			if (repaired !== null) {
				source = repaired
				parser = stage.parser
				tree = parser.parse(new VFile(source)) as MdastRoot
			}
		}
		if (mend) {
			const mended = mendStreamingMarkdown(source, tree)
			if (mended !== null) {
				source = mended
				tree = parser.parse(new VFile(source)) as MdastRoot
			}
		}
		const blocks: Array<RootContent> = tree.children
		if (blocks.length === 0) {
			entries = []
			return []
		}
		const ranges = segmentRanges(tree)
		const result: Array<Entry> = []
		const build = (i: number, tail: boolean, previousRows?: TableRows): Entry => {
			const [start, end] = ranges[i]
			const counts: HeadingCounts = new Map(i ? result[i - 1].counts : undefined)
			const segmentFile = new VFile(source)
			segmentFile.data.headingCounts = counts
			const root: MdastRoot = {
				type: 'root',
				children: blocks.slice(start, end + 1),
				position: { start: blocks[start].position!.start, end: blocks[end].position!.end }
			}
			const markdown = blocks[start]
			const canCacheRows =
				next.cacheTableRows &&
				start === end &&
				markdown.type === 'table' &&
				markdown.children.length > 2 &&
				rowLocalTable(markdown)
			const keep = previousRows ? previousRows.markdown.children.length - 2 : 0
			const reuseRows =
				canCacheRows &&
				previousRows &&
				keep > 0 &&
				markdown.children.length > keep + 1 &&
				source.startsWith(previousRows.prefix)
			if (reuseRows)
				root.children = [{ ...markdown, children: [markdown.children[0], ...markdown.children.slice(keep + 1)] }]
			let hast = (tail ? next.tail : next.body).runSync(root, segmentFile)
			const parts = canCacheRows ? tableParts(hast) : null
			// An opted-in plugin changed the table structure: use its whole-table output.
			if (reuseRows && !parts) {
				root.children = [markdown]
				hast = (tail ? next.tail : next.body).runSync(root, segmentFile)
			}
			let tableRows: TableRows | undefined
			if (parts && canCacheRows) {
				let rows: Array<ReactNode>
				let heading: ReactNode
				if (reuseRows) {
					rows = previousRows.rows.slice(0, keep)
					for (const row of parts.body.children) rows.push(rowElement(row as HastElement, components, rows.length))
					heading = previousRows.heading
					parts.head = previousRows.head
					parts.body.children = [...previousRows.body.children.slice(0, keep), ...parts.body.children]
					parts.body.position = { start: markdown.children[1].position!.start, end: markdown.position!.end }
					parts.table.children = [parts.head, parts.body]
					// remark-rehype contributes a newline around each cell and row; rehypeRaw
					// moves this whitespace before the table. The omitted rows contribute it too.
					const space = hast.children[0] as { type: 'text'; value: string }
					space.value += '\n'.repeat(keep * (markdown.align!.length + 2))
				} else {
					heading = rowElement(parts.head.children[0] as HastElement, components, 0)
					rows = parts.body.children.map((row, index) => rowElement(row as HastElement, components, index))
				}
				tableRows = {
					markdown,
					prefix: source.slice(0, markdown.children.at(-1)!.position!.start.offset),
					hast,
					...parts,
					heading,
					rows
				}
			}
			let empty = true
			for (const child of hast.children) {
				if (child.type === 'element' || (child.type === 'text' && child.value.trim())) empty = false
			}
			return {
				tableRows,
				source: source.slice(blocks[start].position!.start.offset, blocks[end].position!.end.offset),
				start,
				end,
				tail,
				empty,
				counts,
				node: createElement(
					Fragment,
					{ key: `segment-${i}` },
					tableRows ? tableElement(tableRows, components) : toReact(hast, components)
				)
			}
		}
		let reusable = true
		for (let i = 0; i < ranges.length; i++) {
			const [start, end] = ranges[i]
			const tail = i === ranges.length - 1
			const previous = entries[i]
			if (
				reusable &&
				previous &&
				previous.start === start &&
				previous.end === end &&
				previous.tail === tail &&
				previous.source === source.slice(blocks[start].position!.start.offset, blocks[end].position!.end.offset)
			) {
				result.push(previous)
				continue
			}
			const previousRows = reusable ? previous?.tableRows : undefined
			reusable = false
			result.push(build(i, tail, previousRows))
		}
		let last = result.length - 1
		while (last > 0 && result[last].empty) last--
		if (last < result.length - 1 && !result[last].tail) result[last] = build(last, true)
		entries = result
		const nodes: Array<ReactNode> = []
		for (const entry of result) {
			// remark-rehype separates top-level blocks with a newline text node; keep the DOM identical.
			if (nodes.length > 0) nodes.push('\n')
			nodes.push(entry.node)
		}
		return nodes
	}

	return { render, lastCostMs: () => lastCostMs }
}
