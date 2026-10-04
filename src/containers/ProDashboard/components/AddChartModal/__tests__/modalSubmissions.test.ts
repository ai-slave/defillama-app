import { describe, expect, test } from 'vitest'
import type { DashboardItemConfig } from '../../../dashboardItemConfig'
import type { ChartConfig } from '../../../types'
import { initializeFromEditItem } from '../modalReducer'
import { applyUnifiedTableBinding, buildEditedDashboardItem, buildNewDashboardItems } from '../modalSubmissions'
import type { ModalState } from '../types'

const existingMulti = {
	id: 'multi-card',
	kind: 'multi',
	name: 'Existing comparison',
	items: [
		{
			id: 'ethereum-tvl',
			kind: 'chart',
			subjectType: 'chain',
			chain: 'Ethereum',
			type: 'tvl'
		}
	],
	grouping: 'week',
	colSpan: 2,
	showStacked: true
} satisfies DashboardItemConfig

const idFactory = (kind: string, identity: string) => `${kind}:${identity}`

function buildNew(state: ModalState, existingItems: ReadonlyArray<DashboardItemConfig> = []) {
	return buildNewDashboardItems({ state, protocols: [], chains: [], existingItems, idFactory })
}

describe('buildEditedDashboardItem', () => {
	test('uses Builder mode even when an edited multi still has composer items', () => {
		const state: ModalState = {
			...initializeFromEditItem(existingMulti),
			chartMode: 'builder',
			chartBuilderName: 'TVL leaders'
		}

		expect(buildEditedDashboardItem({ editItem: existingMulti, state, protocols: [], chains: [] })).toEqual({
			id: 'multi-card',
			kind: 'builder',
			name: 'TVL leaders',
			config: state.chartBuilder,
			grouping: 'week',
			colSpan: 2
		})
	})

	test('preserves an edited multi and its display settings in Manual combined mode', () => {
		const state = {
			...initializeFromEditItem(existingMulti),
			unifiedChartName: 'Updated comparison'
		}

		expect(buildEditedDashboardItem({ editItem: existingMulti, state, protocols: [], chains: [] })).toEqual({
			...existingMulti,
			name: 'Updated comparison',
			items: state.composerItems
		})
	})

	test('editing a single chart keeps its id and kind', () => {
		const existingChart = {
			id: 'fees-card',
			kind: 'chart',
			subjectType: 'protocol',
			protocol: 'aave',
			type: 'fees',
			grouping: 'month',
			colSpan: 2
		} satisfies DashboardItemConfig
		const state: ModalState = {
			...initializeFromEditItem(existingChart),
			composerItems: [
				{
					id: 'composer-uniswap',
					kind: 'chart',
					subjectType: 'protocol',
					protocol: 'uniswap',
					type: 'fees',
					grouping: 'week',
					color: '#abcdef'
				}
			]
		}

		expect(buildEditedDashboardItem({ editItem: existingChart, state, protocols: [], chains: [] })).toEqual({
			id: 'fees-card',
			kind: 'chart',
			subjectType: 'protocol',
			protocol: 'uniswap',
			type: 'fees',
			grouping: 'week',
			color: '#abcdef',
			colSpan: 2
		})
	})

	test('switching an edited chart to combined with a second series yields a multi', () => {
		const existingChart = {
			id: 'tvl-card',
			kind: 'chart',
			subjectType: 'chain',
			chain: 'Ethereum',
			type: 'tvl'
		} satisfies DashboardItemConfig
		const composerItems: Array<ChartConfig> = [
			existingChart,
			{ id: 'solana-tvl', kind: 'chart', subjectType: 'chain', chain: 'Solana', type: 'tvl' }
		]
		const state: ModalState = {
			...initializeFromEditItem(existingChart),
			composerItems,
			chartCreationMode: 'combined',
			unifiedChartName: 'Chains TVL'
		}

		expect(buildEditedDashboardItem({ editItem: existingChart, state, protocols: [], chains: [] })).toEqual({
			id: 'tvl-card',
			kind: 'multi',
			name: 'Chains TVL',
			items: composerItems
		})
	})

	test('editing a single chart in combined mode stays a plain chart', () => {
		const existingChart = {
			id: 'tvl-card',
			kind: 'chart',
			subjectType: 'chain',
			chain: 'Ethereum',
			type: 'tvl'
		} satisfies DashboardItemConfig
		const state: ModalState = {
			...initializeFromEditItem(existingChart),
			composerItems: [{ id: 'solana-tvl', kind: 'chart', subjectType: 'chain', chain: 'Solana', type: 'tvl' }],
			chartCreationMode: 'combined',
			unifiedChartName: 'Chains TVL'
		}

		expect(buildEditedDashboardItem({ editItem: existingChart, state, protocols: [], chains: [] })).toEqual({
			id: 'tvl-card',
			kind: 'chart',
			subjectType: 'chain',
			chain: 'Solana',
			type: 'tvl'
		})
	})

	test('saves the one series left in an edited multi as a chart card in separate mode', () => {
		const state: ModalState = {
			...initializeFromEditItem(existingMulti),
			chartCreationMode: 'separate',
			composerItems: [{ id: 'solana-fees', kind: 'chart', subjectType: 'chain', chain: 'Solana', type: 'fees' }]
		}

		expect(buildEditedDashboardItem({ editItem: existingMulti, state, protocols: [], chains: [] })).toEqual({
			id: 'multi-card',
			kind: 'chart',
			subjectType: 'chain',
			chain: 'Solana',
			type: 'fees',
			colSpan: 2
		})
	})

	test('does not submit stale composer items for a different Manual chart tab', () => {
		const state: ModalState = {
			...initializeFromEditItem(existingMulti),
			selectedChartTab: 'advanced-tvl',
			selectedAdvancedTvlProtocol: null,
			selectedAdvancedTvlProtocolName: null
		}

		expect(buildEditedDashboardItem({ editItem: existingMulti, state, protocols: [], chains: [] })).toBeNull()
	})

	test('preserves non-editor metric semantics only while the subject identity is unchanged', () => {
		const existingMetric = {
			id: 'metric-card',
			kind: 'metric',
			subject: { itemType: 'protocol', protocol: 'aave', geckoId: 'aave' },
			type: 'fees',
			aggregator: 'sum',
			window: '30d',
			compare: { mode: 'previous_window', format: 'absolute' },
			chartType: 'bar',
			format: { value: 'currency', decimals: 2 },
			label: 'Fees'
		} satisfies DashboardItemConfig
		const state = { ...initializeFromEditItem(existingMetric), metricLabel: 'Updated fees' }

		expect(buildEditedDashboardItem({ editItem: existingMetric, state, protocols: [], chains: [] })).toMatchObject({
			subject: { itemType: 'protocol', protocol: 'aave', geckoId: 'aave' },
			compare: existingMetric.compare,
			format: existingMetric.format,
			label: 'Updated fees'
		})

		const changedSubject = buildEditedDashboardItem({
			editItem: existingMetric,
			state: { ...state, metricProtocol: 'maker' },
			protocols: [],
			chains: []
		})
		expect(changedSubject).toMatchObject({ subject: { itemType: 'protocol', protocol: 'maker' } })
		expect(changedSubject?.kind === 'metric' ? changedSubject.subject.geckoId : undefined).toBeUndefined()
	})

	test('preserves classic chart presentation and source settings on a no-op edit', () => {
		const existingChart = {
			id: 'fees-card',
			kind: 'chart',
			subjectType: 'protocol',
			protocol: 'aave',
			type: 'fees',
			grouping: 'month',
			color: '#123456',
			showCumulative: true,
			geckoId: 'aave',
			colSpan: 2
		} satisfies DashboardItemConfig

		expect(
			buildEditedDashboardItem({
				editItem: existingChart,
				state: initializeFromEditItem(existingChart),
				protocols: [],
				chains: []
			})
		).toEqual(existingChart)

		const realtimeUnlocks = {
			id: 'unlocks-card',
			kind: 'chart',
			subjectType: 'protocol',
			protocol: 'aave',
			type: 'unlocks',
			dataType: 'realtime'
		} satisfies DashboardItemConfig
		expect(
			buildEditedDashboardItem({
				editItem: realtimeUnlocks,
				state: initializeFromEditItem(realtimeUnlocks),
				protocols: [],
				chains: []
			})
		).toEqual(realtimeUnlocks)
	})

	test('clears optional names and titles while retaining unrelated same-kind settings', () => {
		const multiState = { ...initializeFromEditItem(existingMulti), unifiedChartName: '   ' }
		const multi = buildEditedDashboardItem({ editItem: existingMulti, state: multiState, protocols: [], chains: [] })
		expect(multi).toMatchObject({ kind: 'multi', grouping: 'week', showStacked: true })
		expect(multi && 'name' in multi ? multi.name : undefined).toBeUndefined()

		const existingBuilder = {
			id: 'builder-card',
			kind: 'builder',
			name: 'Old name',
			config: initializeFromEditItem(null).chartBuilder,
			grouping: 'month'
		} satisfies DashboardItemConfig
		const builder = buildEditedDashboardItem({
			editItem: existingBuilder,
			state: { ...initializeFromEditItem(existingBuilder), chartBuilderName: '' },
			protocols: [],
			chains: []
		})
		expect(builder).toMatchObject({ kind: 'builder', grouping: 'month' })
		expect(builder && 'name' in builder ? builder.name : undefined).toBeUndefined()

		const existingText = {
			id: 'text-card',
			kind: 'text',
			title: 'Old title',
			content: 'Body',
			allowHtml: true
		} satisfies DashboardItemConfig
		const text = buildEditedDashboardItem({
			editItem: existingText,
			state: { ...initializeFromEditItem(existingText), textTitle: '' },
			protocols: [],
			chains: []
		})
		expect(text).toMatchObject({ kind: 'text', content: 'Body', allowHtml: true })
		expect(text && 'title' in text ? text.title : undefined).toBeUndefined()

		const existingLlama = {
			id: 'llama-card',
			kind: 'llamaai-chart',
			savedChartId: 'saved',
			title: 'Old title',
			artifactStatus: 'live'
		} satisfies DashboardItemConfig
		const llama = buildEditedDashboardItem({
			editItem: existingLlama,
			state: {
				...initializeFromEditItem(existingLlama),
				selectedLlamaAIChart: { id: 'saved', title: '' }
			},
			protocols: [],
			chains: []
		})
		expect(llama).toMatchObject({ kind: 'llamaai-chart', savedChartId: 'saved', artifactStatus: 'live' })
		expect(llama && 'title' in llama ? llama.title : undefined).toBeUndefined()

		const switchedLlama = buildEditedDashboardItem({
			editItem: existingLlama,
			state: {
				...initializeFromEditItem(existingLlama),
				selectedLlamaAIChart: { id: 'replacement', title: 'Replacement' }
			},
			protocols: [],
			chains: []
		})
		expect(switchedLlama).toEqual({
			id: 'llama-card',
			kind: 'llamaai-chart',
			savedChartId: 'replacement',
			title: 'Replacement'
		})
	})
})

