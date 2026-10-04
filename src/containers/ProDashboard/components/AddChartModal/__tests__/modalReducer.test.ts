import { expect, test } from 'vitest'
import type { DashboardItemConfig } from '../../../dashboardItemConfig'
import { hasDraftChanges, initializeFromEditItem, modalReducer, resolveChartTypesForSubjectTab } from '../modalReducer'

test('defaults to manual and preserves the chosen mode on reset', () => {
	const state = initializeFromEditItem(null)
	expect(state).toMatchObject({ chartMode: 'manual', selectedChartTab: 'chain', chartCreationMode: 'combined' })
	expect(initializeFromEditItem(null, 'builder').chartMode).toBe('builder')
	expect(modalReducer({ ...state, chartMode: 'builder' }, { type: 'RESET_STATE' }).chartMode).toBe('builder')
})
test('retains compatible metrics and synchronizes the singular selection', () => {
	const state = { ...initializeFromEditItem(null), selectedChartTypes: ['fees'] }
	expect(modalReducer(state, { type: 'SET_SELECTED_CHART_TAB', payload: 'protocol' })).toMatchObject({
		selectedChartTypes: ['fees'],
		selectedChartType: 'fees'
	})
	expect(resolveChartTypesForSubjectTab('protocol', ['stablecoins'])).toEqual(['tvl'])
	expect(resolveChartTypesForSubjectTab('chain', ['unlocks'])).toEqual(['tvl'])
	expect(resolveChartTypesForSubjectTab('chain', [])).toEqual(['tvl'])
	expect(modalReducer(state, { type: 'SET_SELECTED_CHART_TAB', payload: 'yields' }).selectedChartTypes).toEqual([
		'fees'
	])
})

test('editing a builder takes precedence over manual preference', () => {
	const state = initializeFromEditItem(null)
	expect(
		initializeFromEditItem({ id: 'builder', kind: 'builder', config: state.chartBuilder }, 'manual').chartMode
	).toBe('builder')
})

test('initializes the modal from an edit item with parameter bindings', () => {
	const boundChart = {
		id: 'tvl-card',
		kind: 'chart',
		subjectType: 'chain',
		chain: 'Ethereum',
		type: 'tvl',
		bindings: { subject: 'chain' }
	} satisfies DashboardItemConfig
	const state = initializeFromEditItem(boundChart)
	expect(state.bindings).toEqual({ subject: 'chain' })

	const boundStablecoins = {
		id: 'stables-card',
		kind: 'stablecoins',
		chain: 'Ethereum',
		chartType: 'totalMcap',
		bindings: { chain: 'chain', subject: 'chain' }
	} as unknown as DashboardItemConfig
	expect(initializeFromEditItem(boundStablecoins).bindings).toEqual({ chain: 'chain' })

	expect(initializeFromEditItem({ id: 'text', kind: 'text', content: 'Body' }).bindings).toEqual({})
	expect(initializeFromEditItem(null).bindings).toEqual({})
})

test('drops a subject binding when the subject is picked manually and keeps it otherwise', () => {
	const state = { ...initializeFromEditItem(null), selectedChain: 'Ethereum', bindings: { subject: 'chain' } }
	expect(modalReducer(state, { type: 'SET_SELECTED_CHAIN', payload: 'Ethereum' })).toBe(state)
	expect(modalReducer(state, { type: 'SET_SELECTED_CHAIN', payload: 'Solana' }).bindings).toEqual({})
	expect(
		modalReducer(state, { type: 'SET_ITEM_BINDING', payload: { field: 'subject', variableId: null } }).bindings
	).toEqual({})
	expect(
		modalReducer(
			{ ...state, bindings: {} },
			{ type: 'SET_ITEM_BINDING', payload: { field: 'subject', variableId: 'chain' } }
		).bindings
	).toEqual({ subject: 'chain' })
})

test('reads and edits a unified table chains binding', () => {
	const boundTable = {
		id: 'table',
		kind: 'unified-table',
		configVersion: 3,
		strategy: 'protocols',
		rowHeaders: ['protocol'],
		params: { chains: ['Ethereum'] },
		bindings: { chains: 'chain', subject: 'chain' }
	} as unknown as DashboardItemConfig
	const state = initializeFromEditItem(boundTable)
	expect(state.bindings).toEqual({ chains: 'chain' })
	expect(
		modalReducer(state, { type: 'SET_ITEM_BINDING', payload: { field: 'chains', variableId: null } }).bindings
	).toEqual({})
	expect(
		modalReducer(
			{ ...state, bindings: {} },
			{ type: 'SET_ITEM_BINDING', payload: { field: 'chains', variableId: 'chain' } }
		).bindings
	).toEqual({ chains: 'chain' })
})

