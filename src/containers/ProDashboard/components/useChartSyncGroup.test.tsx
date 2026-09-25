// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { DashboardTestProvider } from '~/utils/test/dashboardContext'
import { CHART_SYNC_STORAGE_KEY, useChartSyncGroup, useChartSyncPreference } from './useChartSyncGroup'

let container: HTMLDivElement
let root: Root
let latest: { syncGroup: string | undefined; enabled: boolean; toggle: () => void }

function Harness() {
	const { enabled, toggle } = useChartSyncPreference()
	latest = { syncGroup: useChartSyncGroup(), enabled, toggle }
	return null
}

const render = (dashboardId: string | null = 'dash-1') =>
	act(async () =>
		root.render(
			<DashboardTestProvider dashboard={{ dashboardId }}>
				<Harness />
			</DashboardTestProvider>
		)
	)
const flushStorageNotifications = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)))

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	window.localStorage.clear()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('defaults to a dashboard-scoped group', async () => {
	await render()
	expect(latest.enabled).toBe(true)
	expect(latest.syncGroup).toBe('pro-dashboard-dash-1')
})

test('returns undefined when the stored preference is off', async () => {
	window.localStorage.setItem(CHART_SYNC_STORAGE_KEY, 'off')
	await render()
	expect(latest.enabled).toBe(false)
	expect(latest.syncGroup).toBeUndefined()
})

test('returns undefined without a dashboard id even when enabled', async () => {
	await render(null)
	expect(latest.enabled).toBe(true)
	expect(latest.syncGroup).toBeUndefined()
})

test('toggle persists the preference and updates the group', async () => {
	await render()
	await act(async () => latest.toggle())
	await flushStorageNotifications()
	expect(window.localStorage.getItem(CHART_SYNC_STORAGE_KEY)).toBe('off')
	expect(latest.enabled).toBe(false)
	expect(latest.syncGroup).toBeUndefined()

	await act(async () => latest.toggle())
	await flushStorageNotifications()
	expect(window.localStorage.getItem(CHART_SYNC_STORAGE_KEY)).toBe('on')
	expect(latest.syncGroup).toBe('pro-dashboard-dash-1')
})
