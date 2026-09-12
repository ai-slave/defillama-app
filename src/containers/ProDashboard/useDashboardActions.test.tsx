// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { DashboardItemConfig } from './dashboardItemConfig'
import type { DashboardAction, DashboardState } from './dashboardReducer'
import type { MultiChartConfig, TextConfig } from './types'
import type { UnifiedTableConfig } from './unifiedTable/config/current'
import { useDashboardActions } from './useDashboardActions'

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean
}

const FIRST: TextConfig = { id: 'first', kind: 'text', content: 'First' }
const SECOND: TextConfig = { id: 'second', kind: 'text', content: 'Second' }
const UNIFIED_TABLE: UnifiedTableConfig = {
	id: 'unified-table-protocols',
	kind: 'unified-table',
	configVersion: 3,
	strategy: 'protocols',
	rowHeaders: ['category', 'protocol'],
	defaultSorting: [{ id: 'fees24h', desc: true }],
	params: { chains: ['Ethereum', 'Base'], category: 'Dexs' },
	filters: { protocols: ['aave'], fees24hMin: 100 },
	columnOrder: ['name', 'fees24h', 'custom-margin'],
	columnVisibility: { name: true, fees24h: true },
	customColumns: [
		{
			id: 'custom-margin',
			name: 'Margin',
			expression: 'revenue24h / fees24h',
			format: 'percent',
			aggregation: 'recalculate'
		}
	],
	colSpan: 2
}

function dashboardState(): DashboardState {
	return {
		items: [FIRST, SECOND],
		timePeriod: '365d',
		customTimePeriod: null,
		dashboardName: 'Dashboard',
		dashboardId: 'dashboard',
		currentDashboard: null,
		dashboardVisibility: 'private',
		dashboardTags: [],
		dashboardDescription: '',
		showGenerateDashboardModal: false,
		showIterateDashboardModal: false
	}
}

