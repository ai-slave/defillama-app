import { describe, expect, test } from 'vitest'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import type { DashboardVariable } from '../../dashboardTypes'
import type {
	AdvancedTvlChartConfig,
	BorrowedChartConfig,
	ChartBuilderConfig,
	ChartConfig,
	CustomDataConfig,
	DashboardItemBindings,
	IncomeStatementConfig,
	MetricConfig,
	MultiChartConfig,
	SectionConfig,
	StablecoinsChartConfig,
	TextConfig,
	UnlocksPieConfig,
	UnlocksScheduleConfig
} from '../../types'
import type { UnifiedTableConfig } from '../../unifiedTable/config/current'
import {
	ALL_CHAINS_VARIABLE_VALUE,
	applyVariableValuesToItems,
	bindDashboardItems,
	createVariableCatalog,
	dashboardHasBindings,
	detectParameterCandidates,
	getBindableFieldsForKind,
	getEffectiveVariableValues,
	getItemFieldLiteral,
	isValidVariableValue,
	listCompatibleBindings,
	readVariableOverridesFromQuery,
	replaceVariableOverridesInQuery,
	resolveDashboardItem,
	resolveDashboardItems,
	restoreItemsAfterIterate,
	setDashboardItemBinding,
	slugifyVariableId,
	stripCustomDataRows,
	suggestVariableBindings,
	unbindDashboardVariable,
	type DashboardVariableCatalog
} from '../resolve'

const chainVariable: DashboardVariable = { id: 'chain', kind: 'chain', label: 'Chain', value: 'Ethereum' }
const protocolVariable: DashboardVariable = { id: 'protocol', kind: 'protocol', label: 'Protocol', value: 'aave' }

const catalog: DashboardVariableCatalog = {
	hasChain: (name) => ['Ethereum', 'Solana', 'Base'].includes(name),
	getProtocol: (slug) =>
		({ aave: { name: 'Aave', slug: 'aave' }, lido: { name: 'Lido', slug: 'lido' } })[slug] ?? undefined
}

function chainChart(overrides: Partial<Extract<ChartConfig, { subjectType: 'chain' }>> = {}): ChartConfig {
	return {
		id: 'chart-chain',
		kind: 'chart',
		subjectType: 'chain',
		chain: 'Ethereum',
		type: 'tvl',
		geckoId: 'ethereum',
		bindings: { subject: 'chain' },
		...overrides
	}
}

function protocolChart(overrides: Partial<Extract<ChartConfig, { subjectType: 'protocol' }>> = {}): ChartConfig {
	return {
		id: 'chart-protocol',
		kind: 'chart',
		subjectType: 'protocol',
		protocol: 'aave',
		type: 'fees',
		geckoId: 'aave',
		bindings: { subject: 'protocol' },
		...overrides
	}
}

function chainMetric(): MetricConfig {
	return {
		id: 'metric-chain',
		kind: 'metric',
		subject: { itemType: 'chain', chain: 'Ethereum', geckoId: 'ethereum' },
		type: 'fees',
		aggregator: 'latest',
		window: '30d',
		chartType: 'sparkline',
		bindings: { subject: 'chain' }
	}
}

function unifiedTable(params: UnifiedTableConfig['params'] = { chains: ['Ethereum'] }): UnifiedTableConfig {
	return {
		id: 'table',
		kind: 'unified-table',
		configVersion: 3,
		strategy: 'protocols',
		rowHeaders: ['protocol'],
		params,
		bindings: { chains: 'chain' }
	}
}

function withoutBindings<Item extends DashboardItemConfig>(item: Item): Item {
	const { bindings: _bindings, ...rest } = item as Item & { bindings?: DashboardItemBindings }
	return rest as Item
}

function builder(
	config: Partial<ChartBuilderConfig['config']> = {},
	bindings: DashboardItemBindings = { chains: 'chain' }
): ChartBuilderConfig {
	return {
		id: 'builder',
		kind: 'builder',
		config: {
			metric: 'fees',
			mode: 'chains',
			chainFilterMode: 'include',
			categoryFilterMode: 'include',
			chainCategoryFilterMode: 'include',
			protocolCategoryFilterMode: 'include',
			chains: ['Ethereum'],
			categories: [],
			groupBy: 'protocol',
			limit: 10,
			chartType: 'stackedBar',
			displayAs: 'timeSeries',
			...config
		},
		bindings
	}
}

function stablecoins(chain = 'Ethereum'): StablecoinsChartConfig {
	return { id: 'stablecoins', kind: 'stablecoins', chain, chartType: 'totalMcap', bindings: { chain: 'chain' } }
}

