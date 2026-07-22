import { describe, expect, it } from 'vitest'
import { getDashboardHydrationState } from '../../dashboardHydrationState'
import type { ChartConfig } from '../../types'
import { isComposerItemQueryEnabled } from './useComposerItemsData'

describe('Add Chart composer query gate', () => {
	it('enables live previews immediately for a new dashboard', () => {
		const hydration = getDashboardHydrationState({
			hasDashboardId: false,
			hasInitialDashboard: false,
			authReady: false,
			streamIsDone: false,
			hasStreamDashboard: false,
			mode: 'edit'
		})
		const item = {
			id: 'preview',
			kind: 'chart',
			protocol: 'aave',
			type: 'fees'
		} as ChartConfig

		expect(hydration.streamDone).toBe(true)
		expect(isComposerItemQueryEnabled(hydration.streamDone, item)).toBe(true)
	})
})
