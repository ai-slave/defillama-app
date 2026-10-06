// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { ProtocolsUnifiedTableResponse } from '../../unifiedTable/contracts'
import { DemoPreview } from '../DemoPreview'

vi.mock('next/router', () => ({ useRouter: () => ({ asPath: '/pro/preview', pathname: '/pro/preview', query: {} }) }))
vi.mock('@tanstack/react-virtual', async (original) =>
	(await import('~/utils/testing/virtualLayout')).withVirtualLayout(await original())
)
// The chart canvases and text cards are heavy children nothing here reads; the card headings around them stay real.
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))
vi.mock('../TextCard', () => ({ TextCard: () => null }))

const session = installSubscriberSession('reader', { account: 'signed-out' })
const liveRows: ProtocolsUnifiedTableResponse = {
	strategy: 'protocols',
	rows: [
		{
			rowType: 'protocol',
			id: 'aave',
			name: 'aave',
			protocolId: 'aave',
			displayName: 'Aave',
			logo: '',
			category: 'Lending',
			chains: ['Ethereum'],
			oracles: [],
			parentProtocolId: null,
			parentProtocolName: null,
			parentProtocolLogo: null,
			metrics: { tvl: 100 },
			chain: null
		}
	],
	parentMetrics: {}
}

const follows = (earlier: Node, later: Node) =>
	(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING) === Node.DOCUMENT_POSITION_FOLLOWING

describe('DemoPreview', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		session.serve({ '/api/public/pro-dashboard/unified-table/protocols': liveRows })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		await act(async () =>
			root.render(
				<session.Wrapper>
					<DashboardTestProvider mode="view" permissions={{ isReadOnly: true }}>
						<DemoPreview />
					</DashboardTestProvider>
				</session.Wrapper>
			)
		)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('labels the sample charts as sample data and the live protocol table below them as live', async () => {
		const liveName = await waitForUi(() => {
			const name = [...container.querySelectorAll('*')].findLast((node) => node.textContent === 'Aave')
			if (!name) throw new Error('Expected the live Aave row')
			return name
		})
		const captions = Array.from(container.querySelectorAll('p'))
		const chartsCaption = captions.find((node) => node.textContent?.trim() === 'Sample charts use illustrative data')!
		const liveCaption = captions.find((node) => node.textContent?.trim() === 'Live data from DefiLlama')!
		const chartHeadings = [...container.querySelectorAll('h2')].filter((heading) => follows(chartsCaption, heading))
		expect(chartHeadings.length).toBeGreaterThan(0)
		expect(chartHeadings.every((heading) => follows(heading, liveCaption))).toBe(true)
		expect(follows(liveCaption, liveName)).toBe(true)
	})

	test('offers account creation that returns to the preview, and community dashboards', () => {
		const links = Array.from(container.querySelectorAll('a'))
		const createAccount = links.find((link) => link.textContent?.trim() === 'Create a free account')
		const discover = links.find((link) => link.textContent?.trim() === 'See community dashboards')
		expect(createAccount?.getAttribute('href')).toBe('/subscription?returnUrl=%2Fpro%2Fpreview')
		expect(discover?.getAttribute('href')).toBe('/pro?tab=discover')
	})
})
