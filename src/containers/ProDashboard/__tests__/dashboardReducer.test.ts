import { expect, test } from 'vitest'
import { DASHBOARD_HISTORY_LIMIT, dashboardReducer, initDashboardState } from '../dashboardReducer'
import type { Dashboard } from '../dashboardTypes'
const original: Dashboard = {
	id: 'dashboard',
	data: { dashboardName: 'Original', items: [], timePeriod: '365d' },
	visibility: 'public',
	tags: ['defi'],
	description: 'Original description'
} as Dashboard

test('a background refresh retains local edits while accepting unchanged remote fields', () => {
	let state = initDashboardState({ dashboard: original })
	state = dashboardReducer(state, { type: 'SET_DASHBOARD_NAME', payload: 'Typing a new title' })
	state = dashboardReducer(state, { type: 'SET_ITEMS', payload: [{ id: 'new-text', kind: 'text', content: 'Notes' }] })
	const refreshed = { ...original, visibility: 'private' as const, description: 'Updated remotely' }
	const next = dashboardReducer(state, { type: 'APPLY_DASHBOARD', payload: refreshed })
	expect(next.dashboardName).toBe('Typing a new title')
	expect(next.items).toBe(state.items)
	expect(next.dashboardVisibility).toBe('private')
	expect(next.dashboardDescription).toBe('Updated remotely')
})

test('acknowledging a save preserves edits made after submission and accepts the next saved revision', () => {
	let state = initDashboardState({ dashboard: original })
	state = dashboardReducer(state, { type: 'SET_DASHBOARD_NAME', payload: 'First edit' })
	const submitted = state
	state = dashboardReducer(state, { type: 'SET_DASHBOARD_NAME', payload: 'Second edit' })
	const saved = { ...original, data: { ...original.data, dashboardName: 'First edit' } }
	state = dashboardReducer(state, { type: 'SAVE_DASHBOARD', submitted, payload: saved })
	expect(state.dashboardName).toBe('Second edit')
	expect(state.currentDashboard!.data.dashboardName).toBe('First edit')
	const secondSaved = { ...saved, data: { ...saved.data, dashboardName: 'Second edit' } }
	state = dashboardReducer(state, { type: 'SAVE_DASHBOARD', submitted: state, payload: secondSaved })
	expect(state.dashboardName).toBe('Second edit')
	expect(state.currentDashboard).toBe(secondSaved)
})

test('an old save does not replace another dashboard after navigation', () => {
	const submitted = initDashboardState({ dashboard: original })
	const nextDashboard = { ...original, id: 'another', data: { ...original.data, dashboardName: 'Another' } }
	const current = dashboardReducer(submitted, { type: 'APPLY_DASHBOARD', payload: nextDashboard })
	expect(dashboardReducer(current, { type: 'SAVE_DASHBOARD', submitted, payload: original })).toBe(current)
})

test('an autosave acknowledgement does not make equal array copies permanently dirty', () => {
	let state = initDashboardState({ dashboard: original })
	state = dashboardReducer(state, { type: 'SET_DASHBOARD_TAGS', payload: ['saved tag'] })
	state = dashboardReducer(state, { type: 'APPLY_DASHBOARD', payload: { ...original, tags: ['saved tag'] } })
	state = dashboardReducer(state, { type: 'APPLY_DASHBOARD', payload: { ...original, tags: ['remote tag'] } })
	expect(state.dashboardTags).toEqual(['remote tag'])
})

test('refreshes keep locally edited custom dates paired with the custom period', () => {
	const custom = {
		...original,
		data: {
			...original.data,
			timePeriod: 'custom' as const,
			customTimePeriod: { type: 'relative' as const, relativeDays: 10 }
		}
	}
	let state = initDashboardState({ dashboard: custom })
	state = dashboardReducer(state, { type: 'SET_CUSTOM_TIME_PERIOD', payload: { type: 'relative', relativeDays: 20 } })
	const refreshed = dashboardReducer(state, { type: 'APPLY_DASHBOARD', payload: original })
	expect(refreshed.timePeriod).toBe('custom')
	expect(refreshed.customTimePeriod).toEqual({ type: 'relative', relativeDays: 20 })
	const unchanged = dashboardReducer(initDashboardState({ dashboard: custom }), {
		type: 'APPLY_DASHBOARD',
		payload: original
	})
	expect(unchanged.timePeriod).toBe('365d')
	expect(unchanged.customTimePeriod).toBeNull()
})

