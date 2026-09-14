import { describe, expect, test } from 'vitest'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import type { Chain, Protocol } from '../types'
import { buildQuickAddIndex, type QuickAddEntity } from './quickAddIndex'
import { parseQuickAddQuery } from './quickAddQuery'
import type { QuickAddRecent } from './quickAddRecents'
import {
	buildLeadingQuickAddSuggestion,
	buildQuickAddSuggestions,
	QUICK_ADD_SUGGESTION_LIMIT,
	type QuickAddAvailability,
	type QuickAddSuggestion
} from './quickAddSuggestions'

function createProtocol(protocol: Partial<Protocol> & Pick<Protocol, 'name' | 'slug'>): Protocol {
	return { id: protocol.slug, tvl: 0, chains: [], ...protocol }
}

function createChain(chain: Partial<Chain> & Pick<Chain, 'name'>): Chain {
	return { gecko_id: null, tvl: 0, tokenSymbol: null, chainId: null, cmcId: null, ...chain }
}

const protocols: Array<Protocol> = [
	createProtocol({ name: 'Uniswap', slug: 'uniswap', tvl: 5_000_000_000, symbol: 'UNI', geckoId: 'uniswap' }),
	createProtocol({ name: 'Aave', slug: 'aave', tvl: 20_000_000_000, symbol: 'AAVE', geckoId: 'aave' }),
	createProtocol({ name: 'Compound', slug: 'compound', tvl: 3_000_000_000, symbol: 'COMP' }),
	createProtocol({ name: 'Hyperliquid', slug: 'hyperliquid', tvl: 1_000_000_000 })
]

const chains: Array<Chain> = [
	createChain({ name: 'Ethereum', tvl: 60_000_000_000, gecko_id: 'ethereum', tokenSymbol: 'ETH' })
]

const entities = buildQuickAddIndex({ protocols, chains })

const AVAILABLE_PROTOCOL_TYPES: Record<string, Array<string>> = {
	uniswap: ['tvl', 'fees', 'revenue', 'volume', 'activeUsers', 'txs', 'tokenPrice', 'tokenMcap'],
	aave: ['tvl', 'fees', 'revenue', 'borrowed'],
	compound: ['tvl', 'fees', 'revenue', 'borrowed'],
	hyperliquid: ['tvl', 'perps', 'openInterest', 'volume']
}

const AVAILABLE_CHAIN_TYPES: Record<string, Array<string>> = {
	Ethereum: ['tvl', 'fees', 'revenue', 'volume', 'activeUsers', 'stablecoins', 'chainPrice']
}

function createAvailability(overrides: Partial<QuickAddAvailability> = {}): QuickAddAvailability {
	return {
		loading: false,
		error: false,
		forProtocol: (slug: string) => AVAILABLE_PROTOCOL_TYPES[slug] ?? [],
		forChain: (name: string) => AVAILABLE_CHAIN_TYPES[name] ?? [],
		...overrides
	}
}

interface SuggestionsInput {
	raw: string
	existingItems?: Array<DashboardItemConfig>
	recents?: Array<QuickAddRecent>
	availability?: QuickAddAvailability
}

function suggestFor({
	raw,
	existingItems = [],
	recents = [],
	availability
}: SuggestionsInput): Array<QuickAddSuggestion> {
	return buildQuickAddSuggestions({
		query: parseQuickAddQuery(raw),
		entities,
		availability: availability ?? createAvailability(),
		existingItems,
		recents
	})
}

function createExistingChart(slug: string, type: 'tvl' | 'fees'): DashboardItemConfig {
	return { id: `${type}-${slug}`, kind: 'chart', subjectType: 'protocol', protocol: slug, type, colSpan: 1 }
}

function createExistingMetric(slug: string, type: 'tvl' | 'fees'): DashboardItemConfig {
	return {
		id: `metric-${type}-${slug}`,
		kind: 'metric',
		subject: { itemType: 'protocol', protocol: slug },
		type,
		aggregator: 'sum',
		window: '30d',
		chartType: 'sparkline',
		colSpan: 0.5
	}
}

function entityOf(subjectType: 'protocol' | 'chain', id: string): QuickAddEntity {
	const entity = entities.find((candidate) => candidate.subjectType === subjectType && candidate.id === id)
	if (!entity) throw new Error(`missing fixture entity ${subjectType}:${id}`)
	return entity
}