describe('useDashboardActions', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('saves each period selection with matching overrides', async () => {
		const autoSave = vi.fn()
		const dispatch = vi.fn()
		let actions!: ReturnType<typeof useDashboardActions>
		function Harness() {
			actions = useDashboardActions(dispatch, dashboardState(), autoSave, false)
			return null
		}
		await act(async () => root.render(<Harness />))
		act(() => actions.setTimePeriod('30d'))
		expect(autoSave).toHaveBeenLastCalledWith([FIRST, SECOND], { timePeriod: '30d', customTimePeriod: null })
		expect(dispatch).toHaveBeenLastCalledWith({ type: 'SET_TIME_PERIOD', payload: '30d' })
		act(() => actions.setTimePeriod('custom'))
		expect(autoSave).toHaveBeenLastCalledWith([FIRST, SECOND], { timePeriod: 'custom' })
		const period = { type: 'relative', relativeDays: 14 } as const
		act(() => actions.setCustomTimePeriod(period))
		expect(autoSave).toHaveBeenLastCalledWith([FIRST, SECOND], { timePeriod: 'custom', customTimePeriod: period })
		act(() => actions.setCustomTimePeriod(null))
		expect(autoSave).toHaveBeenLastCalledWith([FIRST, SECOND], { customTimePeriod: null })
	})

	test('uses a reordered list as the synchronous source for the next mutation and save', async () => {
		const dispatch = vi.fn<(action: DashboardAction) => void>()
		const autoSave = vi.fn<(items: Array<DashboardItemConfig>) => void>()
		const rendered: { actions?: ReturnType<typeof useDashboardActions> } = {}

		function Harness() {
			rendered.actions = useDashboardActions(dispatch, dashboardState(), autoSave, false)
			return null
		}

		await act(async () => root.render(<Harness />))
		const actions = rendered.actions
		if (!actions) throw new Error('Expected dashboard actions to render')

		act(() => {
			actions.handleChartsReordered([SECOND, FIRST])
			actions.handleAppendItems(() => [{ id: 'third', kind: 'text', content: 'Third' }])
		})

		expect(autoSave).toHaveBeenCalledTimes(2)
		expect(autoSave.mock.calls[0]?.[0].map((item) => item.id)).toEqual(['second', 'first'])
		expect(autoSave.mock.calls[1]?.[0].map((item) => item.id)).toEqual(['second', 'first', 'third'])
	})

	test('duplicating a multi-chart preserves repeated series with distinct ids', async () => {
		const clock = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000)
		try {
			const multi: MultiChartConfig = {
				id: 'original-multi',
				kind: 'multi',
				items: [
					{ id: 'first-series', kind: 'chart', subjectType: 'chain', chain: 'Ethereum', type: 'tvl' },
					{ id: 'second-series', kind: 'chart', subjectType: 'chain', chain: 'Ethereum', type: 'tvl' }
				]
			}
			const autoSave = vi.fn<(items: Array<DashboardItemConfig>) => void>()
			const rendered: { actions?: ReturnType<typeof useDashboardActions> } = {}
			function Harness() {
				rendered.actions = useDashboardActions(vi.fn(), dashboardState(), autoSave, false)
				return null
			}
			await act(async () => root.render(<Harness />))
			act(() => rendered.actions!.handleDuplicateMultiChart(multi))
			const duplicate = autoSave.mock.calls[0][0].at(-1)
			if (duplicate?.kind !== 'multi') throw new Error('Expected a duplicated multi-chart')
			expect(duplicate.items).toHaveLength(2)
			expect(new Set(duplicate.items.map((item) => item.id)).size).toBe(2)
			for (const [index, item] of duplicate.items.entries()) {
				expect(item).toEqual({
					id: expect.any(String),
					kind: 'chart',
					subjectType: 'chain',
					chain: 'Ethereum',
					type: 'tvl'
				})
				expect(item.id).not.toBe(multi.items[index].id)
			}
		} finally {
			clock.mockRestore()
		}
	})

	test('duplicates a unified table with independent nested configuration and a fresh id', async () => {
		const dispatch = vi.fn<(action: DashboardAction) => void>()
		const autoSave = vi.fn<(items: Array<DashboardItemConfig>) => void>()
		const rendered: { actions?: ReturnType<typeof useDashboardActions> } = {}

		function Harness() {
			rendered.actions = useDashboardActions(dispatch, dashboardState(), autoSave, false)
			return null
		}

		await act(async () => root.render(<Harness />))
		const actions = rendered.actions
		if (!actions) throw new Error('Expected dashboard actions to render')

		act(() => actions.handleDuplicateUnifiedTable(UNIFIED_TABLE))

		const savedItems = autoSave.mock.calls[0]?.[0]
		const duplicate = savedItems?.at(-1)
		expect(duplicate).toMatchObject({ ...UNIFIED_TABLE, id: expect.any(String) })
		expect(duplicate?.id).not.toBe(UNIFIED_TABLE.id)
		if (duplicate?.kind !== 'unified-table') throw new Error('Expected a duplicated unified table')
		expect(duplicate.rowHeaders).not.toBe(UNIFIED_TABLE.rowHeaders)
		expect(duplicate.defaultSorting).not.toBe(UNIFIED_TABLE.defaultSorting)
		expect(duplicate.params).not.toBe(UNIFIED_TABLE.params)
		expect(duplicate.params?.chains).not.toBe(UNIFIED_TABLE.params?.chains)
		expect(duplicate.filters).not.toBe(UNIFIED_TABLE.filters)
		expect(duplicate.filters?.protocols).not.toBe(UNIFIED_TABLE.filters?.protocols)
		expect(duplicate.columnOrder).not.toBe(UNIFIED_TABLE.columnOrder)
		expect(duplicate.columnVisibility).not.toBe(UNIFIED_TABLE.columnVisibility)
		expect(duplicate.customColumns).not.toBe(UNIFIED_TABLE.customColumns)
		expect(duplicate.customColumns?.[0]).not.toBe(UNIFIED_TABLE.customColumns?.[0])
	})
})