const protocolCards: Array<DashboardItemConfig> = [
	{
		id: 'advanced-tvl',
		kind: 'advanced-tvl',
		protocol: 'aave',
		protocolName: 'Aave',
		chartType: 'tvl',
		bindings: { protocol: 'protocol' }
	} satisfies AdvancedTvlChartConfig,
	{
		id: 'advanced-borrowed',
		kind: 'advanced-borrowed',
		protocol: 'aave',
		protocolName: 'Aave',
		chartType: 'chainsBorrowed',
		bindings: { protocol: 'protocol' }
	} satisfies BorrowedChartConfig,
	{
		id: 'income-statement',
		kind: 'income-statement',
		protocol: 'aave',
		protocolName: 'Aave',
		bindings: { protocol: 'protocol' }
	} satisfies IncomeStatementConfig,
	{
		id: 'unlocks-schedule',
		kind: 'unlocks-schedule',
		protocol: 'aave',
		protocolName: 'Aave',
		dataType: 'documented',
		bindings: { protocol: 'protocol' }
	} satisfies UnlocksScheduleConfig,
	{
		id: 'unlocks-pie',
		kind: 'unlocks-pie',
		protocol: 'aave',
		protocolName: 'Aave',
		chartType: 'allocation',
		bindings: { protocol: 'protocol' }
	} satisfies UnlocksPieConfig
]

const section: SectionConfig = { id: 'section', kind: 'section', title: 'Overview', displayAs: 'heading' }
const customData: CustomDataConfig = {
	id: 'custom',
	kind: 'custom-data',
	name: 'Uploaded',
	columns: [{ name: 'value', type: 'number' }],
	rows: [[1], [2]],
	chart: {
		chartType: 'bar',
		xCol: 'value',
		yCols: ['value'],
		splitByCol: null,
		stackMode: 'off',
		rightAxisCols: [],
		seriesKinds: {},
		seriesColors: {},
		numberFormat: 'auto'
	},
	displayMode: 'table'
}
const text: TextConfig = { id: 'text', kind: 'text', content: 'hello' }

describe('value validation', () => {
	test('mask rejects unsafe values before the catalog is known', () => {
		expect(isValidVariableValue('chain', 'OP Mainnet', null)).toBe(true)
		expect(isValidVariableValue('chain', '<script>', null)).toBe(false)
		expect(isValidVariableValue('chain', '', null)).toBe(false)
		expect(isValidVariableValue('chain', 'x'.repeat(65), null)).toBe(false)
	})

	test('catalog decides chain and protocol membership, All is always a valid chain', () => {
		expect(isValidVariableValue('chain', 'Solana', catalog)).toBe(true)
		expect(isValidVariableValue('chain', 'Nowhere', catalog)).toBe(false)
		expect(isValidVariableValue('chain', ALL_CHAINS_VARIABLE_VALUE, catalog)).toBe(true)
		expect(isValidVariableValue('protocol', 'lido', catalog)).toBe(true)
		expect(isValidVariableValue('protocol', 'All', catalog)).toBe(false)
	})

	test('createVariableCatalog wraps the protocol catalog and is null without one', () => {
		expect(createVariableCatalog(null)).toBeNull()
		const wrapped = createVariableCatalog({
			chains: [{ name: 'Ethereum', tvl: 1, gecko_id: null, tokenSymbol: null, chainId: null, cmcId: null }],
			protocols: [{ id: 'aave', name: 'Aave', slug: 'aave', tvl: 1, chains: [] }]
		})!
		expect(wrapped.hasChain('Ethereum')).toBe(true)
		expect(wrapped.hasChain('Solana')).toBe(false)
		expect(wrapped.getProtocol('aave')?.name).toBe('Aave')
		expect(wrapped.getProtocol('lido')).toBeUndefined()
	})

	test('invalid override falls back to the default value', () => {
		expect(getEffectiveVariableValues([chainVariable], { chain: 'Nowhere' }, catalog)).toEqual({ chain: 'Ethereum' })
		expect(getEffectiveVariableValues([chainVariable], { chain: 'Solana' }, catalog)).toEqual({ chain: 'Solana' })
		expect(getEffectiveVariableValues([chainVariable], { other: 'Solana' }, catalog)).toEqual({ chain: 'Ethereum' })
		expect(getEffectiveVariableValues([protocolVariable], { protocol: '<bad>' }, null)).toEqual({ protocol: 'aave' })
	})
})