test('reads an edited custom data widget into the modal without rebuilding its rows', () => {
	const customData = {
		id: 'custom-card',
		kind: 'custom-data',
		name: 'Treasury',
		sourceName: 'treasury.csv',
		columns: [
			{ name: 'date', type: 'DATE' },
			{ name: 'value', type: 'BIGINT' }
		],
		rows: [['2026-01-01', 10]],
		chart: {
			chartType: 'line',
			xCol: 'date',
			yCols: ['value'],
			splitByCol: null,
			stackMode: 'off',
			rightAxisCols: [],
			seriesKinds: {},
			seriesColors: {},
			numberFormat: 'auto'
		},
		displayMode: 'table'
	} satisfies DashboardItemConfig

	const state = initializeFromEditItem(customData)
	expect(state.selectedMainTab).toBe('custom-data')
	expect(state.customData).toMatchObject({
		name: 'Treasury',
		sourceName: 'treasury.csv',
		columns: customData.columns,
		storedRows: customData.rows,
		chart: customData.chart,
		displayMode: 'table',
		csvText: '',
		previewRows: null
	})
})

test('initializes a single chart edit with one composer item in separate mode', () => {
	const chart = {
		id: 'fees-card',
		kind: 'chart',
		subjectType: 'protocol',
		protocol: 'aave',
		type: 'fees',
		color: '#123456'
	} satisfies DashboardItemConfig
	const state = initializeFromEditItem(chart)
	expect(state).toMatchObject({
		selectedMainTab: 'charts',
		chartMode: 'manual',
		selectedChartTab: 'protocol',
		chartCreationMode: 'separate',
		manualFormOpen: true,
		selectedChartTypes: ['fees']
	})
	expect(state.composerItems).toEqual([chart])
	expect(initializeFromEditItem(null).manualFormOpen).toBe(false)
	expect(modalReducer(state, { type: 'SET_MANUAL_FORM_OPEN', payload: false }).manualFormOpen).toBe(false)
	expect(modalReducer(state, { type: 'SET_MANUAL_FORM_OPEN', payload: true })).toBe(state)
})

test('editing a multi-chart opens the manual form with its items’ chart type picked', () => {
	const state = initializeFromEditItem({
		id: 'multi',
		kind: 'multi',
		name: 'Fees',
		items: [
			{ id: 'a', kind: 'chart', subjectType: 'protocol', protocol: 'aave', type: 'fees' },
			{ id: 'b', kind: 'chart', subjectType: 'protocol', protocol: 'uniswap', type: 'fees' }
		]
	})
	expect([state.selectedChartTab, state.selectedChartTypes]).toEqual(['protocol', ['fees']])
})

const openManualForm = () => modalReducer(initializeFromEditItem(null), { type: 'SET_MANUAL_FORM_OPEN', payload: true })

test('returning to the charts tab with the manual form open picks tvl', () => {
	const away = modalReducer(modalReducer(openManualForm(), { type: 'SET_SELECTED_MAIN_TAB', payload: 'metric' }), {
		type: 'SET_SELECTED_CHART_TYPES',
		payload: []
	})
	expect(modalReducer(away, { type: 'SET_SELECTED_MAIN_TAB', payload: 'charts' }).selectedChartTypes).toEqual(['tvl'])
})

test('a closed manual form or builder mode leaves the chart types empty', () => {
	const closed = initializeFromEditItem(null)
	expect(modalReducer(closed, { type: 'SET_SELECTED_CHART_TYPES', payload: [] }).selectedChartTypes).toEqual([])
	expect(
		modalReducer({ ...openManualForm(), chartMode: 'builder' }, { type: 'SET_SELECTED_CHART_TYPES', payload: [] })
			.selectedChartTypes
	).toEqual([])
})

test('picking another yield pool starts its chart on TVL and APY, picking the same pool keeps the type', () => {
	const pool = { configID: 'pool-1', name: 'USDC', project: 'aave-v3', chain: 'Ethereum' }
	const editing = initializeFromEditItem({
		id: 'yields',
		kind: 'yields',
		poolConfigId: 'pool-1',
		poolName: 'USDC',
		project: 'aave-v3',
		chain: 'Ethereum',
		chartType: 'borrow-apy'
	})
	expect(modalReducer(editing, { type: 'SET_SELECTED_YIELD_POOL', payload: pool }).selectedYieldChartType).toBe(
		'borrow-apy'
	)
	expect(
		modalReducer(editing, { type: 'SET_SELECTED_YIELD_POOL', payload: { ...pool, configID: 'pool-2' } })
			.selectedYieldChartType
	).toBe('tvl-apy')
})

test('picking a table type is browsing, not work to ask about, while a typed text card is', () => {
	const opened = initializeFromEditItem(null)
	const picked = modalReducer(opened, { type: 'SET_SELECTED_TABLE_TYPE', payload: 'chains' })
	expect(picked.selectedTableType).toBe('chains')
	expect(hasDraftChanges(picked, opened)).toBe(false)
	expect(hasDraftChanges(modalReducer(picked, { type: 'SET_TEXT_CONTENT', payload: '# Notes' }), opened)).toBe(true)
})