describe('buildNewDashboardItems', () => {
	test('builds a combined comparison with stable defaults derived from the current dashboard', () => {
		const state: ModalState = {
			...initializeFromEditItem(null),
			chartMode: 'manual',
			selectedChartTab: 'chain',
			chartCreationMode: 'combined',
			composerItems: [
				{
					id: 'ethereum-tvl',
					kind: 'chart',
					subjectType: 'chain',
					chain: 'Ethereum',
					type: 'tvl'
				},
				{
					id: 'ethereum-fees',
					kind: 'chart',
					subjectType: 'chain',
					chain: 'Ethereum',
					type: 'fees',
					grouping: 'week'
				}
			]
		}

		expect(buildNew(state, [existingMulti])).toEqual([
			{
				id: 'multi:',
				kind: 'multi',
				name: 'Multi-Chart 2',
				items: [{ ...state.composerItems[0], grouping: 'day' }, state.composerItems[1]],
				grouping: 'day',
				colSpan: 1
			}
		])
	})

	test('a lone composer item builds a plain chart even in combined mode', () => {
		const state: ModalState = {
			...initializeFromEditItem(null),
			chartMode: 'manual',
			selectedChartTab: 'chain',
			chartCreationMode: 'combined',
			unifiedChartName: 'Chains TVL',
			composerItems: [{ id: 'ethereum-tvl', kind: 'chart', subjectType: 'chain', chain: 'Ethereum', type: 'tvl' }]
		}

		expect(buildNew(state, [existingMulti])).toEqual([
			{ id: 'tvl:Ethereum', kind: 'chart', subjectType: 'chain', chain: 'Ethereum', type: 'tvl', colSpan: 1 }
		])
	})

	test('separate mode with two composer items builds two chart cards', () => {
		const state: ModalState = {
			...initializeFromEditItem(null),
			chartMode: 'manual',
			selectedChartTab: 'chain',
			chartCreationMode: 'separate',
			composerItems: [
				{ id: 'ethereum-tvl', kind: 'chart', subjectType: 'chain', chain: 'Ethereum', type: 'tvl' },
				{ id: 'solana-tvl', kind: 'chart', subjectType: 'chain', chain: 'Solana', type: 'tvl' }
			]
		}

		expect(buildNew(state)).toEqual([
			{ id: 'tvl:Ethereum', kind: 'chart', subjectType: 'chain', chain: 'Ethereum', type: 'tvl', colSpan: 1 },
			{ id: 'tvl:Solana', kind: 'chart', subjectType: 'chain', chain: 'Solana', type: 'tvl', colSpan: 1 }
		])
	})

	test('rebuilds separate composer and multi-selection charts with canonical chart defaults', () => {
		const base = {
			...initializeFromEditItem(null),
			chartMode: 'manual',
			selectedChartTab: 'protocol',
			chartCreationMode: 'separate'
		} satisfies ModalState
		const composerState: ModalState = {
			...base,
			composerItems: [
				{
					id: 'old-tvl',
					kind: 'chart',
					subjectType: 'protocol',
					protocol: 'aave',
					type: 'tvl',
					color: '#123456'
				},
				{
					id: 'old-fees',
					kind: 'chart',
					subjectType: 'protocol',
					protocol: 'aave',
					type: 'fees'
				}
			]
		}
		expect(buildNew(composerState)).toEqual([
			{
				id: 'tvl:aave',
				kind: 'chart',
				subjectType: 'protocol',
				protocol: 'aave',
				type: 'tvl',
				color: '#123456',
				colSpan: 1
			},
			{
				id: 'fees:aave',
				kind: 'chart',
				subjectType: 'protocol',
				protocol: 'aave',
				type: 'fees',
				grouping: 'day',
				colSpan: 1
			}
		])
	})

	test('constructs every special manual card with its subject and width', () => {
		const base = { ...initializeFromEditItem(null), chartMode: 'manual' } satisfies ModalState
		const states: Array<ModalState> = [
			{
				...base,
				selectedChartTab: 'yields',
				selectedYieldPool: { configID: 'pool', name: 'Pool', project: 'Project', chain: 'Ethereum' }
			},
			{ ...base, selectedChartTab: 'stablecoins', selectedStablecoinChain: 'Ethereum' },
			{
				...base,
				selectedChartTab: 'stablecoins',
				stablecoinMode: 'asset',
				selectedStablecoinAsset: 'USDC',
				selectedStablecoinAssetId: '1'
			},
			{ ...base, selectedChartTab: 'rwa', selectedRwaChain: 'Ethereum' },
			{
				...base,
				selectedChartTab: 'rwa',
				rwaMode: 'asset',
				selectedRwaAssetId: 'asset',
				selectedRwaAssetName: 'Asset'
			},
			{
				...base,
				selectedChartTab: 'unlocks',
				selectedUnlocksProtocol: 'aave',
				selectedUnlocksProtocolName: 'Aave'
			},
			{
				...base,
				selectedChartTab: 'unlocks',
				selectedUnlocksProtocol: 'aave',
				selectedUnlocksProtocolName: 'Aave',
				selectedUnlocksChartType: 'schedule'
			},
			{
				...base,
				selectedChartTab: 'unlocks',
				selectedUnlocksProtocol: 'aave',
				selectedUnlocksProtocolName: 'Aave',
				selectedUnlocksChartType: 'allocation'
			},
			{
				...base,
				selectedChartTab: 'advanced-tvl',
				selectedAdvancedTvlProtocol: 'aave',
				selectedAdvancedTvlProtocolName: 'Aave'
			},
			{
				...base,
				selectedChartTab: 'borrowed',
				selectedBorrowedProtocol: 'aave',
				selectedBorrowedProtocolName: 'Aave'
			},
			{
				...base,
				selectedChartTab: 'income-statement',
				selectedIncomeStatementProtocol: 'aave',
				selectedIncomeStatementProtocolName: 'Aave'
			}
		]

		expect(states.map((state) => buildNew(state)[0])).toMatchObject([
			{ kind: 'yields', poolConfigId: 'pool', chain: 'Ethereum', colSpan: 1 },
			{ kind: 'stablecoins', chain: 'Ethereum', chartType: 'totalMcap', colSpan: 1 },
			{ kind: 'stablecoin-asset', stablecoin: 'USDC', stablecoinId: '1', colSpan: 1 },
			{ kind: 'rwa-overview', chain: 'Ethereum', metric: 'activeMcap', colSpan: 1 },
			{ kind: 'rwa-asset', assetId: 'asset', colSpan: 1 },
			{ kind: 'chart', subjectType: 'protocol', protocol: 'aave', type: 'unlocks', dataType: 'documented', colSpan: 1 },
			{ kind: 'unlocks-schedule', protocol: 'aave', dataType: 'documented', colSpan: 2 },
			{ kind: 'unlocks-pie', protocol: 'aave', chartType: 'allocation', colSpan: 1 },
			{ kind: 'advanced-tvl', protocol: 'aave', chartType: 'tvl', colSpan: 1 },
			{ kind: 'advanced-borrowed', protocol: 'aave', chartType: 'chainsBorrowed', colSpan: 1 },
			{ kind: 'income-statement', protocol: 'aave', colSpan: 2 }
		])
	})

	test('creates the three CEX starter tables and rejects invalid special submissions without using stale composer state', () => {
		const tableState: ModalState = {
			...initializeFromEditItem(null),
			selectedMainTab: 'table',
			selectedTableType: 'cex-analytics',
			selectedCexAnalyticsView: 'starter'
		}
		expect(buildNew(tableState)).toMatchObject([
			{ id: 'table:cex-analytics-summary', kind: 'dataset-table', cexAnalyticsView: 'summary', colSpan: 2 },
			{ id: 'table:cex-analytics-comparison', kind: 'dataset-table', cexAnalyticsView: 'comparison', colSpan: 2 },
			{
				id: 'table:cex-analytics-spot-vs-derivatives',
				kind: 'dataset-table',
				cexAnalyticsView: 'spot-vs-derivatives',
				colSpan: 2
			}
		])

		const invalidState: ModalState = {
			...initializeFromEditItem(null),
			chartMode: 'manual',
			selectedChartTab: 'advanced-tvl',
			composerItems: existingMulti.items
		}
		expect(buildNew(invalidState)).toEqual([])
	})

	test('constructs non-manual item kinds and returns no item for incomplete submissions', () => {
		const base = initializeFromEditItem(null)
		const builder = buildNew({ ...base, chartMode: 'builder', chartBuilderName: ' Leaders ' })[0]
		const text = buildNew({ ...base, selectedMainTab: 'text', textTitle: ' Note ', textContent: ' Body ' })[0]
		const metric = buildNew({ ...base, selectedMainTab: 'metric', metricChain: 'Ethereum' })[0]
		const llama = buildNew({
			...base,
			selectedMainTab: 'llamaai',
			selectedLlamaAIChart: { id: 'saved', title: 'Saved chart' }
		})[0]

		expect(builder).toMatchObject({ id: 'builder:', kind: 'builder', name: 'Leaders', colSpan: 1 })
		expect(text).toEqual({ id: 'text:', kind: 'text', title: 'Note', content: 'Body', colSpan: 1 })
		expect(metric).toMatchObject({
			id: 'metric:',
			kind: 'metric',
			subject: { itemType: 'chain', chain: 'Ethereum' },
			colSpan: 0.5
		})
		expect(llama).toMatchObject({ id: 'llamaai-chart:saved', kind: 'llamaai-chart', colSpan: 1 })
		expect(buildNew({ ...base, selectedMainTab: 'text', textContent: '   ' })).toEqual([])
		expect(buildNew({ ...base, selectedMainTab: 'metric', metricChain: null })).toEqual([])
	})
})

