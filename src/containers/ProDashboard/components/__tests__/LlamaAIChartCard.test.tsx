// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import { accessibleName } from '~/utils/testing/accessibleName'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { alertTexts } from '~/utils/testing/fieldErrors'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { LlamaAIChartConfig } from '../../types'
import LlamaAIChartCard from '../LlamaAIChartCard'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/dash', query: {}, push: vi.fn() }) }))
// The chart canvas is a heavy child; these tests assert only the card and its refresh.
vi.mock('~/containers/LlamaAI/components/charts/ChartRenderer', () => ({ ChartRenderer: () => null }))

const session = installSubscriberSession('owner', { resolved: true })

const premiumChart: LlamaAIChartConfig = {
	id: 'item',
	kind: 'llamaai-chart',
	artifactId: 'artifact',
	artifactStatus: 'live',
	artifactContainsPremium: true,
	artifactEstimatedMaxCostUsd: 0.005,
	title: 'Premium fees'
}
const refreshUrl = `${AI_SERVER}/chart-artifacts/artifact/refresh`
const chartUrl = `${AI_SERVER}/chart-artifacts/dashboards/dash/items/item`
const liveChart = { title: 'Premium fees', status: 'live', refreshAvailable: true, chartData: [] }

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

const button = (text: string) => [...document.querySelectorAll('button')].find((el) => el.textContent === text)!
const confirmation = () => document.querySelector<HTMLElement>('[role="dialog"]')
const refreshes = () => session.requests.filter((request) => request.url.href === refreshUrl)
// The dashboard grid's card shell: a focus region its controls hand focus to when they leave.
const card = () => document.querySelector<HTMLElement>('[data-testid="card"]')!

async function renderCard(refreshAnswers: Array<unknown>) {
	session.serve({ [chartUrl]: liveChart })
	session.serveInOrder(refreshUrl, refreshAnswers)
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardTestProvider dashboard={{ dashboardId: 'dash' }} permissions={{ dashboardOwnerId: 'owner' }}>
					<div data-testid="card" tabIndex={-1}>
						<LlamaAIChartCard config={premiumChart} />
					</div>
				</DashboardTestProvider>
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(button('Refresh')).toBeDefined())
	const refresh = button('Refresh')
	await act(async () => {
		refresh.focus()
		refresh.click()
	})
	await waitForUi(() => expect(confirmation()?.querySelector('h2')?.textContent).toBe('Refresh with premium data?'))
	return refresh
}

test('a premium refresh states its cost first, and Cancel sends nothing and returns to Refresh', async () => {
	const refresh = await renderCard([])
	expect(confirmation()!.textContent).toContain('This refresh may charge up to $0.005 to your External Data Balance.')

	await act(async () => button('Cancel').click())
	await waitForUi(() => expect(confirmation()).toBeNull())
	expect(refreshes()).toEqual([])
	expect(document.activeElement).toBe(refresh)
})

test('a confirmed refresh waits in its button, explains a failure inside the dialog, and closes once queued', async () => {
	const queueing = Promise.withResolvers<Response>()
	const refresh = await renderCard([() => queueing.promise, { queued: true }])

	await act(async () => confirmation()!.querySelectorAll('button')[1]!.click())
	await waitForUi(() =>
		expect(confirmation()!.querySelector('[aria-busy="true"]')?.textContent).toContain('Refreshing…')
	)
	await act(async () => queueing.resolve(fixtureStatus(503)()))
	await waitForUi(() => expect(alertTexts(confirmation()!)).toHaveLength(1))
	// The failure belongs to the open dialog, not to the card behind it.
	expect(container.querySelector('[role="alert"]')).toBeNull()

	await act(async () => confirmation()!.querySelectorAll('button')[1]!.click())
	await waitForUi(() => expect(confirmation()).toBeNull())
	expect(refreshes()).toHaveLength(2)
	expect(container.querySelector('[role="alert"]')).toBeNull()
	await waitForUi(() => expect(document.activeElement).toBe(refresh))
})

test('an accepted refresh whose chart read fails closes as queued, keeps the chart, and retries only the read', async () => {
	const refresh = await renderCard([{ queued: true }])
	session.serveInOrder(chartUrl, [fixtureStatus(503), liveChart])

	await act(async () => confirmation()!.querySelectorAll('button')[1]!.click())
	await waitForUi(() => expect(confirmation()).toBeNull())
	expect(container.querySelector('h3')?.textContent).toBe('Premium fees')
	// A failed read is a notice over the kept chart that retries it, not an alert in its place.
	const notice = container.querySelector('[role="status"]')!
	expect(accessibleName(notice.querySelector('button')!)).toBe('Try again')
	expect(container.querySelector('[role="alert"]')).toBeNull()
	await waitForUi(() => expect(document.activeElement).toBe(refresh))

	await act(async () => button('Try again').click())
	await waitForUi(() => expect(container.querySelector('[role="status"]')).toBeNull())
	expect(session.urls().filter((url) => url === chartUrl)).toHaveLength(3)
	expect(refreshes()).toHaveLength(1)
})

test('a read retry after an accepted refresh waits in its focused button, then hands focus to the card', async () => {
	const refresh = await renderCard([{ queued: true }])
	const retryRead = Promise.withResolvers<Response>()
	session.serveInOrder(chartUrl, [fixtureStatus(503), () => retryRead.promise])

	await act(async () => confirmation()!.querySelectorAll('button')[1]!.click())
	await waitForUi(() => expect(document.activeElement).toBe(refresh))
	const retry = button('Try again')
	await act(async () => {
		retry.focus()
		retry.click()
	})
	await waitForUi(() => expect(accessibleName(retry)).toBe('Retrying…'))
	expect(retry.getAttribute('aria-busy')).toBe('true')
	expect(document.activeElement).toBe(retry)

	await act(async () => retryRead.resolve(Response.json(liveChart)))
	await waitForUi(() => expect(container.querySelector('[role="status"]')).toBeNull())
	await waitForUi(() => expect(document.activeElement).toBe(card()))
	expect(refreshes()).toHaveLength(1)
})

test('a chart that fails after it was saved keeps its snapshot and offers the owner a regenerate', async () => {
	session.serve({
		[`${AI_SERVER}/chart-artifacts/dashboards/dash/items/item`]: {
			title: 'Premium fees',
			status: 'needs-repair',
			chartData: []
		}
	})
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardTestProvider dashboard={{ dashboardId: 'dash' }} permissions={{ dashboardOwnerId: 'owner' }}>
					<LlamaAIChartCard config={premiumChart} />
				</DashboardTestProvider>
			</session.Wrapper>
		)
	)
	await waitForUi(() =>
		expect(container.textContent).toContain(
			'This chart can no longer refresh. The last published snapshot is shown.Regenerate chart'
		)
	)
})