describe('quick add suggestions', () => {
	test('leads with the chart for an entity and metric pair', () => {
		const suggestions = suggestFor({ raw: 'uniswap fees' })
		const [first, second] = suggestions
		expect(first).toMatchObject({ id: 'chart:protocol:uniswap:fees', kind: 'chart', title: 'Uniswap · Fees' })
		expect(first?.detail).toBe('Bar chart · daily')
		expect(second).toMatchObject({ id: 'metric:protocol:uniswap:fees', kind: 'metric' })
		expect(second?.detail).toBe('Metric card · 30d sum')
		const items = first?.build([]) ?? []
		expect(items).toHaveLength(1)
		expect(items[0]).toMatchObject({
			kind: 'chart',
			type: 'fees',
			subjectType: 'protocol',
			protocol: 'uniswap',
			grouping: 'day',
			colSpan: 1
		})
		expect(items[0]?.id).toContain('fees-uniswap-')
	})

	test('leads with the metric card when the query asks for one', () => {
		const [first, second] = suggestFor({ raw: 'uniswap fees metric' })
		expect(first).toMatchObject({ kind: 'metric', id: 'metric:protocol:uniswap:fees' })
		expect(second?.kind).toBe('chart')
		const items = first?.build([]) ?? []
		expect(items[0]).toMatchObject({
			kind: 'metric',
			type: 'fees',
			aggregator: 'sum',
			window: '30d',
			chartType: 'sparkline',
			colSpan: 0.5,
			subject: { itemType: 'protocol', protocol: 'uniswap' }
		})
	})

	test('carries weekly grouping and cumulative into the built chart', () => {
		const [first] = suggestFor({ raw: 'uniswap weekly cumulative fees' })
		expect(first?.detail).toBe('Bar chart · weekly · cumulative')
		expect(first?.build([])[0]).toMatchObject({ grouping: 'week', showCumulative: true })
	})

	test('drops a metric the entity has no data for and offers its available ones', () => {
		const suggestions = suggestFor({ raw: 'uniswap treasury' })
		expect(suggestions.some((suggestion) => suggestion.metric === 'treasury')).toBe(false)
		expect(suggestions[0]).toMatchObject({ id: 'chart:protocol:uniswap:tvl' })
		expect(suggestions.map((suggestion) => suggestion.metric).slice(0, 5)).toEqual([
			'tvl',
			'fees',
			'revenue',
			'volume',
			'activeUsers'
		])
	})

	test('keeps every metric while availability is still loading', () => {
		const suggestions = suggestFor({ raw: 'uniswap treasury', availability: createAvailability({ loading: true }) })
		expect(suggestions[0]).toMatchObject({ id: 'chart:protocol:uniswap:treasury' })
		expect(suggestions[0]?.detail).toBe('Area chart · checking data…')
	})

	test('demotes metrics already on the dashboard', () => {
		const suggestions = suggestFor({ raw: 'uniswap', existingItems: [createExistingChart('uniswap', 'tvl')] })
		expect(suggestions[0]).toMatchObject({ id: 'chart:protocol:uniswap:fees', alreadyOnDashboard: false })
		const demoted = suggestions[suggestions.length - 2]
		expect(demoted).toMatchObject({ id: 'chart:protocol:uniswap:tvl', alreadyOnDashboard: true })
	})

	test('builds one comparison card for two entity groups', () => {
		const suggestions = suggestFor({ raw: 'aave vs compound revenue' })
		const [first] = suggestions
		expect(first).toMatchObject({ kind: 'multi', title: 'Aave vs Compound · Revenue', detail: '2 series' })
		const items = first?.build([]) ?? []
		expect(items).toHaveLength(1)
		const [multi] = items
		expect(multi).toMatchObject({ kind: 'multi', name: 'Aave vs Compound · Revenue', grouping: 'day', colSpan: 1 })
		expect(multi?.kind === 'multi' ? multi.items : []).toMatchObject([
			{ kind: 'chart', type: 'revenue', protocol: 'aave' },
			{ kind: 'chart', type: 'revenue', protocol: 'compound' }
		])
		expect(suggestions[1]).toMatchObject({ id: 'chart:protocol:aave:revenue' })
		expect(suggestions[2]).toMatchObject({ id: 'chart:protocol:compound:revenue' })
	})

	test('remaps a token metric onto the chain twin', () => {
		const [first] = suggestFor({ raw: 'ethereum price' })
		expect(first).toMatchObject({ id: 'chart:chain:Ethereum:chainPrice', kind: 'chart' })
		expect(first?.build([])[0]).toMatchObject({
			kind: 'chart',
			subjectType: 'chain',
			chain: 'Ethereum',
			type: 'chainPrice',
			geckoId: 'ethereum'
		})
	})

	test('offers a lone metric for dashboard entities, then recents, then the top of the index', () => {
		const suggestions = suggestFor({
			raw: 'revenue',
			existingItems: [createExistingChart('compound', 'tvl')],
			recents: [{ subjectType: 'protocol', id: 'aave', name: 'Aave', kind: 'chart', metric: 'fees' }]
		})
		expect(suggestions.map((suggestion) => suggestion.id).slice(0, 3)).toEqual([
			'chart:protocol:compound:revenue',
			'chart:protocol:aave:revenue',
			'chart:chain:Ethereum:revenue'
		])
	})

	test('answers an entity free command with a single row', () => {
		const textSuggestions = suggestFor({ raw: 'text' })
		expect(textSuggestions).toHaveLength(2)
		expect(textSuggestions[0]).toMatchObject({ kind: 'text', id: 'text:block' })
		expect(textSuggestions[0]?.build([])[0]).toMatchObject({ kind: 'text', content: '', colSpan: 1 })
		const sectionSuggestions = suggestFor({ raw: 'section' })
		expect(sectionSuggestions[0]?.build([])[0]).toMatchObject({
			kind: 'section',
			title: 'New section',
			displayAs: 'heading'
		})
		const tableSuggestions = suggestFor({ raw: 'top protocols' })
		expect(tableSuggestions[0]).toMatchObject({ kind: 'table' })
		expect(tableSuggestions[0]?.action).toBeUndefined()
		expect(tableSuggestions[0]?.build([])).toMatchObject([
			{ kind: 'unified-table', strategy: 'protocols', params: { chains: ['All'] }, colSpan: 2 }
		])
	})

	test('the text row hands a text draft to the full editor instead of appending a blank card', () => {
		const [text] = suggestFor({ raw: 'text' })
		expect(text).toMatchObject({ kind: 'text', action: 'open-editor-draft' })
		expect(text?.build([])[0]).toMatchObject({ kind: 'text', content: '', colSpan: 1 })
	})

	test('the section row asks to close the palette and focus the new title', () => {
		const [section] = suggestFor({ raw: 'section' })
		expect(section).toMatchObject({ kind: 'section', afterAdd: 'close-and-focus-title' })
		expect(section?.action).toBeUndefined()
	})

	test('keeps every metric when the app metadata fetch failed, with no pending label', () => {
		const suggestions = suggestFor({ raw: 'uniswap treasury', availability: createAvailability({ error: true }) })
		expect(suggestions[0]).toMatchObject({ id: 'chart:protocol:uniswap:treasury' })
		expect(suggestions[0]?.detail).toBe('Area chart')
	})

	test('keeps the entity rows when the app metadata fetch failed for an empty query', () => {
		const suggestions = suggestFor({
			raw: '',
			existingItems: [createExistingChart('uniswap', 'tvl')],
			availability: createAvailability({ error: true })
		})
		expect(suggestions[0]).toMatchObject({ id: 'chart:protocol:uniswap:fees', group: 'suggested' })
		expect(suggestions[0]?.detail).toBe('Bar chart · daily')
	})

	test('keeps a metric card fresh when only the matching daily chart is on the dashboard', () => {
		const [first, second] = suggestFor({
			raw: 'uniswap fees metric',
			existingItems: [createExistingChart('uniswap', 'fees')]
		})
		expect(first).toMatchObject({ id: 'metric:protocol:uniswap:fees', kind: 'metric', alreadyOnDashboard: false })
		expect(second).toMatchObject({ id: 'chart:protocol:uniswap:fees', kind: 'chart', alreadyOnDashboard: true })
	})

	test('keeps the explicit chart hit ahead of the metric card it shares the pair with', () => {
		const [first, second] = suggestFor({
			raw: 'uniswap weekly fees',
			existingItems: [createExistingChart('uniswap', 'fees'), createExistingMetric('uniswap', 'fees')]
		})
		expect(first).toMatchObject({ id: 'chart:protocol:uniswap:fees', kind: 'chart', alreadyOnDashboard: true })
		expect(first?.build([])[0]).toMatchObject({ grouping: 'week' })
		expect(second).toMatchObject({ id: 'metric:protocol:uniswap:fees', kind: 'metric', alreadyOnDashboard: true })
	})

	test('reserves the start rows for a busy dashboard with recents', () => {
		const suggestions = suggestFor({
			raw: '',
			existingItems: [
				createExistingChart('uniswap', 'tvl'),
				createExistingChart('aave', 'tvl'),
				createExistingChart('compound', 'tvl')
			],
			recents: [
				{ subjectType: 'protocol', id: 'hyperliquid', name: 'Hyperliquid', kind: 'chart', metric: 'volume' },
				{ subjectType: 'chain', id: 'Ethereum', name: 'Ethereum', kind: 'chart', metric: 'tvl' }
			]
		})
		expect(suggestions).toHaveLength(QUICK_ADD_SUGGESTION_LIMIT)
		expect(suggestions.filter((suggestion) => suggestion.group === 'suggested')).toHaveLength(3)
		expect(suggestions.filter((suggestion) => suggestion.group === 'recent')).toHaveLength(1)
		expect(suggestions.filter((suggestion) => suggestion.group === 'start').map((row) => row.kind)).toEqual([
			'table',
			'text',
			'section'
		])
		expect(suggestions[suggestions.length - 1]).toMatchObject({ kind: 'open-editor' })
	})

	test('the leading suggestion helper answers from a raw query string', () => {
		const leading = buildLeadingQuickAddSuggestion('aave revenue', {
			entities,
			availability: createAvailability(),
			existingItems: [],
			recents: []
		})
		expect(leading).toMatchObject({ id: 'chart:protocol:aave:revenue' })
		expect(
			buildLeadingQuickAddSuggestion('', {
				entities,
				availability: createAvailability(),
				existingItems: [],
				recents: []
			})
		).toMatchObject({ kind: 'table', group: 'start' })
	})

	test('groups an empty query into suggested, recent and start rows', () => {
		const suggestions = suggestFor({
			raw: '',
			existingItems: [createExistingChart('uniswap', 'tvl')],
			recents: [{ subjectType: 'chain', id: 'Ethereum', name: 'Ethereum', kind: 'metric', metric: 'tvl' }]
		})
		expect(suggestions[0]).toMatchObject({
			id: 'chart:protocol:uniswap:fees',
			title: 'Uniswap · Fees',
			group: 'suggested'
		})
		expect(suggestions[1]).toMatchObject({ id: 'metric:chain:Ethereum:tvl', group: 'recent' })
		expect(suggestions[2]).toMatchObject({ kind: 'table', group: 'start' })
		expect(suggestions[3]).toMatchObject({ kind: 'text', group: 'start' })
		expect(suggestions[4]).toMatchObject({ kind: 'section', group: 'start' })
	})

	test('starts an untouched dashboard with the start rows only', () => {
		const suggestions = suggestFor({ raw: '' })
		expect(suggestions.map((suggestion) => suggestion.kind)).toEqual(['table', 'text', 'section', 'open-editor'])
	})

	test('always ends with the full editor row and never exceeds the cap', () => {
		const queries = ['', 'uniswap', 'uniswap fees', 'aave vs compound revenue', 'revenue', 'text', 'nonexistent-thing']
		for (const raw of queries) {
			const suggestions = suggestFor({ raw, existingItems: [createExistingChart('uniswap', 'tvl')] })
			expect(suggestions.length).toBeLessThanOrEqual(QUICK_ADD_SUGGESTION_LIMIT)
			expect(suggestions[suggestions.length - 1]).toMatchObject({
				kind: 'open-editor',
				id: 'open-editor',
				action: 'open-editor'
			})
			const ids = suggestions.map((suggestion) => suggestion.id)
			expect(new Set(ids).size).toBe(ids.length)
		}
	})

	test('attaches the matched entity to entity rows for the icon', () => {
		const [first] = suggestFor({ raw: 'uniswap fees' })
		expect(first?.entity).toEqual(entityOf('protocol', 'uniswap'))
	})
})
