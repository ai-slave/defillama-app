import { expect, test } from 'vitest'
import type { DashboardItemConfig } from '../../../dashboardItemConfig'
import type { ChartConfig } from '../../../types'
import { initializeFromEditItem } from '../modalReducer'
import { resolvePickListLoad, resolveSubmitError, resolveSubmitGate } from '../submitBlocker'
import type { ModalState } from '../types'

function state(overrides: Partial<ModalState>): ModalState {
	return { ...initializeFromEditItem(null), ...overrides }
}

const chartOnTab = (overrides: Partial<ModalState>) =>
	state({ selectedMainTab: 'charts', chartMode: 'manual', ...overrides })

test('the manual chart tabs name the selection they are missing, for the control that needs it', () => {
	expect(resolveSubmitError(chartOnTab({ selectedChartTab: 'yields' }))).toBe('Choose a yield pool.')
	expect(
		resolveSubmitError(
			chartOnTab({
				selectedChartTab: 'yields',
				selectedYieldPool: { configID: 'pool', name: 'Pool', project: 'aave', chain: 'Ethereum' }
			})
		)
	).toBeNull()

	expect(resolveSubmitError(chartOnTab({ selectedChartTab: 'stablecoins', selectedStablecoinChain: '' }))).toBe(
		'Choose a chain.'
	)
	expect(resolveSubmitError(chartOnTab({ selectedChartTab: 'stablecoins', stablecoinMode: 'asset' }))).toBe(
		'Choose a stablecoin.'
	)
	expect(resolveSubmitError(chartOnTab({ selectedChartTab: 'stablecoins' }))).toBeNull()
	expect(resolveSubmitError(chartOnTab({ selectedChartTab: 'advanced-tvl' }))).toBe('Choose a protocol.')
	expect(resolveSubmitError(chartOnTab({ selectedChartTab: 'borrowed' }))).toBe('Choose a protocol.')
	expect(resolveSubmitError(chartOnTab({ selectedChartTab: 'rwa', rwaMode: 'asset', selectedRwaAssetId: null }))).toBe(
		'Choose an asset.'
	)
	expect(resolveSubmitError(chartOnTab({ selectedChartTab: 'rwa' }))).toBeNull()
	expect(resolveSubmitError(chartOnTab({ selectedChartTab: 'income-statement' }))).toBe('Choose a protocol.')
	expect(resolveSubmitError(chartOnTab({ selectedChartTab: 'unlocks' }))).toBe('Choose a protocol.')
	expect(resolveSubmitError(chartOnTab({ selectedChartTab: 'unlocks', selectedUnlocksProtocol: 'aave' }))).toBeNull()
})

