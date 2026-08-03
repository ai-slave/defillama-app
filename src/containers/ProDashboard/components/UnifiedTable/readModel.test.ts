import { describe, expect, it } from 'vitest'
import { EMPTY_CANONICAL_CHAIN_METRICS } from '../../unifiedTable/contracts'
import type { ProtocolAggregateTableRow, ProtocolChainTableRow } from '../../unifiedTable/contracts'
import { buildProtocolTableReadModel, filterProtocolTableSourceRows, setProtocolTableFilteredShares } from './readModel'
import { buildProtocolAggregationPlan } from './utils/aggregation'
import { filterReadModelRowsByConfig, filterRowsByConfig, hasProtocolSubsetFilters } from './utils/dataFilters'

function ratioAggregationPlan(marketCap: boolean, tvl: boolean, fees: boolean, revenue: boolean) {
	return buildProtocolAggregationPlan({
		baseMetricFamilies: [],
		pointMetrics: [],
		supplementalMetrics: [],
		requestedRatioDependencies: { marketCap, tvl, fees, revenue },
		needsOracleMembership: false
	})
}

function protocol(
	id: string,
	tvl: number,
	options: { parentId?: string; excludeTvlFromParent?: true; chains?: string[]; oracles?: string[] } = {}
): ProtocolAggregateTableRow {
	return {
		rowType: 'protocol',
		id,
		name: id,
		protocolId: id,
		displayName: id,
		logo: `${id}.png`,
		category: 'Dexs',
		chains: options.chains ?? ['Base'],
		oracles: options.oracles ?? [],
		parentProtocolId: options.parentId ?? null,
		parentProtocolName: options.parentId ?? null,
		parentProtocolLogo: options.parentId ? `${options.parentId}.png` : null,
		...(options.excludeTvlFromParent ? { excludeTvlFromParent: true } : {}),
		metrics: { tvl, mcap: tvl * 10 },
		chain: null
	}
}

