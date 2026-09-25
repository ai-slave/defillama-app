// @vitest-environment happy-dom
import { afterEach, expect, test } from 'vitest'
import { CHART_MODE_STORAGE_KEY, readPreferredChartMode, writePreferredChartMode } from '../chartModePreference'
afterEach(() => localStorage.clear())
test('uses manual for missing or invalid preferences and remembers builder', () => {
	expect(readPreferredChartMode()).toBe('manual')
	localStorage.setItem(CHART_MODE_STORAGE_KEY, 'invalid')
	expect(readPreferredChartMode()).toBe('manual')
	writePreferredChartMode('builder')
	expect(readPreferredChartMode()).toBe('builder')
})