test('the subject tabs wait for a category, then ask for a subject on Add', () => {
	expect(resolveSubmitGate(chartOnTab({ selectedChartTab: 'chain', manualFormOpen: false }))).toBe(
		'Pick a category to start'
	)
	expect(resolveSubmitError(chartOnTab({ selectedChartTab: 'chain', manualFormOpen: false }))).toBeNull()
	// Whatever category was last open, the grid with nothing composed waits for one instead of an error it cannot show.
	expect(resolveSubmitGate(chartOnTab({ selectedChartTab: 'yields', manualFormOpen: false }))).toBe(
		'Pick a category to start'
	)
	expect(resolveSubmitGate(chartOnTab({ selectedChartTab: 'chain', manualFormOpen: true }))).toBeNull()
	expect(resolveSubmitError(chartOnTab({ selectedChartTab: 'chain', manualFormOpen: true }))).toBe(
		'Choose at least one chain.'
	)
	expect(resolveSubmitError(chartOnTab({ selectedChartTab: 'protocol', manualFormOpen: true }))).toBe(
		'Choose at least one protocol.'
	)
	expect(
		resolveSubmitError(
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

	expect(resolveSubmitError({ ...editing, chartCreationMode: 'separate' }, editItem)).toBe(
		'Keep one series, or switch to One chart.'
	)
	expect(resolveSubmitError({ ...editing, chartCreationMode: 'combined' }, editItem)).toBeNull()
	expect(
		resolveSubmitError({ ...editing, chartCreationMode: 'separate', composerItems: [composerItems[0]] }, editItem)
	).toBeNull()
	expect(resolveSubmitError({ ...editing, chartCreationMode: 'separate' })).toBeNull()
})

test('editing a multi card blocks separate mode while it holds more than one series', () => {
	const series: Array<ChartConfig> = [
		{ id: 'ethereum-tvl', kind: 'chart', subjectType: 'chain', chain: 'Ethereum', type: 'tvl' },
		{ id: 'solana-tvl', kind: 'chart', subjectType: 'chain', chain: 'Solana', type: 'tvl' }
	]
	const editItem = { id: 'multi-card', kind: 'multi', items: series } satisfies DashboardItemConfig
	const editing = chartOnTab({
		selectedChartTab: 'chain',
		manualFormOpen: true,
		composerItems: series,
		chartCreationMode: 'separate'
	})

	expect(resolveSubmitError(editing, editItem)).toBe('Keep one series, or switch to One chart.')
})

test('a pick list that is loading or failed holds Add instead of an error under a loader', () => {
	const lists = (protocolsLoading: boolean, yieldPools: 'loading' | 'failed' | null) => ({
		protocolsLoading,
		yieldPools
	})
	const yields = chartOnTab({ selectedChartTab: 'yields', manualFormOpen: true })
	expect(resolvePickListLoad(yields, lists(false, 'loading'))).toEqual({ status: 'loading', label: 'Loading pools…' })
	expect(resolvePickListLoad(yields, lists(false, 'failed'))).toEqual({ status: 'failed' })
	expect(resolvePickListLoad(yields, lists(false, null))).toBeNull()
	// A pool already picked (an edited card) saves without the list.
	const pool = { configID: 'pool', name: 'Pool', project: 'aave', chain: 'Ethereum' }
	expect(resolvePickListLoad({ ...yields, selectedYieldPool: pool }, lists(false, 'failed'))).toBeNull()

	const protocols = chartOnTab({ selectedChartTab: 'protocol', manualFormOpen: true })
	expect(resolvePickListLoad(protocols, lists(true, null))).toEqual({ status: 'loading', label: 'Loading protocols…' })
	const aaveFees = { id: 'aave-fees', kind: 'chart', subjectType: 'protocol', protocol: 'aave', type: 'fees' } as const
	expect(resolvePickListLoad({ ...protocols, composerItems: [aaveFees] }, lists(true, null))).toBeNull()
	// The category grid and other tabs have no such list.
	expect(resolvePickListLoad({ ...protocols, manualFormOpen: false }, lists(true, null))).toBeNull()
	expect(resolvePickListLoad({ ...yields, selectedMainTab: 'text' }, lists(true, 'loading'))).toBeNull()
})

test('the chart builder asks for a metric', () => {
	const base = state({ selectedMainTab: 'charts', chartMode: 'builder' })
	const metric = '' as typeof base.chartBuilder.metric
	expect(resolveSubmitError({ ...base, chartBuilder: { ...base.chartBuilder, metric } })).toBe('Choose a metric.')
	expect(resolveSubmitError({ ...base, chartBuilder: { ...base.chartBuilder, metric: 'fees' } })).toBeNull()
})

test('tables, text, metrics and custom data each name their gap; a table type, a saved chart and a preparing CSV gate Add', () => {
	expect(resolveSubmitError(state({ selectedMainTab: 'table', selectedTableType: 'stablecoins' }))).toBe(
		'Choose a chain.'
	)
	expect(
		resolveSubmitError(
			state({ selectedMainTab: 'table', selectedTableType: 'rwa-selected-chain', selectedDatasetChain: 'Ethereum' })
		)
	).toBeNull()
	expect(resolveSubmitError(state({ selectedMainTab: 'table', selectedTableType: 'token-usage' }))).toBe(
		'Choose at least one token.'
	)
	expect(resolveSubmitError(state({ selectedMainTab: 'table', selectedTableType: 'chains' }))).toBeNull()

	expect(resolveSubmitError(state({ selectedMainTab: 'text', textContent: '   ' }))).toBe('Enter some text.')
	expect(resolveSubmitError(state({ selectedMainTab: 'text', textContent: 'Body' }))).toBeNull()

	expect(resolveSubmitError(state({ selectedMainTab: 'metric', metricChain: null }))).toBe('Choose a chain.')
	expect(resolveSubmitError(state({ selectedMainTab: 'metric', metricChain: 'Ethereum' }))).toBeNull()
	expect(
		resolveSubmitError(
			state({ selectedMainTab: 'metric', metricSubjectType: 'protocol', metricProtocol: 'aave', metricType: 'fees' })
		)
	).toBeNull()

	expect(resolveSubmitGate(state({ selectedMainTab: 'table', selectedTableType: null }))).toBe(
		'Pick a table type to start'
	)
	expect(resolveSubmitGate(state({ selectedMainTab: 'llamaai' }))).toBe('Pick a saved chart')
	expect(
		resolveSubmitGate(state({ selectedMainTab: 'llamaai', selectedLlamaAIChart: { id: 'saved', title: 'Saved' } }))
	).toBeNull()

	const customDataBase = initializeFromEditItem(null).customData
	expect(resolveSubmitError(state({ selectedMainTab: 'custom-data' }))).toBe('Paste or upload a CSV.')
	expect(
		resolveSubmitGate(state({ selectedMainTab: 'custom-data', customData: { ...customDataBase, isPreparing: true } }))
	).toBe('Preparing data…')
	expect(
		resolveSubmitError(
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
	).toBe('Row 2 has 3 columns, expected 2.')
	expect(
		resolveSubmitError(
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