describe('query overrides', () => {
	test('reads only var- keys that pass the mask, taking the first array value', () => {
		expect(
			readVariableOverridesFromQuery({
				'var-chain': 'Solana',
				'var-protocol': ['lido', 'aave'],
				'var-bad': '<script>',
				'var-empty': '',
				'var-missing': undefined,
				chain: 'Ethereum',
				tab: 'overview'
			})
		).toEqual({ chain: 'Solana', protocol: 'lido' })
	})

	test('replaces the variable overrides in the page URL and keeps every other query key', () => {
		const query = { dashboardId: 'abc', tab: 'overview', 'var-chain': 'Solana', 'var-protocol': 'lido' }

		expect(replaceVariableOverridesInQuery(query, { chain: 'Base' })).toEqual({
			dashboardId: 'abc',
			tab: 'overview',
			'var-chain': 'Base'
		})
		expect(replaceVariableOverridesInQuery(query, {})).toEqual({ dashboardId: 'abc', tab: 'overview' })
	})
})

describe('resolveDashboardItem', () => {
	test('chart bound to a chain variable switches chain and drops geckoId', () => {
		const { item, unavailable } = resolveDashboardItem(chainChart(), [chainVariable], { chain: 'Solana' }, catalog)
		expect(unavailable).toBeUndefined()
		expect(item).toEqual({
			id: 'chart-chain',
			kind: 'chart',
			subjectType: 'chain',
			chain: 'Solana',
			type: 'tvl',
			bindings: { subject: 'chain' }
		})
		expect('geckoId' in item).toBe(false)
	})

	test('chart bound to a protocol variable switches protocol and drops geckoId', () => {
		const { item, unavailable } = resolveDashboardItem(
			protocolChart(),
			[protocolVariable],
			{ protocol: 'lido' },
			catalog
		)
		expect(unavailable).toBeUndefined()
		expect(item).toEqual({
			id: 'chart-protocol',
			kind: 'chart',
			subjectType: 'protocol',
			protocol: 'lido',
			type: 'fees',
			bindings: { subject: 'protocol' }
		})
	})

	test('chart subject flips between chain and protocol when the type supports both', () => {
		const chart = chainChart({ bindings: { subject: 'protocol' } })
		const { item } = resolveDashboardItem(chart, [protocolVariable], { protocol: 'aave' }, catalog)
		expect(item).toMatchObject({ subjectType: 'protocol', protocol: 'aave', type: 'tvl' })
		expect('chain' in item).toBe(false)
		expect('geckoId' in item).toBe(false)
	})

	test('chart is unavailable when the type does not exist for the resolved subject', () => {
		const chart = chainChart({ type: 'stablecoins', bindings: { subject: 'protocol' } })
		const { item, unavailable } = resolveDashboardItem(chart, [protocolVariable], { protocol: 'aave' }, catalog)
		expect(item).toBe(chart)
		expect(unavailable).toEqual({ variableId: 'protocol', reason: "Stablecoins chart isn't available for Aave" })
	})

	test('chart bound to a protocol missing from the catalog is unavailable', () => {
		const { item, unavailable } = resolveDashboardItem(
			protocolChart(),
			[protocolVariable],
			{ protocol: 'unknown' },
			catalog
		)
		expect(item).toMatchObject({ protocol: 'unknown' })
		expect(unavailable).toEqual({
			variableId: 'protocol',
			reason: 'unknown is not in the DefiLlama protocol catalog'
		})
	})

	test('metric bound to a chain variable switches subject and drops geckoId', () => {
		const { item } = resolveDashboardItem(chainMetric(), [chainVariable], { chain: 'Solana' }, catalog)
		expect(item).toMatchObject({ kind: 'metric', subject: { itemType: 'chain', chain: 'Solana' }, type: 'fees' })
		expect((item as MetricConfig).subject).not.toHaveProperty('geckoId')
	})

	test('metric flips to a protocol subject and reports unavailable types', () => {
		const metric: MetricConfig = { ...chainMetric(), bindings: { subject: 'protocol' } }
		expect(resolveDashboardItem(metric, [protocolVariable], { protocol: 'lido' }, catalog).item).toMatchObject({
			subject: { itemType: 'protocol', protocol: 'lido' }
		})
		const chainOnly = { ...metric, type: 'stablecoins' } as MetricConfig
		const resolved = resolveDashboardItem(chainOnly, [protocolVariable], { protocol: 'lido' }, catalog)
		expect(resolved.item).toBe(chainOnly)
		expect(resolved.unavailable).toEqual({
			variableId: 'protocol',
			reason: "Stablecoins metric isn't available for Lido"
		})
	})

	test('unified-table chains binding rewrites params.chains and keeps other params', () => {
		const table = unifiedTable({ chains: ['Ethereum'], category: 'Lending' })
		const { item } = resolveDashboardItem(table, [chainVariable], { chain: 'Solana' }, catalog)
		expect((item as UnifiedTableConfig).params).toEqual({ chains: ['Solana'], category: 'Lending' })
		expect(resolveDashboardItem(unifiedTable(null), [chainVariable], { chain: 'Solana' }, catalog).item).toMatchObject({
			params: { chains: ['Solana'] }
		})
	})

	test('builder chains binding rewrites config.chains, All becomes an empty filter', () => {
		expect(
			(resolveDashboardItem(builder(), [chainVariable], { chain: 'Solana' }, catalog).item as ChartBuilderConfig).config
				.chains
		).toEqual(['Solana'])
		expect(
			(resolveDashboardItem(builder(), [chainVariable], { chain: 'All' }, catalog).item as ChartBuilderConfig).config
				.chains
		).toEqual([])
	})

	test('builder protocol binding applies only in protocol mode', () => {
		const protocolMode = builder({ mode: 'protocol', protocol: 'aave' }, { protocol: 'protocol' })
		const resolved = resolveDashboardItem(protocolMode, [protocolVariable], { protocol: 'lido' }, catalog)
		expect((resolved.item as ChartBuilderConfig).config.protocol).toBe('lido')
		expect(resolved.unavailable).toBeUndefined()

		const chainsMode = builder({ mode: 'chains', protocol: 'aave' }, { protocol: 'protocol' })
		expect(resolveDashboardItem(chainsMode, [protocolVariable], { protocol: 'lido' }, catalog).item).toBe(chainsMode)

		const missing = resolveDashboardItem(protocolMode, [protocolVariable], { protocol: 'ghost' }, catalog)
		expect(missing.unavailable).toEqual({
			variableId: 'protocol',
			reason: 'ghost is not in the DefiLlama protocol catalog'
		})
	})

	test('stablecoins chain binding rewrites chain and keeps the All literal', () => {
		expect(resolveDashboardItem(stablecoins(), [chainVariable], { chain: 'Solana' }, catalog).item).toMatchObject({
			chain: 'Solana'
		})
		expect(resolveDashboardItem(stablecoins(), [chainVariable], { chain: 'All' }, catalog).item).toMatchObject({
			chain: 'All'
		})
		const same = stablecoins('Solana')
		expect(resolveDashboardItem(same, [chainVariable], { chain: 'Solana' }, catalog).item).toBe(same)
	})

	test.each(protocolCards.map((card) => [card.kind, card] as const))(
		'%s rewrites protocol and protocolName from the catalog',
		(_kind, card) => {
			const { item, unavailable } = resolveDashboardItem(card, [protocolVariable], { protocol: 'lido' }, catalog)
			expect(item).toMatchObject({ protocol: 'lido', protocolName: 'Lido' })
			expect(unavailable).toBeUndefined()

			const withoutCatalog = resolveDashboardItem(card, [protocolVariable], { protocol: 'lido' }, null)
			expect(withoutCatalog.item).toMatchObject({ protocol: 'lido', protocolName: 'lido' })

			const missing = resolveDashboardItem(card, [protocolVariable], { protocol: 'ghost' }, catalog)
			expect(missing.item).toMatchObject({ protocol: 'ghost' })
			expect(missing.unavailable).toEqual({
				variableId: 'protocol',
				reason: 'ghost is not in the DefiLlama protocol catalog'
			})
		}
	)

	test('binding to an unknown variable id is ignored', () => {
		const chart = chainChart({ bindings: { subject: 'deleted' } })
		expect(resolveDashboardItem(chart, [chainVariable], { chain: 'Solana' }, catalog)).toEqual({ item: chart })
	})

	test('binding to a variable of the wrong kind is ignored for single-kind fields', () => {
		const table = unifiedTable()
		expect(resolveDashboardItem(table, [protocolVariable], { chain: 'lido' }, catalog).item).toBe(table)
		const chainOnly = stablecoins()
		chainOnly.bindings = { chain: 'protocol' }
		expect(resolveDashboardItem(chainOnly, [protocolVariable], { protocol: 'lido' }, catalog).item).toBe(chainOnly)
	})
})

