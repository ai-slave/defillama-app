// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { MetricConfig } from '../types'
import { MetricCard } from './MetricCard'

const mocks = vi.hoisted(() => ({
	permissions: { isReadOnly: true, hideDuplicateButton: true },
	metricData: {
		value: 1_500_000_000,
		delta: null as number | null,
		deltaPct: 12.5 as number | null,
		sparklineData: [] as Array<[number, number]>,
		lastUpdatedTs: null,
		isLoading: false,
		isError: false,
		refetch: vi.fn()
	}
}))
vi.mock('../hooks/useMetricData', () => ({ useMetricData: () => mocks.metricData }))
vi.mock('../ProDashboardAPIContext', () => ({
	useProDashboardCatalog: () => ({ getChainInfo: () => null, getProtocolInfo: () => null }),
	useProDashboardPermissions: () => mocks.permissions,
	useProDashboardDashboard: () => ({ currentDashboard: null }),
	useProDashboardItemsState: () => ({ items: [] }),
	useProDashboardVariables: () => ({ variables: [] })
}))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({
		isAuthenticated: true,
		hasActiveSubscription: true,
		isTrial: false,
		loaders: { userLoading: false }
	})
}))
vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test' }) }))
vi.mock('~/components/ChartExport/useChartPngExport', () => ({
	useChartPngExport: () => ({ isExporting: false, downloadImage: vi.fn(), copyImage: vi.fn() })
}))

const metric: MetricConfig = {
	id: 'metric-1',
	kind: 'metric',
	subject: { itemType: 'chain', chain: 'Ethereum' },
	type: 'tvl',
	aggregator: 'avg',
	window: '7d',
	chartType: 'none'
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	mocks.permissions.isReadOnly = true
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('the window and the aggregator stay in the subtitle in read-only', async () => {
	await act(async () => root.render(<MetricCard metric={metric} />))
	expect(container.textContent).toContain('Last 7d')
	expect(container.textContent).toContain('Average')
})

test('the delta renders as a badge that carries its direction', async () => {
	await act(async () => root.render(<MetricCard metric={metric} />))
	const badgeText = () =>
		Array.from(container.querySelectorAll('span'), (node) => node.textContent).find(
			(text) => text?.startsWith('▲') || text?.startsWith('▼')
		)
	expect(badgeText()).toBe('▲+12.50%')

	mocks.metricData.deltaPct = -4
	await act(async () => root.render(<MetricCard metric={{ ...metric, id: 'metric-2' }} />))
	expect(badgeText()).toBe('▼-4.00%')
	expect(container.textContent).not.toContain('▲')
})