test('a save response merges remote item changes with items added during the request', () => {
	const a = { id: 'a', kind: 'text' as const, content: 'A' }
	const b = { id: 'b', kind: 'text' as const, content: 'B' }
	const c = { id: 'c', kind: 'text' as const, content: 'C' }
	let state = initDashboardState({ dashboard: { ...original, data: { ...original.data, items: [a] } } })
	const submitted = state
	state = dashboardReducer(state, { type: 'SET_ITEMS', payload: [a, c] })
	const saved = { ...original, data: { ...original.data, items: [a, b] } }
	state = dashboardReducer(state, { type: 'SAVE_DASHBOARD', submitted, payload: saved })
	expect(state.items).toEqual([a, c, b])
})

const text = (id: string, content = id) => ({ id, kind: 'text' as const, content })
const chainVariable = (value: string) => ({ id: 'chain', kind: 'chain' as const, label: 'Chain', value })

test('SET_ITEMS pushes the previous snapshot to past and clears future', () => {
	let state = initDashboardState({ dashboard: original })
	state = dashboardReducer(state, { type: 'SET_ITEMS', payload: [text('a')] })
	expect(state.history).toEqual({ past: [{ items: [], variables: [] }], future: [] })
	state = dashboardReducer(state, { type: 'UNDO' })
	expect(state.items).toEqual([])
	expect(state.history.future).toEqual([{ items: [text('a')], variables: [] }])
	state = dashboardReducer(state, { type: 'SET_ITEMS', payload: [text('b')] })
	expect(state.history.future).toEqual([])
	expect(state.history.past).toEqual([{ items: [], variables: [] }])
})

test('UNDO and REDO restore items together with variables', () => {
	let state = initDashboardState({ dashboard: original })
	state = dashboardReducer(state, { type: 'SET_ITEMS', payload: [text('a')], variables: [chainVariable('Ethereum')] })
	state = dashboardReducer(state, { type: 'SET_VARIABLES', payload: [chainVariable('Solana')] })
	expect(state.history.past).toHaveLength(2)
	state = dashboardReducer(state, { type: 'UNDO' })
	expect(state.items).toEqual([text('a')])
	expect(state.variables).toEqual([chainVariable('Ethereum')])
	state = dashboardReducer(state, { type: 'UNDO' })
	expect(state.items).toEqual([])
	expect(state.variables).toEqual([])
	expect(dashboardReducer(state, { type: 'UNDO' })).toBe(state)
	state = dashboardReducer(state, { type: 'REDO' })
	expect(state.items).toEqual([text('a')])
	expect(state.variables).toEqual([chainVariable('Ethereum')])
	state = dashboardReducer(state, { type: 'REDO' })
	expect(state.variables).toEqual([chainVariable('Solana')])
	expect(state.history.future).toEqual([])
	expect(dashboardReducer(state, { type: 'REDO' })).toBe(state)
})

test('history keeps at most DASHBOARD_HISTORY_LIMIT snapshots and drops the oldest first', () => {
	let state = initDashboardState({ dashboard: original })
	for (let step = 1; step <= DASHBOARD_HISTORY_LIMIT + 10; step++) {
		state = dashboardReducer(state, { type: 'SET_ITEMS', payload: [text(String(step))] })
	}
	expect(state.history.past).toHaveLength(DASHBOARD_HISTORY_LIMIT)
	expect(state.history.past[0]!.items).toEqual([text('10')])
	expect(state.history.past.at(-1)!.items).toEqual([text(String(DASHBOARD_HISTORY_LIMIT + 9))])
})

test('skipHistory applies items and variables without recording a snapshot', () => {
	let state = initDashboardState({ dashboard: original })
	state = dashboardReducer(state, { type: 'SET_ITEMS', payload: [text('a')] })
	const history = state.history
	state = dashboardReducer(state, { type: 'SET_ITEMS', payload: [text('server')], skipHistory: true })
	expect(state.items).toEqual([text('server')])
	expect(state.history).toBe(history)
	state = dashboardReducer(state, { type: 'SET_VARIABLES', payload: [chainVariable('Base')], skipHistory: true })
	expect(state.variables).toEqual([chainVariable('Base')])
	expect(state.history).toBe(history)
	state = dashboardReducer(state, { type: 'CLEAR_HISTORY' })
	expect(state.history).toEqual({ past: [], future: [] })
})

