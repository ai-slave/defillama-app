// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { PageClockProvider } from '~/hooks/usePageClock'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { BridgesOverviewByChain } from '../BridgesOverviewByChain'

vi.mock('next/router', () => ({
	useRouter: () => ({ pathname: '/bridges/[chain]', asPath: '/bridges/ethereum', query: {}, push: vi.fn() })
}))
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))

const http = installFixtureFetch()

let unmount = () => {}
afterEach(() => unmount())

async function renderPage() {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	// The large transactions table links rows through the block explorer list.
	http.serve({ '/blockExplorers.json': [] })
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<PageClockProvider pageClockSec={Date.UTC(2026, 6, 14) / 1e3}>
					<BridgesOverviewByChain
						selectedChain="Ethereum"
						chains={['Ethereum']}
						filteredBridges={[]}
						messagingProtocols={[]}
						bridgeNames={[]}
						bridgeNameToChartDataIndex={{}}
						chartDataByBridge={[]}
						chainVolumeData={[]}
						rawBridgeVolumeData={[]}
						netflowsData={null}
						bridgeStatsCurrentDay={null}
						largeTxsData={[]}
					/>
				</PageClockProvider>
			</QueryClientProvider>
		)
	)
	unmount = () => {
		act(() => root.unmount())
		container.remove()
	}
	return container
}

test('the table tabs swap the bridges table for the large transactions table', async () => {
	const container = await renderPage()
	const tab = (name: string) =>
		[...container.querySelectorAll<HTMLElement>('[role="tab"]')].find((item) => item.textContent === name)!
	const panel = () => container.querySelector('[role="tabpanel"]:not([hidden])')!

	expect(container.querySelector('[role="tablist"]')!.getAttribute('aria-label')).toBe('Table view')
	expect(tab('Bridges').getAttribute('aria-selected')).toBe('true')
	expect(panel().textContent).not.toContain('Displaying 0 transactions')

	await act(async () => tab('Large Txs').click())
	expect(tab('Large Txs').getAttribute('aria-selected')).toBe('true')
	expect(panel().getAttribute('aria-labelledby')).toBe(tab('Large Txs').id)
	expect(panel().textContent).toContain('Displaying 0 transactions from the past 7d')
})
