// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardItemConfig } from './dashboardItemConfig'
import type { DashboardAction, DashboardState } from './dashboardReducer'
import type { TextConfig } from './types'
import { useDashboardActions } from './useDashboardActions'

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean
}

const FIRST: TextConfig = { id: 'first', kind: 'text', content: 'First' }
const SECOND: TextConfig = { id: 'second', kind: 'text', content: 'Second' }

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

	it('uses a reordered list as the synchronous source for the next mutation and save', async () => {
		const dispatch = vi.fn<(action: DashboardAction) => void>()
		const autoSave = vi.fn<(items: DashboardItemConfig[]) => void>()
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
})
