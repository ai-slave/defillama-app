// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { accessibleName } from '~/utils/testing/accessibleName'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { alertTexts } from '~/utils/testing/fieldErrors'
import { fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { ChartConfig } from '../../types'
import { ChartCard } from '../ChartCard'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/example' }) }))
// The chart canvas is a heavy child; these tests assert only the card around it.
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))

const http = installSubscriberSession('u1', { resolved: true })
let container: HTMLDivElement
let root: Root
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test.each([
	['activeUsers', 'week', 'Ethereum Active Addresses (daily average)', false],
	['newUsers', 'day', 'Ethereum New Addresses', true]
] as const)(
	'a saved cumulative %s card at %s grouping is titled %s and offers cumulative: %s',
	async (type, grouping, title, offersCumulative) => {
		http.serve({ [`${V2_SERVER_URL}/chart/`]: [[1_789_516_800, 40]] })
		const chart: ChartConfig = {
			id: 'c',
			kind: 'chart',
			subjectType: 'chain',
			chain: 'Ethereum',
			type,
			grouping,
			showCumulative: true
		}
		await act(async () =>
			root.render(
				<http.Wrapper>
					<DashboardTestProvider
						time={{ timePeriod: 'all' }}
						permissions={{ hideDuplicateButton: true }}
						editorActions={{ handleGroupingChange: vi.fn(), handleCumulativeChange: vi.fn() }}
					>
						<ChartCard chart={chart} />
					</DashboardTestProvider>
				</http.Wrapper>
			)
		)

		await waitForUi(() => expect(container.querySelector('[aria-label="More actions"]')).not.toBeNull())
		expect(container.textContent).toContain(title)
		// The control's label reads Cumulative or Individual; a metric without it shows neither.
		expect(/Cumulative|Individual/.test(container.textContent!)).toBe(offersCumulative)
	}
)

test('a chart that failed to load keeps its error while Try again reads it, then hands focus to its card', async () => {
	const read = Promise.withResolvers<Response>()
	http.serveInOrder(`${V2_SERVER_URL}/chart/`, [fixtureStatus(404), () => read.promise])
	const chart: ChartConfig = { id: 'c', kind: 'chart', subjectType: 'chain', chain: 'Ethereum', type: 'newUsers' }
	await act(async () =>
		root.render(
			<http.Wrapper>
				<DashboardTestProvider time={{ timePeriod: 'all' }} permissions={{ hideDuplicateButton: true }}>
					{/* The dashboard grid's card shell: a focus region its controls hand focus to when they leave. */}
					<div data-testid="card" tabIndex={-1}>
						<ChartCard chart={chart} />
					</div>
				</DashboardTestProvider>
			</http.Wrapper>
		)
	)
	const retry = await waitForUi(() => {
		const button = [...container.querySelectorAll('button')].find((element) => element.textContent === 'Try again')
		if (!button) throw new Error('Missing Try again')
		return button
	})
	await act(async () => {
		retry.focus()
		retry.click()
	})
	await waitForUi(() => expect(accessibleName(retry)).toBe('Retrying…'))
	expect(alertTexts(container)).toHaveLength(1)
	expect(document.activeElement).toBe(retry)

	await act(async () => read.resolve(Response.json([[1_789_516_800, 40]])))
	await waitForUi(() => expect(container.querySelector('[role="alert"]')).toBeNull())
	await waitForUi(() => expect(document.activeElement).toBe(container.querySelector('[data-testid="card"]')))
})
