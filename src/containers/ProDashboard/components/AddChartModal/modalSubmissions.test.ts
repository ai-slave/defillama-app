import { describe, expect, test } from 'vitest'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import { initializeFromEditItem } from './modalReducer'
import { buildEditedDashboardItem, buildNewDashboardItems } from './modalSubmissions'
import type { ModalState } from './types'

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

		const selectionState: ModalState = {
			...base,
			composerItems: [],
			selectedProtocol: 'aave',
			selectedChartTypes: ['fees', 'unlocks']
		}
		const [fees, unlocks] = buildNewDashboardItems({
			state: selectionState,
			protocols: [{ id: 'aave', name: 'Aave', slug: 'aave', tvl: 1, chains: [], geckoId: 'aave' }],
			chains: [],
			existingItems: [],
			idFactory
		})
		expect(fees).toMatchObject({ id: 'fees:aave', kind: 'chart', grouping: 'day', geckoId: 'aave' })
		expect(unlocks).toMatchObject({ id: 'unlocks:aave', kind: 'chart', dataType: 'documented', geckoId: 'aave' })
	})

	test('constructs every special manual card with its persisted identity and width semantics', () => {
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
			{ id: 'yields:pool', kind: 'yields', colSpan: 1 },
			{ id: 'stablecoins:Ethereum-totalMcap', kind: 'stablecoins', colSpan: 1 },
			{ id: 'stablecoin-asset:USDC-totalCirc', kind: 'stablecoin-asset', colSpan: 1 },
			{ id: 'rwa-overview:Ethereum-activeMcap-timeSeries-chain', kind: 'rwa-overview', chain: 'Ethereum', colSpan: 1 },
			{ id: 'rwa-asset:asset-activeMcap-onChainMcap-defiActiveTvl', kind: 'rwa-asset', colSpan: 1 },
			{ id: 'unlocks:aave', kind: 'chart', dataType: 'documented', colSpan: 1 },
			{ id: 'unlocks-schedule:aave', kind: 'unlocks-schedule', dataType: 'documented', colSpan: 2 },
			{ id: 'unlocks-pie:aave-allocation', kind: 'unlocks-pie', chartType: 'allocation', colSpan: 1 },
			{ id: 'advanced-tvl:aave-tvl', kind: 'advanced-tvl', colSpan: 1 },
			{ id: 'advanced-borrowed:aave-chainsBorrowed', kind: 'advanced-borrowed', colSpan: 1 },
			{ id: 'income-statement:aave', kind: 'income-statement', colSpan: 2 }
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