describe('resolveDashboardItems', () => {
	test('resolves every bound card and collects unavailable cards by item id', () => {
		const items: Array<DashboardItemConfig> = [
			chainChart(),
			chainMetric(),
			unifiedTable(),
			builder(),
			stablecoins(),
			...protocolCards,
			text
		]
		const { items: resolved, unavailableByItemId } = resolveDashboardItems(
			items,
			[chainVariable, { ...protocolVariable, value: 'ghost' }],
			{ chain: 'Solana' },
			catalog
		)
		expect(resolved).not.toBe(items)
		expect(resolved[0]).toMatchObject({ chain: 'Solana' })
		expect(resolved[1]).toMatchObject({ subject: { chain: 'Solana' } })
		expect(resolved[2]).toMatchObject({ params: { chains: ['Solana'] } })
		expect(resolved[3]).toMatchObject({ config: { chains: ['Solana'] } })
		expect(resolved[4]).toMatchObject({ chain: 'Solana' })
		for (const card of resolved.slice(5, 10)) expect(card).toMatchObject({ protocol: 'ghost', protocolName: 'ghost' })
		expect(resolved.at(-1)).toBe(text)
		expect([...unavailableByItemId.keys()].sort()).toEqual(protocolCards.map((card) => card.id).sort())
	})

	test('invalid override in the batch falls back to the default', () => {
		const { items } = resolveDashboardItems(
			[chainChart({ chain: 'Base' })],
			[chainVariable],
			{ chain: 'Mars' },
			catalog
		)
		expect(items[0]).toMatchObject({ chain: 'Ethereum' })
	})

	test('multi charts resolve each bound sub-item and surface unavailability under the multi id', () => {
		const multi: MultiChartConfig = {
			id: 'multi',
			kind: 'multi',
			items: [chainChart({ id: 'a' }), chainChart({ id: 'b', type: 'stablecoins', bindings: { subject: 'protocol' } })]
		}
		const { items, unavailableByItemId } = resolveDashboardItems(
			[multi],
			[chainVariable, protocolVariable],
			{ chain: 'Solana', protocol: 'lido' },
			catalog
		)
		const resolved = items[0] as MultiChartConfig
		expect(resolved).not.toBe(multi)
		expect(resolved.items[0]).toMatchObject({ chain: 'Solana' })
		expect(resolved.items[1]).toBe(multi.items[1])
		expect(unavailableByItemId.get('multi')).toEqual({
			variableId: 'protocol',
			reason: "Stablecoins chart isn't available for Lido"
		})
	})

	test('applyVariableValuesToItems rewrites literals to the saved defaults', () => {
		const items = applyVariableValuesToItems(
			[chainChart({ chain: 'Base' }), stablecoins('Base')],
			[chainVariable],
			catalog
		)
		expect(items[0]).toMatchObject({ chain: 'Ethereum' })
		expect(items[1]).toMatchObject({ chain: 'Ethereum' })
	})
})

