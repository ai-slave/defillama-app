import { describe, expect, test, vi } from 'vitest'
import type { ArtifactRegistry } from '~/containers/LlamaAI/renderModel'
import { buildCopyHtml, buildCopyMarkdown, CSV_INLINE_ROW_LIMIT, withFetchCache } from '../copyMessage'

const chartArtifact = (id: string, title: string): ArtifactRegistry extends Map<string, infer R> ? R : never =>
	({
		type: 'chart',
		id,
		charts: [{ id, title } as never],
		chartData: {}
	}) as never

const csvArtifact = (id: string, rowCount: number) =>
	({
		type: 'csv',
		id,
		title: 'Supported chains',
		url: `https://files.llama.fi/${id}.csv`,
		rowCount,
		filename: `${id}.csv`
	}) as never

const registry = (entries: Array<[string, unknown]>): ArtifactRegistry => new Map(entries as never)

const noFetch = vi.fn(async () => {
	throw new Error('unexpected fetch')
})

describe('buildCopyMarkdown', () => {
	test('keeps prose and inline markdown tables untouched', async () => {
		const content = 'Intro\n\n| Chain | Status |\n| --- | --- |\n| Base | ✅ |\n'
		const out = await buildCopyMarkdown(content, { artifacts: registry([]), fetchText: noFetch })
		expect(out).toContain('| Chain | Status |')
		expect(out).toContain('Intro')
	})

	test('replaces chart markers with a titled line instead of deleting them', async () => {
		const content = 'Before\n\n[CHART:c1]\n\nAfter'
		const out = await buildCopyMarkdown(content, {
			artifacts: registry([['c1', chartArtifact('c1', 'TVL by chain')]]),
			fetchText: noFetch
		})
		expect(out).toContain('*📊 TVL by chain*')
		expect(out.indexOf('Before')).toBeLessThan(out.indexOf('📊'))
		expect(out.indexOf('📊')).toBeLessThan(out.indexOf('After'))
	})

	test('inlines small CSV artifacts as markdown tables', async () => {
		const fetchText = vi.fn(async () => 'chain,status\nBase,"live, verified"\nUnichain,pending\n')
		const out = await buildCopyMarkdown('[CSV:t1]', {
			artifacts: registry([['t1', csvArtifact('t1', 2)]]),
			fetchText
		})
		expect(fetchText).toHaveBeenCalledWith('https://files.llama.fi/t1.csv')
		expect(out).toContain('| chain | status |')
		expect(out).toContain('| Base | live, verified |')
	})

	test('links large CSV artifacts instead of inlining them', async () => {
		const out = await buildCopyMarkdown('[CSV:t2]', {
			artifacts: registry([['t2', csvArtifact('t2', CSV_INLINE_ROW_LIMIT + 1)]]),
			fetchText: noFetch
		})
		expect(out).toContain('[Supported chains](https://files.llama.fi/t2.csv)')
		expect(noFetch).not.toHaveBeenCalled()
	})

	test('falls back to a link when the CSV fetch fails', async () => {
		const out = await buildCopyMarkdown('[CSV:t3]', {
			artifacts: registry([['t3', csvArtifact('t3', 3)]]),
			fetchText: vi.fn(async () => {
				throw new Error('offline')
			})
		})
		expect(out).toContain('[Supported chains](https://files.llama.fi/t3.csv)')
	})

	test('drops interactive artifact markers entirely', async () => {
		const out = await buildCopyMarkdown('Hello [ACTION:Do it|message] world\n\n[ALERT:a1]\n\n[DASHBOARD:d1]', {
			artifacts: registry([]),
			fetchText: noFetch
		})
		expect(out).not.toContain('ACTION')
		expect(out).not.toContain('ALERT')
		expect(out).not.toContain('DASHBOARD')
		expect(out).toContain('Hello')
		expect(out).toContain('world')
	})
})

const citationRefs = [
	{ id: 1, sourceType: 'web' as const, label: 'defillama.com', url: 'https://defillama.com/protocol/aave' },
	{ id: 2, sourceType: 'x' as const, label: 'x.com', url: 'https://x.com/aave/status/1' },
	{ id: 3, sourceType: 'web' as const, label: 'DefiLlama data' }
]

