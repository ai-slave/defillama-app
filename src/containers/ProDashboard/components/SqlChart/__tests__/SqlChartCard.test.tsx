// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { defaultChartConfig } from '~/containers/Downloads/sql/chartConfig'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { SqlChartConfig, SqlSnapshot } from '../../../types'
import { scaledPx } from '../../cardHeightContext'
import { SqlChartCard, sqlCardBody } from '../SqlChartCard'
import { getSqlRefreshProgress, refreshAllSqlCharts } from '../sqlRefreshBus'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, asPath: '/pro/d1', push: vi.fn() }) }))

const noResult = {
	hasResult: false,
	isRefreshing: false,
	canRefresh: true,
	displayMode: 'chart',
	hasNumeric: false
} as const

test('a query without a result offers its editor a run and tells a viewer the owner has not run it', () => {
	expect(sqlCardBody(noResult)).toBe('not-run')
	expect(sqlCardBody({ ...noResult, canRefresh: false })).toBe('owner-not-run')
	expect(sqlCardBody({ ...noResult, isRefreshing: true })).toBe('loading')
})

test('a result shows as the chosen display, and a chart needs a numeric column', () => {
	const withResult = { ...noResult, hasResult: true, isRefreshing: true }
	expect(sqlCardBody({ ...withResult, hasNumeric: true })).toBe('chart')
	expect(sqlCardBody(withResult)).toBe('no-numeric')
	expect(sqlCardBody({ ...withResult, displayMode: 'table' })).toBe('table')
})

test('a card height scale resizes the chart to whole pixels', () => {
	expect(scaledPx(420, 1)).toBe('420px')
	expect(scaledPx(333, 0.75)).toBe('250px')
})

const session = installSubscriberSession('u1', { resolved: true })
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const item: SqlChartConfig = {
	id: 'sql',
	kind: 'sql',
	name: 'Query',
	chart: defaultChartConfig([]),
	query: { sql: "SELECT 'a' AS label", tableSources: [] }
}
const stored: SqlSnapshot = {
	columns: [{ name: 'label', type: 'VARCHAR' }],
	rows: [['a']],
	computedAt: '2024-01-01T00:00:00.000Z',
	rowCount: 1,
	engine: 'server'
}

test('a failed refresh keeps the stored result, hides the raw error, and Try again forces a server re-run', async () => {
	session.serveInOrder('/api/private/pro-dashboard/sql-run', [{ ...stored, error: 'SQL run failed' }, stored])
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardTestProvider dashboard={{ dashboardId: 'd1' }}>
					<SqlChartCard config={item} />
				</DashboardTestProvider>
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(document.querySelector('[role="alert"]')).not.toBeNull(), { timeout: 1000 })
	const alert = document.querySelector('[role="alert"]')!
	expect(alert.textContent).toContain("Couldn't refresh this query.")
	expect(alert.textContent).not.toContain('SQL run failed')
	expect(alert.getAttribute('title')).toBe('SQL run failed')
	expect(document.body.textContent).toContain('No numeric columns in this result to chart.')

	await act(async () =>
		[...document.querySelectorAll<HTMLButtonElement>('button')]
			.find((b) => b.textContent?.trim() === 'Try again')!
			.click()
	)
	await waitForUi(() => expect(document.querySelector('[role="alert"]')).toBeNull(), { timeout: 1000 })
	expect(session.urls().filter((url) => url.includes('sql-run'))).toEqual([
		'http://localhost:3000/api/private/pro-dashboard/sql-run?dashboardId=d1&itemId=sql',
		'http://localhost:3000/api/private/pro-dashboard/sql-run?dashboardId=d1&itemId=sql&refresh=1'
	])
})

test('refresh all re-runs the card on the server and counts the failure its answer reports', async () => {
	const failedRun = Promise.withResolvers<SqlSnapshot & { error: string }>()
	session.serveInOrder('/api/private/pro-dashboard/sql-run', [stored, () => failedRun.promise])
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardTestProvider dashboard={{ dashboardId: 'd1' }}>
					<SqlChartCard config={item} />
				</DashboardTestProvider>
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(getSqlRefreshProgress()).toMatchObject({ active: 0, failed: 0 }))

	await act(async () => refreshAllSqlCharts())
	expect(session.urls().at(-1)).toBe(
		'http://localhost:3000/api/private/pro-dashboard/sql-run?dashboardId=d1&itemId=sql&refresh=1'
	)
	await waitForUi(() => expect(getSqlRefreshProgress()).toMatchObject({ active: 1, total: 1, bulk: true }))
	await act(async () => failedRun.resolve({ ...stored, error: 'SQL run failed' }))
	await waitForUi(() => expect(getSqlRefreshProgress()).toMatchObject({ active: 0, total: 1, failed: 1 }))
})