describe('bindings', () => {
	test('dashboardHasBindings looks into multi charts and ignores empty bindings', () => {
		expect(dashboardHasBindings([text])).toBe(false)
		expect(dashboardHasBindings([chainChart({ bindings: {} })])).toBe(false)
		expect(dashboardHasBindings([chainChart()])).toBe(true)
		expect(dashboardHasBindings([{ id: 'm', kind: 'multi', items: [chainChart()] }])).toBe(true)
	})

	test('getItemFieldLiteral reads the literal per field and kind', () => {
		expect(getItemFieldLiteral(chainChart(), 'subject')).toEqual({ kind: 'chain', value: 'Ethereum' })
		expect(getItemFieldLiteral(protocolChart(), 'subject')).toEqual({ kind: 'protocol', value: 'aave' })
		expect(getItemFieldLiteral(chainChart(), 'chains')).toBeNull()
		expect(getItemFieldLiteral(chainMetric(), 'subject')).toEqual({ kind: 'chain', value: 'Ethereum' })
		expect(getItemFieldLiteral(unifiedTable(), 'chains')).toEqual({ kind: 'chain', value: 'Ethereum' })
		expect(getItemFieldLiteral(unifiedTable({ chains: ['Ethereum', 'Base'] }), 'chains')).toBeNull()
		expect(getItemFieldLiteral(builder(), 'chains')).toEqual({ kind: 'chain', value: 'Ethereum' })
		expect(getItemFieldLiteral(builder({ mode: 'protocol', protocol: 'aave' }), 'protocol')).toEqual({
			kind: 'protocol',
			value: 'aave'
		})
		expect(getItemFieldLiteral(builder({ protocol: 'aave' }), 'protocol')).toBeNull()
		expect(getItemFieldLiteral(stablecoins(), 'chain')).toEqual({ kind: 'chain', value: 'Ethereum' })
		expect(getItemFieldLiteral(protocolCards[0]!, 'protocol')).toEqual({ kind: 'protocol', value: 'aave' })
		expect(getItemFieldLiteral(text, 'subject')).toBeNull()
	})

	test('suggestVariableBindings targets unbound fields whose literal matches', () => {
		const items = [
			withoutBindings(chainChart()),
			chainChart({ id: 'already-bound' }),
			withoutBindings(chainMetric()),
			withoutBindings(unifiedTable()),
			withoutBindings(builder({ mode: 'protocol', protocol: 'aave' })),
			withoutBindings(stablecoins('Base')),
			withoutBindings(protocolCards[0]!),
			text
		]
		expect(suggestVariableBindings(items, 'chain', 'Ethereum')).toEqual([
			{ itemId: 'chart-chain', field: 'subject' },
			{ itemId: 'metric-chain', field: 'subject' },
			{ itemId: 'table', field: 'chains' },
			{ itemId: 'builder', field: 'chains' }
		])
		expect(suggestVariableBindings(items, 'protocol', 'aave')).toEqual([
			{ itemId: 'builder', field: 'protocol' },
			{ itemId: 'advanced-tvl', field: 'protocol' }
		])
		expect(suggestVariableBindings(items, 'chain', 'Solana')).toEqual([])
	})

	test('listCompatibleBindings targets every unbound field of the kind, whatever its literal', () => {
		const items = [
			withoutBindings(chainChart({ id: 'solana-chart', chain: 'Solana' })),
			chainChart({ id: 'already-bound' }),
			withoutBindings(chainMetric()),
			withoutBindings(unifiedTable({ chains: ['Ethereum', 'Base'] })),
			withoutBindings(builder({ mode: 'protocol', protocol: 'aave' })),
			withoutBindings(protocolCards[0]!),
			text
		]
		expect(listCompatibleBindings(items, 'chain', 'Ethereum')).toEqual([
			{ itemId: 'solana-chart', field: 'subject' },
			{ itemId: 'metric-chain', field: 'subject' },
			{ itemId: 'table', field: 'chains' },
			{ itemId: 'builder', field: 'chains' }
		])
		expect(listCompatibleBindings(items, 'protocol', 'aave')).toEqual([
			{ itemId: 'builder', field: 'protocol' },
			{ itemId: 'advanced-tvl', field: 'protocol' }
		])
		expect(getBindableFieldsForKind(builder({ mode: 'protocol', protocol: 'aave' }), 'chain')).toEqual(['chains'])
		expect(getBindableFieldsForKind(text, 'chain')).toEqual([])
	})

	test('bindDashboardItems merges bindings and keeps the array when nothing targets it', () => {
		const items = [withoutBindings(chainChart()), text]
		expect(bindDashboardItems(items, [], 'chain')).toBe(items)
		const bound = bindDashboardItems(items, [{ itemId: 'chart-chain', field: 'subject' }], 'chain')
		expect(bound[0]).toMatchObject({ bindings: { subject: 'chain' } })
		expect(bound[1]).toBe(text)
		const protocolModeBuilder = builder({ mode: 'protocol', protocol: 'aave' })
		const both = bindDashboardItems([protocolModeBuilder], [{ itemId: 'builder', field: 'protocol' }], 'protocol')
		expect((both[0] as ChartBuilderConfig).bindings).toEqual({ chains: 'chain', protocol: 'protocol' })
	})

	test('setDashboardItemBinding sets and clears one field, dropping empty bindings', () => {
		const bound = setDashboardItemBinding(stablecoins(), 'chain', 'other')
		expect(bound.bindings).toEqual({ chain: 'other' })
		const cleared = setDashboardItemBinding(bound, 'chain', null)
		expect('bindings' in cleared).toBe(false)
		expect(setDashboardItemBinding(text, 'subject', 'chain')).toBe(text)
	})

	test('unbindDashboardVariable strips one variable everywhere, including multi sub-items', () => {
		const multi: MultiChartConfig = {
			id: 'multi',
			kind: 'multi',
			items: [chainChart({ id: 'a' }), protocolChart({ id: 'b' })]
		}
		const twoBindings = builder({ mode: 'protocol', protocol: 'aave' })
		twoBindings.bindings = { chains: 'chain', protocol: 'protocol' }
		const items: Array<DashboardItemConfig> = [chainChart(), multi, twoBindings, text]
		const next = unbindDashboardVariable(items, 'chain')
		expect(next).not.toBe(items)
		expect('bindings' in next[0]!).toBe(false)
		const nextMulti = next[1] as MultiChartConfig
		expect('bindings' in nextMulti.items[0]!).toBe(false)
		expect(nextMulti.items[1]).toBe(multi.items[1])
		expect((next[2] as ChartBuilderConfig).bindings).toEqual({ protocol: 'protocol' })
		expect(next[3]).toBe(text)
		expect(unbindDashboardVariable(items, 'nobody')).toBe(items)
	})
})