describe('parameter bindings', () => {
	const boundChart = {
		id: 'tvl-card',
		kind: 'chart',
		subjectType: 'chain',
		chain: 'Ethereum',
		type: 'tvl',
		color: '#123456',
		geckoId: 'ethereum',
		bindings: { subject: 'chain' }
	} satisfies DashboardItemConfig

	test('keeps a binding and the retained presentation through an edit that does not change the subject', () => {
		const state = initializeFromEditItem(boundChart)
		expect(state.bindings).toEqual({ subject: 'chain' })

		const edited = buildEditedDashboardItem({ editItem: boundChart, state, protocols: [], chains: [] })
		expect(edited).toMatchObject({ id: 'tvl-card', kind: 'chart', chain: 'Ethereum', bindings: { subject: 'chain' } })
		expect(edited && 'color' in edited ? edited.color : undefined).toBe('#123456')
	})

	test('keeps the retained presentation when a bound subject moves to the parameter value', () => {
		const state = {
			...initializeFromEditItem(boundChart),
			selectedChain: 'Solana',
			composerItems: [{ ...boundChart, chain: 'Solana' }]
		}
		const edited = buildEditedDashboardItem({ editItem: boundChart, state, protocols: [], chains: [] })
		expect(edited).toMatchObject({ kind: 'chart', chain: 'Solana', color: '#123456', bindings: { subject: 'chain' } })
	})

	test('drops the binding and restores the catalog geckoId when the subject is picked manually', () => {
		const state = {
			...initializeFromEditItem(boundChart),
			selectedChain: 'Solana',
			bindings: {},
			composerItems: [
				{ id: 'solana-tvl', kind: 'chart', subjectType: 'chain', chain: 'Solana', type: 'tvl' } satisfies ChartConfig
			]
		}
		const edited = buildEditedDashboardItem({
			editItem: boundChart,
			state,
			protocols: [],
			chains: [{ name: 'Solana', gecko_id: 'solana', tvl: 1, tokenSymbol: 'SOL', chainId: null, cmcId: null }]
		})
		expect(edited).toMatchObject({ kind: 'chart', chain: 'Solana' })
		expect(edited && 'bindings' in edited ? edited.bindings : undefined).toBeUndefined()
		expect(edited && 'color' in edited ? edited.color : undefined).toBeUndefined()
	})

	test('removes geckoId from a bound chart and a bound metric', () => {
		const state = {
			...initializeFromEditItem(boundChart),
			selectedChartTypes: ['chainPrice'],
			composerItems: [{ ...boundChart, type: 'chainPrice' as const, geckoId: 'ethereum' }]
		}
		const edited = buildEditedDashboardItem({
			editItem: boundChart,
			state,
			protocols: [],
			chains: [{ name: 'Ethereum', gecko_id: 'ethereum', tvl: 1, tokenSymbol: 'ETH', chainId: null, cmcId: null }]
		})
		expect(edited && 'geckoId' in edited ? edited.geckoId : undefined).toBeUndefined()

		const boundMetric = {
			id: 'metric-card',
			kind: 'metric',
			subject: { itemType: 'protocol', protocol: 'aave', geckoId: 'aave' },
			type: 'fees',
			aggregator: 'sum',
			window: '30d',
			chartType: 'sparkline',
			bindings: { subject: 'protocol' }
		} satisfies DashboardItemConfig
		const editedMetric = buildEditedDashboardItem({
			editItem: boundMetric,
			state: initializeFromEditItem(boundMetric),
			protocols: [],
			chains: []
		})
		expect(editedMetric).toMatchObject({ kind: 'metric', bindings: { subject: 'protocol' } })
		expect(editedMetric?.kind === 'metric' ? editedMetric.subject.geckoId : 'unset').toBeUndefined()
	})

	test('applyUnifiedTableBinding adds the chains binding on create and drops it on edit', () => {
		const draft = { rowHeaders: ['protocol'] as Array<'protocol'>, params: { chains: ['Ethereum'] } }
		const created = applyUnifiedTableBinding(draft, 'chain')
		expect(created).toEqual({ ...draft, bindings: { chains: 'chain' } })

		const edited = applyUnifiedTableBinding(created, null)
		expect(edited).toEqual(draft)
		expect('bindings' in edited).toBe(false)

		const withOther = applyUnifiedTableBinding({ ...draft, bindings: { subject: 'chain' } }, null)
		expect(withOther.bindings).toEqual({ subject: 'chain' })
	})

	test('binds a newly created card and ignores fields the kind cannot bind', () => {
		const base = initializeFromEditItem(null)
		const [chart] = buildNew({
			...base,
			chartMode: 'manual',
			selectedChartTab: 'chain',
			chartCreationMode: 'separate',
			composerItems: [{ id: 'ethereum-tvl', kind: 'chart', subjectType: 'chain', chain: 'Ethereum', type: 'tvl' }],
			bindings: { subject: 'chain', protocol: 'protocol' }
		})
		expect(chart).toMatchObject({ kind: 'chart', chain: 'Ethereum', bindings: { subject: 'chain' } })

		const [yields] = buildNew({
			...base,
			chartMode: 'manual',
			selectedChartTab: 'yields',
			selectedYieldPool: { configID: 'pool', name: 'Pool', project: 'Project', chain: 'Ethereum' },
			bindings: { subject: 'chain' }
		})
		expect(yields && 'bindings' in yields ? yields.bindings : undefined).toBeUndefined()
	})
})