describe('protocol table read model', () => {
	it('builds deterministic economic groups and calculates shares on demand', () => {
		const rows = [
			protocol('child-b', 100, { parentId: 'parent', chains: ['Zora', 'Base'], oracles: ['Zeta'] }),
			protocol('child-a', 20, {
				parentId: 'parent',
				excludeTvlFromParent: true,
				chains: ['Base'],
				oracles: ['Alpha']
			}),
			protocol('standalone', 50)
		]
		const model = buildProtocolTableReadModel({
			rows,
			rowHeaders: ['parent-protocol', 'protocol'],
			parentMetrics: { parent: { mcap: 1_000, fdv: null, oracles: ['Parent Oracle'] } },
			chainMetrics: {},
			customColumns: []
		})
		setProtocolTableFilteredShares(model.rows)

		expect(model.rows).toHaveLength(2)
		const parent = model.rows.find((row) => row.displayName === 'parent')
		expect(parent?.metrics.tvl).toBe(100)
		expect(parent?.metrics.mcap).toBe(1_000)
		expect(parent?.chains).toEqual(['Base', 'Zora'])
		expect(parent?.oracles).toEqual(['Alpha', 'Parent Oracle', 'Zeta'])
		expect(parent?.filteredShares.tvl).toBeCloseTo(66.6667)
		expect(model.rows.find((row) => row.displayName === 'standalone')?.filteredShares.tvl).toBeCloseTo(33.3333)

		const searched = buildProtocolTableReadModel({
			rows: filterProtocolTableSourceRows(rows, 'parent', {
				parent: { mcap: 1_000, fdv: null, oracles: ['Parent Oracle'] }
			}),
			rowHeaders: ['parent-protocol', 'protocol'],
			parentMetrics: { parent: { mcap: 1_000, fdv: null, oracles: ['Parent Oracle'] } },
			chainMetrics: {},
			customColumns: []
		})
		setProtocolTableFilteredShares(searched.rows)
		expect(searched.rows).toHaveLength(1)
		expect(searched.leaves).toHaveLength(2)
		expect(searched.rows[0]?.filteredShares.tvl).toBe(100)

		const childSearch = buildProtocolTableReadModel({
			rows: filterProtocolTableSourceRows(rows, 'child-b', { parent: { mcap: 1_000, fdv: null } }),
			rowHeaders: ['parent-protocol', 'protocol'],
			parentMetrics: { parent: { mcap: 1_000, fdv: null } },
			chainMetrics: {},
			customColumns: []
		})
		setProtocolTableFilteredShares(childSearch.rows)
		expect(childSearch.rows[0]?.metrics.tvl).toBe(100)
		expect(childSearch.rows[0]?.filteredShares.tvl).toBe(100)
	})

	it('applies TVL exclusions only to parent groups', () => {
		const rows = [
			protocol('included', 100, { parentId: 'parent' }),
			protocol('excluded', 20, { parentId: 'parent', excludeTvlFromParent: true })
		]
		const model = buildProtocolTableReadModel({
			rows,
			rowHeaders: ['category', 'parent-protocol', 'protocol'],
			parentMetrics: { parent: { mcap: null, fdv: null } },
			chainMetrics: {},
			customColumns: []
		})

		const category = model.rows[0]
		if (!category || category.nodeType !== 'group') throw new Error('Expected category group')
		expect(category.metrics.tvl).toBe(120)
		const parent = category.subRows[0]
		if (!parent || parent.nodeType !== 'group') throw new Error('Expected parent group')
		expect(parent.metrics.tvl).toBe(100)
		expect(parent.subRows.map((row) => row.metrics.tvl)).toEqual([100, 20])
	})

	it('deduplicates a parent market cap within each overlapping category', () => {
		const dex = protocol('parent-dex', 10, { parentId: 'parent' })
		const dexTwo = protocol('parent-dex-two', 30, { parentId: 'parent' })
		const lending = protocol('parent-lending', 20, { parentId: 'parent' })
		lending.category = 'Lending'
		const model = buildProtocolTableReadModel({
			rows: [dex, dexTwo, lending],
			rowHeaders: ['category', 'parent-protocol', 'protocol'],
			parentMetrics: { parent: { mcap: 1_000, fdv: 2_000 } },
			chainMetrics: {},
			customColumns: []
		})

		const categoryMarketCaps = new Map(model.rows.map((category) => [category.displayName, category.metrics.mcap]))
		expect(categoryMarketCaps).toEqual(
			new Map([
				['Dexs', 1_000],
				['Lending', 1_000]
			])
		)
		for (const category of model.rows) {
			const parent = category.nodeType === 'group' ? category.subRows[0] : undefined
			expect(parent?.metrics.mcap).toBe(1_000)
		}
	})

	it('deduplicates parent market cap across children in a canonical chain group', () => {
		const first = protocol('parent-first', 10, { parentId: 'parent' })
		const second = protocol('parent-second', 20, { parentId: 'parent' })
		const rows: ProtocolChainTableRow[] = [first, second].map((row) => ({
			...row,
			rowType: 'protocol-chain',
			id: `${row.id}-ethereum`,
			chain: 'Ethereum',
			chains: ['Ethereum']
		}))
		const model = buildProtocolTableReadModel({
			rows,
			rowHeaders: ['chain', 'protocol'],
			parentMetrics: { parent: { mcap: 1_000, fdv: 2_000 } },
			chainMetrics: {
				ethereum: { availability: 'available', metrics: EMPTY_CANONICAL_CHAIN_METRICS }
			},
			customColumns: []
		})

		expect(model.rows[0]?.metrics).toMatchObject({ mcap: 1_000, fdv: 2_000 })
	})

	it('uses canonical chain totals and does not produce an infinite ratio at zero TVL', () => {
		const source = protocol('dex', 100)
		const row: ProtocolChainTableRow = {
			...source,
			rowType: 'protocol-chain',
			id: 'dex-ethereum',
			chain: 'Ethereum',
			chains: ['Ethereum']
		}
		const model = buildProtocolTableReadModel({
			rows: [row],
			rowHeaders: ['chain', 'protocol'],
			parentMetrics: {},
			chainMetrics: {
				ethereum: {
					availability: 'available',
					metrics: { ...EMPTY_CANONICAL_CHAIN_METRICS, tvl: 0 }
				}
			},
			customColumns: []
		})

		expect(model.rows[0]?.metrics.tvl).toBe(0)
		expect(model.rows[0]?.metrics.mcaptvl).toBeNull()
	})

	it('omits chain ratios when their market-cap dependency was not requested', () => {
		const source = protocol('dex', 100)
		Reflect.deleteProperty(source.metrics, 'mcap')
		const row: ProtocolChainTableRow = {
			...source,
			rowType: 'protocol-chain',
			id: 'dex-ethereum',
			chain: 'Ethereum',
			chains: ['Ethereum']
		}
		const model = buildProtocolTableReadModel({
			rows: [row],
			rowHeaders: ['chain', 'protocol'],
			parentMetrics: {},
			chainMetrics: { ethereum: { availability: 'available', metrics: { tvl: 100 } } },
			customColumns: [],
			aggregationPlan: ratioAggregationPlan(false, true, false, false)
		})

		expect(model.rows[0]?.metrics).not.toHaveProperty('mcaptvl')
		expect(model.rows[0]?.metrics).not.toHaveProperty('pf')
		expect(model.rows[0]?.metrics).not.toHaveProperty('ps')
	})

	it('keeps requested chain ratios explicit when every source row has sparse null metrics', () => {
		const source = protocol('dex', 100)
		source.metrics = {}
		const row: ProtocolChainTableRow = {
			...source,
			rowType: 'protocol-chain',
			id: 'dex-ethereum',
			chain: 'Ethereum',
			chains: ['Ethereum']
		}
		const model = buildProtocolTableReadModel({
			rows: [row],
			rowHeaders: ['chain', 'protocol'],
			parentMetrics: {},
			chainMetrics: { ethereum: { availability: 'available', metrics: {} } },
			customColumns: [],
			aggregationPlan: ratioAggregationPlan(true, true, true, true)
		})

		expect(model.rows[0]?.metrics).toMatchObject({ mcaptvl: null, pf: null, ps: null })
	})

	it('preserves zero numerators while treating zero ratio denominators as unknown', () => {
		const source = protocol('dex', 100)
		source.metrics.mcap = 0
		const row: ProtocolChainTableRow = {
			...source,
			rowType: 'protocol-chain',
			id: 'dex-ethereum',
			chain: 'Ethereum',
			chains: ['Ethereum']
		}
		const model = buildProtocolTableReadModel({
			rows: [row],
			rowHeaders: ['chain', 'protocol'],
			parentMetrics: {},
			chainMetrics: {
				ethereum: {
					availability: 'available',
					metrics: { tvl: 100, feesAnnualized1y: 10, revenueAnnualized1y: 0 }
				}
			},
			customColumns: []
		})

		expect(model.rows[0]?.metrics).toMatchObject({ mcaptvl: 0, pf: 0, ps: null })
	})

	it('does not present whole-chain totals as totals for a filtered subset', () => {
		const source = protocol('matched-dex', 100)
		source.metrics.fees24h = 100
		source.metrics.fees24h7dAgo = 80
		source.metrics.fees24hChange7dAgo = 25
		const row: ProtocolChainTableRow = {
			...source,
			rowType: 'protocol-chain',
			id: 'matched-dex-ethereum',
			chain: 'Ethereum',
			chains: ['Ethereum']
		}
		const model = buildProtocolTableReadModel({
			rows: [row],
			rowHeaders: ['chain', 'protocol'],
			parentMetrics: {},
			chainMetrics: {
				ethereum: { availability: 'available', metrics: { ...EMPTY_CANONICAL_CHAIN_METRICS, tvl: 1_000 } }
			},
			customColumns: [],
			chainMetricScope: 'partial'
		})

		const chain = model.rows[0]
		expect(chain?.nodeType).toBe('group')
		if (!chain || chain.nodeType !== 'group') throw new Error('Expected a grouped chain row')
		expect(chain.metrics.tvl).toBeNull()
		expect(chain.metrics.fees24h).toBeNull()
		expect(chain.metrics.fees24h7dAgo).toBeNull()
		expect(chain.metrics.fees24hChange7dAgo).toBeNull()
	})

	it('rebuilds parent totals and shares from only the source rows matching search', () => {
		const rows = [
			protocol('matched-child', 80, { parentId: 'parent' }),
			protocol('hidden-child', 20, { parentId: 'parent' }),
			protocol('other', 100)
		]
		const visibleRows = filterProtocolTableSourceRows(rows, 'matched-child', {
			parent: { mcap: null, fdv: null }
		})
		const model = buildProtocolTableReadModel({
			rows: visibleRows,
			rowHeaders: ['parent-protocol', 'protocol'],
			parentMetrics: { parent: { mcap: null, fdv: null } },
			chainMetrics: {},
			customColumns: []
		})
		setProtocolTableFilteredShares(model.rows)

		expect(model.rows).toHaveLength(1)
		expect(model.rows[0]?.metrics.tvl).toBe(80)
		expect(model.rows[0]?.nodeType).toBe('group')
		if (model.rows[0]?.nodeType !== 'group') throw new Error('Expected the searched parent group')
		expect(model.rows[0]?.filteredShares.tvl).toBe(100)
	})

	it('retains a parent ecosystem when only the parent has the selected oracle', () => {
		const rows = [
			protocol('child-a', 80, { parentId: 'parent' }),
			protocol('child-b', 20, { parentId: 'parent' }),
			protocol('unrelated', 100)
		]
		const filtered = filterRowsByConfig(
			rows,
			{ oracles: ['Parent Oracle'] },
			{
				parent: { mcap: null, fdv: null, oracles: ['Parent Oracle'] }
			}
		)

		expect(filtered.map((row) => row.protocolId)).toEqual(['child-a', 'child-b'])
	})

	it('searches direct and parent-level oracle membership', () => {
		const direct = protocol('direct', 10, { oracles: ['Pyth'] })
		const child = protocol('child', 20, { parentId: 'parent' })
		const unrelated = protocol('unrelated', 30)
		const parentMetrics = { parent: { mcap: null, fdv: null, oracles: ['Chainlink'] } }

		expect(filterProtocolTableSourceRows([direct, child, unrelated], 'pyth', parentMetrics)).toEqual([direct])
		expect(filterProtocolTableSourceRows([direct, child, unrelated], 'chainlink', parentMetrics)).toEqual([child])
	})

	it('applies protocol metric filters before hierarchy, totals, and shares', () => {
		const filtered = filterRowsByConfig([protocol('included', 100), protocol('excluded', 1)], { tvlMin: 10 })
		const model = buildProtocolTableReadModel({
			rows: filtered,
			rowHeaders: ['category', 'protocol'],
			parentMetrics: {},
			chainMetrics: {},
			customColumns: []
		})
		setProtocolTableFilteredShares(model.rows)

		expect(model.leaves.map((row) => row.protocolId)).toEqual(['included'])
		expect(model.rows[0]?.metrics.tvl).toBe(100)
		expect(model.rows[0]?.filteredShares.tvl).toBe(100)
	})

	it('does not traverse or replace share state when no share metrics are requested', () => {
		const model = buildProtocolTableReadModel({
			rows: [protocol('included', 100)],
			rowHeaders: ['category', 'protocol'],
			parentMetrics: {},
			chainMetrics: {},
			customColumns: []
		})
		const shares = model.rows[0]?.filteredShares

		setProtocolTableFilteredShares(model.rows, [])

		expect(model.rows[0]?.filteredShares).toBe(shares)
	})

	it('distinguishes source filters from canonical chain-only filters', () => {
		expect(hasProtocolSubsetFilters({ tvlMin: 10 })).toBe(true)
		expect(hasProtocolSubsetFilters({ categories: ['Dexs'] })).toBe(true)
		expect(hasProtocolSubsetFilters({ chains: ['Ethereum'] })).toBe(false)
		expect(hasProtocolSubsetFilters({ stablesMcapMin: 100, hasBridgedTVL: true })).toBe(false)
	})

	it('uses canonical chain metrics for filtering without replacing category-scoped chain totals', () => {
		const baseProtocol = protocol('base-dex', 10, { chains: ['Base'] })
		const ethereumProtocol = protocol('ethereum-dex', 20, { chains: ['Ethereum'] })
		const ethereumLendingProtocol = protocol('ethereum-lending', 30, { chains: ['Ethereum'] })
		ethereumLendingProtocol.category = 'Lending'
		const sourceRows: ProtocolChainTableRow[] = [
			{
				...baseProtocol,
				rowType: 'protocol-chain',
				id: 'base-dex-base',
				chain: 'Base',
				chains: ['Base']
			},
			{
				...ethereumProtocol,
				rowType: 'protocol-chain',
				id: 'ethereum-dex-ethereum',
				chain: 'Ethereum',
				chains: ['Ethereum']
			},
			{
				...ethereumLendingProtocol,
				rowType: 'protocol-chain',
				id: 'ethereum-lending-ethereum',
				chain: 'Ethereum',
				chains: ['Ethereum']
			}
		]
		const chainMetrics = {
			base: {
				availability: 'available' as const,
				metrics: { ...EMPTY_CANONICAL_CHAIN_METRICS, tvl: 100, stablesMcap: 50 }
			},
			ethereum: {
				availability: 'available' as const,
				metrics: { ...EMPTY_CANONICAL_CHAIN_METRICS, tvl: 1_000, stablesMcap: 500 }
			}
		}
		const filteredSourceRows = filterRowsByConfig(sourceRows, { stablesMcapMin: 100 }, {}, chainMetrics)
		const model = buildProtocolTableReadModel({
			rows: filteredSourceRows,
			rowHeaders: ['category', 'chain', 'protocol'],
			parentMetrics: {},
			chainMetrics,
			customColumns: []
		})

		expect(model.leaves.map((row) => row.protocolId)).toEqual(['ethereum-dex', 'ethereum-lending'])
		const categoryTotals = new Map<string, number | null>()
		for (const category of model.rows) {
			if (category.nodeType !== 'group') throw new Error('Expected retained category groups')
			const chain = category.subRows[0]
			if (!chain || chain.nodeType !== 'group') throw new Error('Expected a nested chain group')
			const tvl = chain.metrics.tvl
			if (tvl === undefined) throw new Error('Expected the requested TVL metric')
			expect(chain.displayName).toBe('Ethereum')
			expect(tvl).toBe(category.metrics.tvl)
			categoryTotals.set(category.displayName, tvl)
		}
		expect(categoryTotals).toEqual(
			new Map([
				['Dexs', 20],
				['Lending', 30]
			])
		)
	})

	it('retains a protocol group when one protocol has multiple chain rows', () => {
		const source = protocol('multi-chain', 30, { chains: ['Base', 'Ethereum'] })
		source.parentProtocolId = 'parent'
		source.parentProtocolName = 'parent'
		source.metrics.mcap = 300
		const rows: ProtocolChainTableRow[] = [
			{ ...source, id: 'multi-chain-base', rowType: 'protocol-chain', chain: 'Base', chains: ['Base'] },
			{ ...source, id: 'multi-chain-ethereum', rowType: 'protocol-chain', chain: 'Ethereum', chains: ['Ethereum'] }
		]
		const model = buildProtocolTableReadModel({
			rows,
			rowHeaders: ['protocol'],
			parentMetrics: { parent: { mcap: 1_000, fdv: null } },
			chainMetrics: {},
			customColumns: []
		})

		const groupedProtocol = model.rows[0]
		if (!groupedProtocol || groupedProtocol.nodeType !== 'group') throw new Error('Expected a protocol group')
		expect(groupedProtocol.groupKind).toBe('protocol')
		expect(groupedProtocol.subRows).toHaveLength(2)
		expect(groupedProtocol.metrics.mcap).toBe(300)
	})

	it('evaluates compiled custom columns consistently for leaves and groups', () => {
		const alpha = protocol('alpha', 10)
		alpha.metrics.fees24h = 2
		const beta = protocol('beta', 20)
		beta.metrics.fees24h = 3
		const model = buildProtocolTableReadModel({
			rows: [beta, alpha],
			rowHeaders: ['category'],
			parentMetrics: {},
			chainMetrics: {},
			customColumns: [
				{ id: 'custom_sum', name: 'Sum', expression: 'fees24h * 2', format: 'usd', aggregation: 'sum' },
				{
					id: 'custom_recalculate',
					name: 'Recalculate',
					expression: 'fees24h / tvl',
					format: 'ratio',
					aggregation: 'recalculate'
				},
				{ id: 'custom_first', name: 'First', expression: 'tvl', format: 'usd', aggregation: 'first' },
				{ id: 'custom_invalid', name: 'Invalid', expression: 'missingMetric', format: 'number', aggregation: 'sum' }
			]
		})

		const group = model.rows[0]
		expect(group?.customValues).toEqual({
			custom_sum: 10,
			custom_recalculate: 5 / 30,
			custom_first: 10,
			custom_invalid: null
		})
		expect(model.leaves.find((row) => row.protocolId === 'alpha')?.customValues).toMatchObject({
			custom_sum: 4,
			custom_recalculate: 0.2,
			custom_first: 10,
			custom_invalid: null
		})
	})

	it('propagates sum and first custom values through nested groups without changing null semantics', () => {
		const alpha = protocol('alpha', 10, { parentId: 'parent' })
		alpha.metrics.fees24h = null
		const beta = protocol('beta', 20, { parentId: 'parent' })
		beta.metrics.fees24h = 2
		const gamma = protocol('gamma', 30)
		gamma.metrics.fees24h = 3
		const model = buildProtocolTableReadModel({
			rows: [gamma, beta, alpha],
			rowHeaders: ['category', 'parent-protocol', 'protocol'],
			parentMetrics: { parent: { mcap: null, fdv: null } },
			chainMetrics: {},
			customColumns: [
				{ id: 'sum', name: 'Sum', expression: 'fees24h * 2', format: 'usd', aggregation: 'sum' },
				{ id: 'first', name: 'First', expression: 'tvl', format: 'usd', aggregation: 'first' },
				{ id: 'first_null', name: 'First null', expression: 'fees24h', format: 'usd', aggregation: 'first' },
				{
					id: 'recalculate',
					name: 'Recalculate',
					expression: 'fees24h / tvl',
					format: 'ratio',
					aggregation: 'recalculate'
				},
				{ id: 'none', name: 'None', expression: 'tvl', format: 'usd', aggregation: 'none' },
				{ id: 'invalid_sum', name: 'Invalid', expression: 'missingMetric', format: 'number', aggregation: 'sum' }
			]
		})

		const category = model.rows[0]
		if (!category || category.nodeType !== 'group') throw new Error('Expected category group')
		expect(category.customValues).toEqual({
			sum: 10,
			first: 10,
			first_null: null,
			recalculate: 5 / 60,
			none: null,
			invalid_sum: null
		})
		const parent = category.subRows.find((row) => row.displayName === 'parent')
		if (!parent || parent.nodeType !== 'group') throw new Error('Expected parent group')
		expect(parent.customValues).toEqual({
			sum: 4,
			first: 10,
			first_null: null,
			recalculate: 2 / 30,
			none: null,
			invalid_sum: null
		})
		expect(model.leaves.find((row) => row.protocolId === 'beta')?.customValues).toMatchObject({
			sum: 4,
			first: 20,
			first_null: 2,
			recalculate: 0.1,
			none: 20,
			invalid_sum: null
		})
	})

	it('propagates hidden chain inputs while exposing them only on chain groups', () => {
		const alpha = protocol('alpha', 10)
		alpha.metrics.stablesMcap = 10
		const beta = protocol('beta', 20)
		beta.metrics.stablesMcap = 20
		const rows: ProtocolChainTableRow[] = [alpha, beta].map((row) => ({
			...row,
			rowType: 'protocol-chain',
			id: `${row.id}-base`,
			chain: 'Base',
			chains: ['Base']
		}))
		const model = buildProtocolTableReadModel({
			rows,
			rowHeaders: ['category', 'chain', 'protocol'],
			parentMetrics: {},
			chainMetrics: {
				base: {
					availability: 'available',
					metrics: { ...EMPTY_CANONICAL_CHAIN_METRICS, stablesMcap: 100 }
				}
			},
			customColumns: [
				{ id: 'chain_sum', name: 'Chain sum', expression: 'stablesMcap', format: 'usd', aggregation: 'sum' },
				{
					id: 'chain_recalculate',
					name: 'Chain recalculate',
					expression: 'stablesMcap',
					format: 'usd',
					aggregation: 'recalculate'
				}
			]
		})

		const category = model.rows[0]
		if (!category || category.nodeType !== 'group') throw new Error('Expected category group')
		expect(category.customValues).toEqual({ chain_sum: null, chain_recalculate: null })
		const chain = category.subRows[0]
		if (!chain || chain.nodeType !== 'group') throw new Error('Expected chain group')
		expect(chain.customValues).toEqual({ chain_sum: 30, chain_recalculate: 30 })
		expect(model.leaves.map((row) => row.customValues)).toEqual([
			{ chain_sum: null, chain_recalculate: null },
			{ chain_sum: null, chain_recalculate: null }
		])
	})

	it('calculates filtered shares once after group filters', () => {
		const dex = protocol('dex', 10)
		dex.metrics.fees24h = 10
		const lender = protocol('lender', 20)
		lender.category = 'Lending'
		lender.metrics.fees24h = 20
		const lenderTwo = protocol('lender-two', 30)
		lenderTwo.category = 'Lending'
		lenderTwo.metrics.fees24h = 30
		const model = buildProtocolTableReadModel({
			rows: [dex, lender, lenderTwo],
			rowHeaders: ['category', 'protocol'],
			parentMetrics: {},
			chainMetrics: {},
			customColumns: []
		})
		const filtered = filterReadModelRowsByConfig(model.rows, { protocolCountMin: 2 })
		setProtocolTableFilteredShares(filtered, ['fees24h'])

		expect(filtered.map((row) => row.displayName)).toEqual(['Lending'])
		expect(filtered[0]?.filteredShares.fees24h).toBe(100)
		expect(model.rows[0]?.filteredShares.fees24h).toBeUndefined()
	})
})