describe('parameter discovery', () => {
	test('detectParameterCandidates counts literals shared by at least two unbound cards', () => {
		const items = [
			withoutBindings(chainChart()),
			withoutBindings(chainMetric()),
			withoutBindings(stablecoins()),
			withoutBindings(chainChart({ id: 'solo', chain: 'Base' })),
			withoutBindings(stablecoins('All')),
			{ ...withoutBindings(stablecoins('All')), id: 'all-2' },
			withoutBindings(protocolCards[0]!),
			withoutBindings(protocolCards[1]!),
			chainChart({ id: 'bound', chain: 'Ethereum' }),
			text
		]
		expect(detectParameterCandidates(items)).toEqual([
			{ kind: 'chain', value: 'Ethereum', count: 3 },
			{ kind: 'protocol', value: 'aave', count: 2 }
		])
		expect(detectParameterCandidates([withoutBindings(chainChart()), text])).toEqual([])
	})

	test('slugifyVariableId slugs the label and avoids taken ids', () => {
		expect(slugifyVariableId('Chain', new Set())).toBe('chain')
		expect(slugifyVariableId('Chain', new Set(['chain']))).toBe('chain-2')
		expect(slugifyVariableId('Chain', new Set(['chain', 'chain-2']))).toBe('chain-3')
		expect(slugifyVariableId('  Main Protocol!  ', new Set())).toBe('main-protocol')
		expect(slugifyVariableId('!!!', new Set())).toBe('param')
		expect(slugifyVariableId('a'.repeat(40), new Set())).toBe('a'.repeat(24))
	})
})