describe('citation handling', () => {
	test('normalizes citation markers and appends a sources section in markdown', async () => {
		const out = await buildCopyMarkdown('TVL rose [1] and fees fell [2-3].', {
			artifacts: registry([]),
			fetchText: noFetch,
			citations: citationRefs
		})
		expect(out).toContain('TVL rose [1] and fees fell [2][3].')
		expect(out).toContain('Sources')
		expect(out).toContain('[1] defillama.com — https://defillama.com/protocol/aave')
		expect(out).toContain('[3] DefiLlama data')
	})

	test('drops invalid citation ids and omits sources when nothing valid was cited', async () => {
		const out = await buildCopyMarkdown('Claim [9].', {
			artifacts: registry([]),
			fetchText: noFetch,
			citations: citationRefs
		})
		expect(out).toBe('Claim.')
	})

	test('strips citation markers entirely when the message has no references', async () => {
		const out = await buildCopyMarkdown('Claim [1] here.', { artifacts: registry([]), fetchText: noFetch })
		expect(out).toBe('Claim here.')
	})

	test('renders citations as superscript links plus a sources list in HTML', async () => {
		const html = await buildCopyHtml('TVL rose [1].', {
			artifacts: registry([]),
			fetchText: noFetch,
			citations: citationRefs
		})
		expect(html).toContain('<sup>[<a href="https://defillama.com/protocol/aave">1</a>]</sup>')
		expect(html).toContain('Sources')
		expect(html).toContain('defillama.com')
	})

	test('describes data citations with metric, value, and as-of instead of the bare result name', async () => {
		const dataRef = {
			id: 1,
			sourceType: 'data' as const,
			label: 'returns',
			value: '-68.13',
			asOf: '2026-06-09',
			field: 'pct_change',
			rows: [{ token_nk: 'coingecko:edgex', pct_change: -68.13 }],
			columns: ['token_nk', 'pct_change']
		}
		const out = await buildCopyMarkdown('EDGE collapsed [1].', {
			artifacts: registry([]),
			fetchText: noFetch,
			citations: [dataRef]
		})
		expect(out).toContain('[1] DefiLlama data: Edgex · Pct Change = -68.13 (as of 2026-06-09)')
		expect(out).not.toContain('[1] returns')
	})

	test('falls back to the label for data citations without figure metadata', async () => {
		const out = await buildCopyMarkdown('Claim [1].', {
			artifacts: registry([]),
			fetchText: noFetch,
			citations: [{ id: 1, sourceType: 'data' as const, label: 'returns' }]
		})
		expect(out).toContain('[1] DefiLlama data: returns')
	})

	test('quotes a short excerpt for web citations when one is available', async () => {
		const out = await buildCopyMarkdown('Reported [1].', {
			artifacts: registry([]),
			fetchText: noFetch,
			citations: [
				{
					id: 1,
					sourceType: 'web' as const,
					label: 'coindesk.com',
					url: 'https://coindesk.com/edge-collapse',
					excerpt: 'EDGE token fell sharply after the exploit disclosure, wiping out most of its June gains.'
				}
			]
		})
		expect(out).toContain(
			'[1] coindesk.com — “EDGE token fell sharply after the exploit disclosure, wiping out most of its June gains.” — https://coindesk.com/edge-collapse'
		)
	})

	test('appends the formula for computed citations', async () => {
		const out = await buildCopyMarkdown('Derived [1].', {
			artifacts: registry([]),
			fetchText: noFetch,
			citations: [
				{
					id: 1,
					sourceType: 'computed' as const,
					label: 'net flow',
					value: '$1.2B',
					formula: 'inflow - outflow'
				}
			]
		})
		expect(out).toContain('[1] DefiLlama data: net flow = $1.2B — formula: inflow - outflow')
	})

	test('lists each cited source once even when cited repeatedly', async () => {
		const out = await buildCopyMarkdown('A [1]. B [1].', {
			artifacts: registry([]),
			fetchText: noFetch,
			citations: citationRefs
		})
		expect(out.match(/\[1\] defillama\.com/g)).toHaveLength(1)
	})
})

