import { expect, test } from 'vitest'
import { dashboardReducer, initDashboardState } from './dashboardReducer'
import type { Dashboard } from './dashboardTypes'
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