describe('custom data submissions', () => {
	const columns = [
		{ name: 'date', type: 'DATE' },
		{ name: 'value', type: 'BIGINT' }
	]
	const chart = {
		chartType: 'line' as const,
		xCol: 'date',
		yCols: ['value'],
		splitByCol: null,
		stackMode: 'off' as const,
		rightAxisCols: [],
		seriesKinds: {},
		seriesColors: {},
		numberFormat: 'auto' as const
	}
	const customDataState = (overrides: Partial<ModalState['customData']> = {}): ModalState['customData'] => ({
		name: ' Treasury ',
		sourceName: ' treasury.csv ',
		csvText: 'date,value\n2026-01-01,10',
		columns,
		previewRows: [['2026-01-01', 10]],
		storedRows: [['2026-01-01', 10]],
		chart,
		displayMode: 'chart',
		error: '',
		isPreparing: false,
		...overrides
	})

	test('creates a widget from parsed rows and refuses an unparsed submission', () => {
		const base = initializeFromEditItem(null)
		const [item] = buildNew({ ...base, selectedMainTab: 'custom-data', customData: customDataState() })
		expect(item).toEqual({
			id: 'custom-data:',
			kind: 'custom-data',
			name: 'Treasury',
			sourceName: 'treasury.csv',
			columns,
			rows: [['2026-01-01', 10]],
			chart,
			displayMode: 'chart',
			colSpan: 2
		})

		expect(
			buildNew({ ...base, selectedMainTab: 'custom-data', customData: customDataState({ storedRows: null }) })
		).toEqual([])
	})

	test('keeps stored rows, id and layout when an edit provides no new CSV', () => {
		const editItem = {
			id: 'custom-card',
			kind: 'custom-data',
			name: 'Treasury',
			columns,
			rows: { encoding: 'gzip-base64', data: 'ZGF0YQ==', rowCount: 2 },
			chart,
			displayMode: 'chart',
			colSpan: 2,
			height: 'tall'
		} satisfies DashboardItemConfig
		const unchanged = buildEditedDashboardItem({
			editItem,
			state: initializeFromEditItem(editItem),
			protocols: [],
			chains: []
		})
		expect(unchanged).toEqual(editItem)

		const replaced = buildEditedDashboardItem({
			editItem,
			state: {
				...initializeFromEditItem(editItem),
				customData: customDataState({ name: 'Renamed', displayMode: 'table' })
			},
			protocols: [],
			chains: []
		})
		expect(replaced).toEqual({
			id: 'custom-card',
			kind: 'custom-data',
			name: 'Renamed',
			sourceName: 'treasury.csv',
			columns,
			rows: [['2026-01-01', 10]],
			chart,
			displayMode: 'table',
			colSpan: 2,
			height: 'tall'
		})
	})
})
