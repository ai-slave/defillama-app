import { expect, test } from 'vitest'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import type { ChartConfig } from '../../types'
import { initializeFromEditItem } from './modalReducer'
import { resolveSubmitBlocker } from './submitBlocker'
import type { ModalState } from './types'

function state(overrides: Partial<ModalState>): ModalState {
	return { ...initializeFromEditItem(null), ...overrides }
}

const chartOnTab = (overrides: Partial<ModalState>) =>
	state({ selectedMainTab: 'charts', chartMode: 'manual', ...overrides })

test('the manual chart tabs name the selection they are missing', () => {
	expect(resolveSubmitBlocker(chartOnTab({ selectedChartTab: 'yields' }))).toBe('Pick a yield pool')
	expect(
		resolveSubmitBlocker(
			chartOnTab({
				selectedChartTab: 'yields',
				selectedYieldPool: { configID: 'pool', name: 'Pool', project: 'aave', chain: 'Ethereum' }
			})
		)
	).toBeNull()

	expect(resolveSubmitBlocker(chartOnTab({ selectedChartTab: 'stablecoins', selectedStablecoinChain: '' }))).toBe(
		'Pick a chain or asset'
	)
	expect(resolveSubmitBlocker(chartOnTab({ selectedChartTab: 'stablecoins' }))).toBeNull()
	expect(resolveSubmitBlocker(chartOnTab({ selectedChartTab: 'advanced-tvl' }))).toBe('Pick a protocol')
	expect(resolveSubmitBlocker(chartOnTab({ selectedChartTab: 'borrowed' }))).toBe('Pick a protocol')
	expect(
		resolveSubmitBlocker(chartOnTab({ selectedChartTab: 'rwa', rwaMode: 'asset', selectedRwaAssetId: null }))
	).toBe('Pick a chain or asset')
	expect(resolveSubmitBlocker(chartOnTab({ selectedChartTab: 'rwa' }))).toBeNull()
	expect(resolveSubmitBlocker(chartOnTab({ selectedChartTab: 'income-statement' }))).toBe('Pick a protocol')
	expect(resolveSubmitBlocker(chartOnTab({ selectedChartTab: 'unlocks' }))).toBe('Pick a protocol')
	expect(resolveSubmitBlocker(chartOnTab({ selectedChartTab: 'unlocks', selectedUnlocksProtocol: 'aave' }))).toBeNull()
})

test('the subject tabs ask for a category before a subject', () => {
	expect(resolveSubmitBlocker(chartOnTab({ selectedChartTab: 'chain', manualFormOpen: false }))).toBe(
		'Pick a category to start'
	)
	expect(resolveSubmitBlocker(chartOnTab({ selectedChartTab: 'chain', manualFormOpen: true }))).toBe(
		'Select at least one chain or protocol'
	)
	expect(
		resolveSubmitBlocker(
			chartOnTab({
				selectedChartTab: 'protocol',
				manualFormOpen: true,
				composerItems: [{ id: 'aave-fees', kind: 'chart', subjectType: 'protocol', protocol: 'aave', type: 'fees' }]
			})
		)
	).toBeNull()
})

test('editing a chart blocks separate mode once a second series is added', () => {
	const editItem = {
		id: 'tvl-card',
		kind: 'chart',
		subjectType: 'chain',
		chain: 'Ethereum',
		type: 'tvl'
	} satisfies DashboardItemConfig
	const composerItems: Array<ChartConfig> = [
		editItem,
		{ id: 'solana-tvl', kind: 'chart', subjectType: 'chain', chain: 'Solana', type: 'tvl' }
	]
	const editing = chartOnTab({ selectedChartTab: 'chain', manualFormOpen: true, composerItems })

	expect(resolveSubmitBlocker({ ...editing, chartCreationMode: 'separate' }, editItem)).toBe(
		'Keep one series, or switch to One chart'
	)
	expect(resolveSubmitBlocker({ ...editing, chartCreationMode: 'combined' }, editItem)).toBeNull()
	expect(
		resolveSubmitBlocker({ ...editing, chartCreationMode: 'separate', composerItems: [composerItems[0]] }, editItem)
	).toBeNull()
	expect(resolveSubmitBlocker({ ...editing, chartCreationMode: 'separate' })).toBeNull()
})

test('the chart builder asks for a metric', () => {
	const base = state({ selectedMainTab: 'charts', chartMode: 'builder' })
	const metric = '' as typeof base.chartBuilder.metric
	expect(resolveSubmitBlocker({ ...base, chartBuilder: { ...base.chartBuilder, metric } })).toBe('Choose a metric')
	expect(resolveSubmitBlocker({ ...base, chartBuilder: { ...base.chartBuilder, metric: 'fees' } })).toBeNull()
})

test('tables, text, metrics, saved charts and custom data each name their gap', () => {
	expect(resolveSubmitBlocker(state({ selectedMainTab: 'table', selectedTableType: 'stablecoins' }))).toBe(
		'Pick a chain'
	)
	expect(
		resolveSubmitBlocker(
			state({ selectedMainTab: 'table', selectedTableType: 'rwa-selected-chain', selectedDatasetChain: 'Ethereum' })
		)
	).toBeNull()
	expect(resolveSubmitBlocker(state({ selectedMainTab: 'table', selectedTableType: 'token-usage' }))).toBe(
		'Pick at least one token'
	)
	expect(resolveSubmitBlocker(state({ selectedMainTab: 'table', selectedTableType: 'chains' }))).toBeNull()

	expect(resolveSubmitBlocker(state({ selectedMainTab: 'text', textContent: '   ' }))).toBe('Write some text')
	expect(resolveSubmitBlocker(state({ selectedMainTab: 'text', textContent: 'Body' }))).toBeNull()

	expect(resolveSubmitBlocker(state({ selectedMainTab: 'metric', metricChain: null }))).toBe(
		'Pick a subject and a metric'
	)
	expect(resolveSubmitBlocker(state({ selectedMainTab: 'metric', metricChain: 'Ethereum' }))).toBeNull()
	expect(
		resolveSubmitBlocker(
			state({ selectedMainTab: 'metric', metricSubjectType: 'protocol', metricProtocol: 'aave', metricType: 'fees' })
		)
	).toBeNull()

	expect(resolveSubmitBlocker(state({ selectedMainTab: 'llamaai' }))).toBe('Pick a saved chart')
	expect(
		resolveSubmitBlocker(state({ selectedMainTab: 'llamaai', selectedLlamaAIChart: { id: 'saved', title: 'Saved' } }))
	).toBeNull()

	const customDataBase = initializeFromEditItem(null).customData
	expect(resolveSubmitBlocker(state({ selectedMainTab: 'custom-data' }))).toBe('Upload or paste a CSV')
	expect(
		resolveSubmitBlocker(
			state({ selectedMainTab: 'custom-data', customData: { ...customDataBase, isPreparing: true } })
		)
	).toBe('Preparing data…')
	expect(
		resolveSubmitBlocker(
			state({
				selectedMainTab: 'custom-data',
				customData: {
					...customDataBase,
					columns: [{ name: 'day', type: 'string' }],
					storedRows: [['2026-01-01']],
					error: 'Row 2 has 3 columns, expected 2.'
				}
			})
		)
	).toBe('Fix the CSV to continue')
	expect(
		resolveSubmitBlocker(
			state({
				selectedMainTab: 'custom-data',
				customData: {
					...customDataBase,
					columns: [{ name: 'day', type: 'string' }],
					storedRows: [['2026-01-01']]
				}
			})
		)
	).toBeNull()
})