describe('AI iteration', () => {
	test('restoreItemsAfterIterate returns bindings when the subject literal is unchanged', () => {
		const previous = [chainChart(), protocolChart()]
		const next = [withoutBindings(chainChart({ geckoId: null })), withoutBindings(protocolChart({ protocol: 'lido' }))]
		const restored = restoreItemsAfterIterate(previous, next)
		expect(restored[0]).toEqual({ ...next[0], bindings: { subject: 'chain' } })
		expect(restored[1]).toBe(next[1])
	})

	test('restoreItemsAfterIterate restores builder bindings when the bound literal is empty on both sides', () => {
		const previous = [
			builder({ mode: 'protocol', chains: [], protocol: 'aave' }, { chains: 'chain', protocol: 'protocol' })
		]
		const next = [withoutBindings(previous[0]!)]
		expect(restoreItemsAfterIterate(previous, next)).toEqual(previous)
	})

	test('restoreItemsAfterIterate does not restore bindings when the kind changed', () => {
		const previous = [chainChart()]
		const replaced: TextConfig = { id: 'chart-chain', kind: 'text', content: 'now text' }
		expect(restoreItemsAfterIterate(previous, [replaced])).toEqual([replaced])
	})

	test('restoreItemsAfterIterate puts sections and custom data back at their positions', () => {
		const first = chainChart({ id: 'first' })
		const second = chainChart({ id: 'second' })
		const previous: Array<DashboardItemConfig> = [section, first, customData, second, text]
		const nextFirst = chainChart({ id: 'first' })
		const added = chainChart({ id: 'added' })
		const restored = restoreItemsAfterIterate(previous, [nextFirst, added, second])
		expect(restored.map((item) => item.id)).toEqual(['section', 'first', 'added', 'custom', 'second'])
		expect(restored[0]).toBe(section)
		expect(restored[3]).toBe(customData)
	})

	test('restoreItemsAfterIterate keeps the previous copy of AI-unknown kinds that the AI echoed back', () => {
		const strippedCustom = { ...customData }
		delete strippedCustom.rows
		const echoedSection: SectionConfig = { ...section, title: 'Renamed by AI' }
		const restored = restoreItemsAfterIterate([section, customData], [echoedSection, strippedCustom])
		expect(restored[0]).toBe(section)
		expect(restored[1]).toBe(customData)
	})

	test('restoreItemsAfterIterate appends trailing unknown items and handles an empty response', () => {
		expect(restoreItemsAfterIterate([chainChart(), customData], [])).toEqual([customData])
		expect(restoreItemsAfterIterate([], [text])).toEqual([text])
	})

	test('stripCustomDataRows removes rows only from custom-data cards', () => {
		const { rows: _rows, ...alreadyStripped } = customData
		const stripped = stripCustomDataRows([customData, text, { ...alreadyStripped, id: 'no-rows' }])
		expect('rows' in stripped[0]!).toBe(false)
		expect(stripped[0]).toMatchObject({ id: 'custom', kind: 'custom-data', name: 'Uploaded' })
		expect(stripped[1]).toBe(text)
		expect('rows' in stripped[2]!).toBe(false)
	})
})

