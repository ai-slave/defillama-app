// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { V2_SERVER_URL } from '~/constants'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import { ChartGrid } from '../ChartGrid'

vi.mock('next/router', () => ({
	useRouter: () => ({ pathname: '/pro/[dashboardId]/[[...mode]]', asPath: '/pro/dashboard', query: {} })
}))
// The chart canvas is a heavy child; this test reads the card's series requests and that the canvas appears.
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => <div data-testid="chart-canvas" /> }))

const session = installSubscriberSession('owner', { resolved: true })
const items: Array<DashboardItemConfig> = [
	{ id: 'chart-1', kind: 'chart', type: 'newUsers', subjectType: 'chain', chain: 'Ethereum' }
]

let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	// Without an observer every card mounts at once, as it does on a browser that lacks one.
	vi.stubGlobal('IntersectionObserver', undefined)
	session.serve({ [`${V2_SERVER_URL}/chart/`]: [[1_789_516_800, 40]] })
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function renderWithReadiness(readyItemIds: ReadonlySet<string>) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardTestProvider
					mode="view"
					items={items}
					permissions={{ isReadOnly: true }}
					dashboard={{ dashboardId: 'dashboard' }}
					streamDone={false}
					readyItemIds={readyItemIds}
				>
					<ChartGrid onAddChartClick={vi.fn()} onEditItem={vi.fn()} />
				</DashboardTestProvider>
			</session.Wrapper>
		)
	)
}

test('a card loads its series only once its own id is stream-ready, without remounting', async () => {
	const card = () => container.querySelector('[data-item-id="chart-1"]')
	const seriesRequests = () =>
		session.requests.filter((request) => request.url.href.startsWith(`${V2_SERVER_URL}/chart/`))

	await renderWithReadiness(new Set())
	const firstCard = card()
	expect(seriesRequests()).toHaveLength(0)

	await renderWithReadiness(new Set(['other-item']))
	expect(card()).toBe(firstCard)
	expect(seriesRequests()).toHaveLength(0)

	await renderWithReadiness(new Set(['chart-1']))
	await waitForUi(() => expect(container.querySelector('[data-testid="chart-canvas"]')).not.toBeNull())
	expect(card()).toBe(firstCard)
	expect(seriesRequests()).toHaveLength(1)
})
