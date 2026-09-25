// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { DashboardItemConfig } from './dashboardItemConfig'
import type { DashboardAction, DashboardState } from './dashboardReducer'
import type { CustomDataConfig, MultiChartConfig, SectionConfig, TextConfig } from './types'
import type { UnifiedTableConfig } from './unifiedTable/config/current'
import { useDashboardActions } from './useDashboardActions'

const toast = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: toast }))

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

const OVERSIZED_CUSTOM_DATA: CustomDataConfig = {
	id: 'custom-data',
	kind: 'custom-data',
	name: 'Too big',
	columns: [{ name: 'value', type: 'VARCHAR' }],
	rows: Array.from({ length: 20_000 }, (_, index) => [`row-${index}-${'x'.repeat(40)}`]),
	chart: {
		chartType: 'bar',
		xCol: null,
		yCols: [],
		splitByCol: null,
		stackMode: 'off',
		rightAxisCols: [],
		seriesKinds: {},
		seriesColors: {},
		numberFormat: 'auto'
	},
	displayMode: 'table'
}

function dashboardState(overrides: Partial<DashboardState> = {}): DashboardState {
	return {
		items: [FIRST, SECOND],
		timePeriod: '365d',
		customTimePeriod: null,
		variables: [],
		annotations: [],
		variableOverrides: {},
		history: { past: [], future: [] },
		dashboardName: 'Dashboard',
		dashboardId: 'dashboard',
		currentDashboard: null,
		dashboardVisibility: 'private',
		dashboardTags: [],
		dashboardDescription: '',
		showGenerateDashboardModal: false,
		showIterateDashboardModal: false,
		...overrides
	}
}