test('setting identical items or variables adds no undo entry', () => {
	let state = initDashboardState({ dashboard: original })
	state = dashboardReducer(state, { type: 'SET_VARIABLES', payload: [chainVariable('Ethereum')] })
	state = dashboardReducer(state, { type: 'SET_ITEMS', payload: [text('a')] })
	const pastLength = state.history.past.length
	state = dashboardReducer(state, { type: 'SET_ITEMS', payload: state.items })
	state = dashboardReducer(state, { type: 'SET_VARIABLES', payload: state.variables })
	expect(state.history.past).toHaveLength(pastLength)
})

test('after a merged save acknowledgement, UNDO restores the snapshot taken before the local edit', () => {
	const a = text('a')
	const b = text('b')
	const c = text('c')
	let state = initDashboardState({ dashboard: { ...original, data: { ...original.data, items: [a] } } })
	const submitted = state
	state = dashboardReducer(state, { type: 'SET_ITEMS', payload: [a, c] })
	const saved = { ...original, data: { ...original.data, items: [a, b] } }
	state = dashboardReducer(state, { type: 'SAVE_DASHBOARD', submitted, payload: saved })
	expect(state.items).toEqual([a, c, b])
	expect(state.history.past).toEqual([{ items: [a], variables: [] }])
	state = dashboardReducer(state, { type: 'UNDO' })
	expect(state.items).toEqual([a])
	expect(state.history.future).toEqual([{ items: [a, c, b], variables: [] }])
	state = dashboardReducer(state, { type: 'REDO' })
	expect(state.items).toEqual([a, c, b])
})

test('reconcile keeps locally edited variables and annotations and adopts unchanged ones from the server', () => {
	const serverVariable = chainVariable('Arbitrum')
	const serverAnnotation = { id: 'server', date: '2026-01-01', label: 'Server note' }
	const refreshed = {
		...original,
		data: { ...original.data, variables: [serverVariable], annotations: [serverAnnotation] }
	}
	let edited = initDashboardState({ dashboard: original })
	edited = dashboardReducer(edited, { type: 'SET_VARIABLES', payload: [chainVariable('Solana')] })
	edited = dashboardReducer(edited, {
		type: 'SET_ANNOTATIONS',
		payload: [{ id: 'local', date: '2026-02-02', label: 'Local note' }]
	})
	const keptLocal = dashboardReducer(edited, { type: 'APPLY_DASHBOARD', payload: refreshed })
	expect(keptLocal.variables).toEqual([chainVariable('Solana')])
	expect(keptLocal.annotations).toEqual([{ id: 'local', date: '2026-02-02', label: 'Local note' }])
	const untouched = dashboardReducer(initDashboardState({ dashboard: original }), {
		type: 'APPLY_DASHBOARD',
		payload: refreshed
	})
	expect(untouched.variables).toEqual([serverVariable])
	expect(untouched.annotations).toEqual([serverAnnotation])
	const equalCopy = dashboardReducer(
		dashboardReducer(initDashboardState({ dashboard: original }), {
			type: 'SET_VARIABLES',
			payload: [{ ...serverVariable }]
		}),
		{ type: 'APPLY_DASHBOARD', payload: refreshed }
	)
	expect(equalCopy.variables).toEqual([serverVariable])
	expect(dashboardReducer(equalCopy, { type: 'APPLY_DASHBOARD', payload: original }).variables).toEqual([])
})

test('applying a different dashboard carries viewer overrides and resets history', () => {
	let state = initDashboardState({ dashboard: original })
	state = dashboardReducer(state, { type: 'SET_ITEMS', payload: [text('a')] })
	state = dashboardReducer(state, { type: 'SET_VARIABLE_OVERRIDES', payload: { chain: 'Solana' } })
	state = dashboardReducer(state, { type: 'SET_SHOW_GENERATE_DASHBOARD_MODAL', payload: true })
	expect(state.history.past).toHaveLength(1)
	const another = {
		...original,
		id: 'another',
		data: {
			...original.data,
			dashboardName: 'Another',
			items: [text('other')],
			variables: [chainVariable('Base')],
			annotations: [{ id: 'note', date: '2026-03-03', label: 'Launch' }]
		}
	}
	const next = dashboardReducer(state, { type: 'APPLY_DASHBOARD', payload: another })
	expect(next.dashboardId).toBe('another')
	expect(next.items).toEqual([text('other')])
	expect(next.variables).toEqual([chainVariable('Base')])
	expect(next.annotations).toEqual([{ id: 'note', date: '2026-03-03', label: 'Launch' }])
	expect(next.variableOverrides).toEqual({ chain: 'Solana' })
	expect(next.history).toEqual({ past: [], future: [] })
	expect(next.showGenerateDashboardModal).toBe(true)
	expect(dashboardReducer(next, { type: 'UNDO' })).toBe(next)
})