describe('buildCopyHtml', () => {
	test('renders markdown prose and tables as real HTML', async () => {
		const content = 'Some **bold** text\n\n| Chain | Status |\n| --- | --- |\n| Base | live |\n'
		const html = await buildCopyHtml(content, { artifacts: registry([]), fetchText: noFetch })
		expect(html).toContain('<strong>bold</strong>')
		expect(html).toContain('<table>')
		expect(html).toContain('<td>Base</td>')
	})

	test('embeds captured charts as images and falls back to a titled line', async () => {
		const artifacts = registry([
			['c1', chartArtifact('c1', 'TVL by chain')],
			['c2', chartArtifact('c2', 'Fees by chain')]
		])
		const html = await buildCopyHtml('[CHART:c1]\n\n[CHART:c2]', {
			artifacts,
			fetchText: noFetch,
			captureChart: vi.fn(async (chartId: string) => (chartId === 'c1' ? 'data:image/png;base64,abc' : null))
		})
		expect(html).toContain('<img src="data:image/png;base64,abc" alt="TVL by chain"')
		expect(html).toContain('📊 Fees by chain')
	})

	test('inlines small CSVs as escaped HTML tables', async () => {
		const html = await buildCopyHtml('[CSV:t1]', {
			artifacts: registry([['t1', csvArtifact('t1', 1)]]),
			fetchText: vi.fn(async () => 'name,note\n"<b>Base</b>","A & B"\n')
		})
		expect(html).toContain('&lt;b&gt;Base&lt;/b&gt;')
		expect(html).toContain('A &amp; B')
		expect(html).not.toContain('<b>Base</b>')
	})

	test('preserves source order across text and artifacts', async () => {
		const html = await buildCopyHtml('First\n\n[CHART:c1]\n\nLast', {
			artifacts: registry([['c1', chartArtifact('c1', 'Middle chart')]]),
			fetchText: noFetch
		})
		expect(html.indexOf('First')).toBeLessThan(html.indexOf('Middle chart'))
		expect(html.indexOf('Middle chart')).toBeLessThan(html.indexOf('Last'))
	})

	test('leaves citation-shaped text inside code blocks untouched', async () => {
		const content = 'See [1].\n\n```\nconst first = arr[1]\n```\n\nAlso inline `arr[1]` stays.'
		const html = await buildCopyHtml(content, {
			artifacts: registry([]),
			fetchText: noFetch,
			citations: citationRefs
		})
		expect(html).toContain('<sup>[<a href="https://defillama.com/protocol/aave">1</a>]</sup>')
		expect(html).toContain('const first = arr[1]')
		expect(html).toContain('<code>arr[1]</code>')
		expect(html.match(/<sup>/g)).toHaveLength(1)
	})
})

describe('URL safety', () => {
	test('drops unsafe citation URLs from sup links and sources', async () => {
		const evil = [
			{ id: 1, sourceType: 'web' as const, label: 'evil', url: 'javascript:alert(1)' },
			{ id: 2, sourceType: 'web' as const, label: 'http-only', url: 'http://insecure.example/x' }
		]
		const html = await buildCopyHtml('Claim [1] and [2].', {
			artifacts: registry([]),
			fetchText: noFetch,
			citations: evil
		})
		expect(html).not.toContain('javascript:')
		expect(html).not.toContain('http://insecure.example')
		expect(html).toContain('<sup>[1]</sup>')
		const markdown = await buildCopyMarkdown('Claim [1].', {
			artifacts: registry([]),
			fetchText: noFetch,
			citations: evil
		})
		expect(markdown).not.toContain('javascript:')
		expect(markdown).toContain('[1] evil')
	})

	test('rewrites internal preview hosts to defillama.com like the renderer', async () => {
		const out = await buildCopyMarkdown('Claim [1].', {
			artifacts: registry([]),
			fetchText: noFetch,
			citations: [
				{
					id: 1,
					sourceType: 'web' as const,
					label: 'defillama.com',
					url: 'https://preview.dl.llama.fi/protocol/aave'
				}
			]
		})
		expect(out).toContain('https://defillama.com/protocol/aave')
		expect(out).not.toContain('preview.dl.llama.fi')
	})

	test('degrades artifact links with unsafe URLs to plain titles', async () => {
		const badCsv = {
			type: 'csv',
			id: 't9',
			title: 'Bad artifact',
			url: 'javascript:alert(1)',
			rowCount: CSV_INLINE_ROW_LIMIT + 1,
			filename: 't9.csv'
		} as never
		const markdown = await buildCopyMarkdown('[CSV:t9]', { artifacts: registry([['t9', badCsv]]), fetchText: noFetch })
		expect(markdown).toContain('Bad artifact')
		expect(markdown).not.toContain('javascript:')
		const html = await buildCopyHtml('[CSV:t9]', { artifacts: registry([['t9', badCsv]]), fetchText: noFetch })
		expect(html).toContain('Bad artifact')
		expect(html).not.toContain('javascript:')
		expect(html).not.toContain('<a ')
	})
})

describe('withFetchCache', () => {
	test('fetches each URL once across both copy flavors', async () => {
		const fetchText = vi.fn(async () => 'chain,status\nBase,live\n')
		const cached = withFetchCache(fetchText)
		const source = { artifacts: registry([['t1', csvArtifact('t1', 1)]]), fetchText: cached }
		await Promise.all([buildCopyMarkdown('[CSV:t1]', source), buildCopyHtml('[CSV:t1]', source)])
		expect(fetchText).toHaveBeenCalledTimes(1)
	})
})