describe('multi chart bindings', () => {
	const ethereumA = withoutBindings(chainChart({ id: 'sub-a' }))
	const ethereumB = withoutBindings(chainChart({ id: 'sub-b' }))
	const aave = withoutBindings(protocolChart({ id: 'sub-c' }))

	function multiChart(items: Array<ChartConfig>): MultiChartConfig {
		return { id: 'multi', kind: 'multi', items }
	}

	test('suggestVariableBindings offers one sub-chart per multi card and skips bound ones', () => {
		const multi = multiChart([ethereumA, ethereumB, aave])
		expect(suggestVariableBindings([multi], 'chain', 'Ethereum')).toEqual([
			{ itemId: 'multi', field: 'subject', subItemId: 'sub-a' }
		])
		expect(suggestVariableBindings([multi], 'protocol', 'aave')).toEqual([
			{ itemId: 'multi', field: 'subject', subItemId: 'sub-c' }
		])
		expect(suggestVariableBindings([multi], 'chain', 'Solana')).toEqual([])
		const partiallyBound = multiChart([chainChart({ id: 'sub-a' }), ethereumB])
		expect(suggestVariableBindings([partiallyBound], 'chain', 'Ethereum')).toEqual([
			{ itemId: 'multi', field: 'subject', subItemId: 'sub-b' }
		])
	})

	test('detectParameterCandidates counts a multi card once per literal', () => {
		const multi = multiChart([ethereumA, ethereumB, aave])
		expect(detectParameterCandidates([multi])).toEqual([])
		expect(detectParameterCandidates([multi, withoutBindings(chainChart())])).toEqual([
			{ kind: 'chain', value: 'Ethereum', count: 2 }
		])
	})

	test('bindDashboardItems binds only the targeted sub-chart', () => {
		const multi = multiChart([ethereumA, ethereumB, aave])
		const bound = bindDashboardItems([multi], [{ itemId: 'multi', field: 'subject', subItemId: 'sub-b' }], 'chain')
		const boundMulti = bound[0] as MultiChartConfig
		expect(boundMulti).not.toBe(multi)
		expect(boundMulti.items[0]).toBe(ethereumA)
		expect(boundMulti.items[1]).toMatchObject({ bindings: { subject: 'chain' } })
		expect(boundMulti.items[2]).toBe(aave)
		expect(bindDashboardItems([multi], [{ itemId: 'multi', field: 'subject' }], 'chain')[0]).toBe(multi)
	})

	test('setDashboardItemBinding moves the binding between sub-charts and needs a sub-item id', () => {
		const multi = multiChart([chainChart({ id: 'sub-a' }), ethereumB])
		const moved = setDashboardItemBinding(multi, 'subject', 'chain', 'sub-b')
		expect('bindings' in moved.items[0]!).toBe(false)
		expect(moved.items[1]).toMatchObject({ bindings: { subject: 'chain' } })
		const cleared = setDashboardItemBinding(moved, 'subject', null, 'sub-b')
		expect('bindings' in cleared.items[1]!).toBe(false)
		expect(setDashboardItemBinding(multi, 'subject', 'chain')).toBe(multi)
		expect(setDashboardItemBinding(multi, 'chain', 'chain', 'sub-b')).toBe(multi)
		expect(setDashboardItemBinding(multi, 'subject', 'chain', 'missing')).toBe(multi)
	})

	test('restoreItemsAfterIterate returns sub-chart bindings when the subject literal is unchanged', () => {
		const previous = multiChart([chainChart({ id: 'sub-a' }), protocolChart({ id: 'sub-c' })])
		const next = multiChart([
			withoutBindings(chainChart({ id: 'sub-a', geckoId: null })),
			withoutBindings(protocolChart({ id: 'sub-c', protocol: 'lido' }))
		])
		const restored = restoreItemsAfterIterate([previous], [next])[0] as MultiChartConfig
		expect(restored.items[0]).toEqual({ ...next.items[0], bindings: { subject: 'chain' } })
		expect(restored.items[1]).toBe(next.items[1])
		const unrelated = multiChart([withoutBindings(chainChart({ id: 'sub-z' }))])
		expect(restoreItemsAfterIterate([previous], [unrelated])[0]).toBe(unrelated)
	})
})
