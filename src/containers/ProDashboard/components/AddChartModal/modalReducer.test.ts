import { expect, test } from 'vitest'
import { initializeFromEditItem, modalReducer, resolveChartTypesForSubjectTab } from './modalReducer'

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