describe('useDashboardActions', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		toast.error.mockClear()
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

	test('duplicates a unified table right after the original and reports the copy id', async () => {
		const { actions, autoSave } = await renderActions(dashboardState({ items: [UNIFIED_TABLE, FIRST, SECOND] }))

		let duplicateId: string | null | undefined
		act(() => {
			duplicateId = actions.handleDuplicateUnifiedTable(UNIFIED_TABLE)
		})

		const savedItems = autoSave.mock.calls[0]?.[0]
		expect(savedItems?.map((item) => item.id)).toEqual([UNIFIED_TABLE.id, duplicateId, FIRST.id, SECOND.id])
		expect(duplicateId).not.toBe(UNIFIED_TABLE.id)
		expect(savedItems?.[1]).toEqual({ ...UNIFIED_TABLE, id: duplicateId })
	})

	test('handleAddUnifiedTable keeps the parameter bindings chosen in the modal', async () => {
		const { actions, autoSave } = await renderActions()
		act(() => actions.handleAddUnifiedTable({ params: { chains: ['Ethereum'] }, bindings: { chains: 'chain' } }))
		const added = autoSave.mock.calls[0]?.[0]?.at(-1)
		expect(added).toMatchObject({
			kind: 'unified-table',
			params: { chains: ['Ethereum'] },
			bindings: { chains: 'chain' }
		})
	})

	async function renderActions(
		state: DashboardState = dashboardState(),
		requestedTabId: string | null = null,
		isReadOnlyUntilDashboardLoaded = false
	) {
		const dispatch = vi.fn<(action: DashboardAction) => void>()
		const autoSave = vi.fn<(items: Array<DashboardItemConfig>, overrides?: unknown) => void>()
		const rendered: { actions?: ReturnType<typeof useDashboardActions> } = {}
		function Harness() {
			rendered.actions = useDashboardActions(dispatch, state, autoSave, isReadOnlyUntilDashboardLoaded, requestedTabId)
			return null
		}
		await act(async () => root.render(<Harness />))
		const actions = rendered.actions
		if (!actions) throw new Error('Expected dashboard actions to render')
		return { actions, dispatch, autoSave }
	}

	test('appends new widgets to the end of the requested tab instead of the end of the document', async () => {
		const tabOne: SectionConfig = { id: 'tab-one', kind: 'section', title: 'One', displayAs: 'tab' }
		const tabTwo: SectionConfig = { id: 'tab-two', kind: 'section', title: 'Two', displayAs: 'tab' }
		const { actions, autoSave } = await renderActions(
			dashboardState({ items: [FIRST, tabOne, SECOND, tabTwo] }),
			'tab-one'
		)

		act(() => actions.handleAppendItems(() => [{ id: 'added', kind: 'text', content: 'Added' }]))
		expect(autoSave.mock.calls[0]?.[0].map((item) => item.id)).toEqual([
			'first',
			'tab-one',
			'second',
			'added',
			'tab-two'
		])

		act(() => actions.handleAddUnifiedTable(UNIFIED_TABLE))
		const withTable = autoSave.mock.calls[1]?.[0].map((item) => item.id)
		expect(withTable?.at(-1)).toBe('tab-two')
		expect(withTable?.[4]).toMatch(/^unified-table-/)
	})

	test('duplicates land right after their source and placement overrides the tab', async () => {
		const { actions, autoSave } = await renderActions(dashboardState({ items: [UNIFIED_TABLE, FIRST, SECOND] }))

		act(() => actions.handleDuplicateUnifiedTable(UNIFIED_TABLE))
		const duplicated = autoSave.mock.calls[0]?.[0]
		expect(duplicated?.[1]?.kind).toBe('unified-table')
		expect(duplicated?.map((item) => item.id).slice(2)).toEqual(['first', 'second'])

		act(() =>
			actions.handleAppendItems(() => [{ id: 'after-first', kind: 'text', content: 'After' }], { afterItemId: 'first' })
		)
		const afterPlacement = autoSave.mock.calls[1]?.[0].map((item) => item.id)
		expect(afterPlacement?.[1]).toMatch(/^unified-table-protocols-/)
		expect(afterPlacement?.slice(2)).toEqual(['first', 'after-first', 'second'])
	})

	test('an edit before the dashboard is ready is reported back instead of silently dropped', async () => {
		const { actions, autoSave } = await renderActions(dashboardState(), null, true)

		let appended: false | Array<string> | undefined
		let edited: boolean | undefined
		act(() => {
			appended = actions.handleAppendItems(() => [{ id: 'added', kind: 'text', content: 'Added' }])
			edited = actions.handleEditItem('first', { id: 'first', kind: 'text', content: 'Edited' })
		})
		expect(appended).toBe(false)
		expect(edited).toBe(false)
		expect(autoSave).not.toHaveBeenCalled()
	})

	test('an applied append reports the ids it added and an applied edit reports success', async () => {
		const { actions } = await renderActions()

		let appended: false | Array<string> | undefined
		let edited: boolean | undefined
		act(() => {
			appended = actions.handleAppendItems(() => [
				{ id: 'added', kind: 'text', content: 'Added' },
				{ id: 'added-too', kind: 'text', content: 'Added too' }
			])
			edited = actions.handleEditItem('first', { id: 'first', kind: 'text', content: 'Edited' })
		})
		expect(appended).toEqual(['added', 'added-too'])
		expect(edited).toBe(true)
	})

	test('an append rejected by the size limit reports false instead of ids', async () => {
		const { actions } = await renderActions()

		let appended: false | Array<string> | undefined
		act(() => {
			appended = actions.handleAppendItems(() => [OVERSIZED_CUSTOM_DATA])
		})
		expect(appended).toBe(false)
	})

	test('a beforeItemId placement drops the new cards above the anchor instead of into the tab', async () => {
		const tabOne: SectionConfig = { id: 'tab-one', kind: 'section', title: 'One', displayAs: 'tab' }
		const { actions, autoSave } = await renderActions(dashboardState({ items: [FIRST, tabOne, SECOND] }), 'tab-one')

		act(() =>
			actions.handleAppendItems(() => [{ id: 'shared', kind: 'text', content: 'Shared' }], { beforeItemId: 'tab-one' })
		)
		expect(autoSave.mock.calls[0]?.[0].map((item) => item.id)).toEqual(['first', 'shared', 'tab-one', 'second'])
	})

	test('refuses to append or edit a widget that would push the document over the size limit', async () => {
		const { actions, dispatch, autoSave } = await renderActions()

		act(() => actions.handleAppendItems(() => [OVERSIZED_CUSTOM_DATA]))
		expect(autoSave).not.toHaveBeenCalled()
		expect(dispatch).not.toHaveBeenCalled()
		expect(toast.error).toHaveBeenCalledOnce()
		expect(toast.error.mock.calls[0]?.[0]).toMatch(/^Dashboard is too large \(\d+ KB\)\. Remove rows or a card\.$/)

		act(() => actions.handleEditItem('first', { ...OVERSIZED_CUSTOM_DATA, id: 'first' }))
		expect(autoSave).not.toHaveBeenCalled()
		expect(dispatch).not.toHaveBeenCalled()
		expect(toast.error).toHaveBeenCalledTimes(2)

		act(() => actions.handleAppendItems(() => [{ id: 'third', kind: 'text', content: 'Small' }]))
		expect(autoSave).toHaveBeenCalledOnce()
		expect(toast.error).toHaveBeenCalledTimes(2)
	})

	test('undo dispatches UNDO and autosaves the restored snapshot with its variables', async () => {
		const restoredVariables = [{ id: 'chain', kind: 'chain' as const, label: 'Chain', value: 'Ethereum' }]
		const { actions, dispatch, autoSave } = await renderActions(
			dashboardState({ history: { past: [{ items: [FIRST], variables: restoredVariables }], future: [] } })
		)

		let undone = false
		act(() => {
			undone = actions.undo()
		})
		expect(undone).toBe(true)
		expect(dispatch).toHaveBeenLastCalledWith({ type: 'UNDO' })
		expect(autoSave).toHaveBeenLastCalledWith([FIRST], { variables: restoredVariables })

		let redone = false
		act(() => {
			redone = actions.redo()
		})
		expect(redone).toBe(true)
		expect(dispatch).toHaveBeenLastCalledWith({ type: 'REDO' })
		expect(autoSave).toHaveBeenLastCalledWith([FIRST, SECOND], { variables: [] })

		expect(actions.redo()).toBe(false)
	})

	test('setAnnotations dispatches and autosaves the current items with the annotations override', async () => {
		const { actions, dispatch, autoSave } = await renderActions()
		const annotations = [{ id: 'launch', date: '2026-03-01', label: 'Launch' }]

		act(() => actions.setAnnotations(annotations))
		expect(dispatch).toHaveBeenLastCalledWith({ type: 'SET_ANNOTATIONS', payload: annotations })
		expect(autoSave).toHaveBeenLastCalledWith([FIRST, SECOND], { annotations })
	})

	test('handleHeightChange stores a non-default height and removes the field for default', async () => {
		const { actions, autoSave } = await renderActions(dashboardState({ items: [{ ...FIRST, height: 'tall' }, SECOND] }))

		act(() => actions.handleHeightChange('second', 'compact'))
		expect(autoSave.mock.calls[0]?.[0]).toEqual([
			{ ...FIRST, height: 'tall' },
			{ ...SECOND, height: 'compact' }
		])

		act(() => actions.handleHeightChange('first', 'default'))
		expect(autoSave.mock.calls[1]?.[0]).toEqual([FIRST, { ...SECOND, height: 'compact' }])
		expect(autoSave.mock.calls[1]?.[0][0]).not.toHaveProperty('height')
	})
})
