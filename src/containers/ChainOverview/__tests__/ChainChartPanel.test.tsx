// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { ChainChartPanel } from '../ChainChartPanel'
import type { ChainChartLabels } from '../constants'
import type { IChainOverviewData } from '../types'

vi.mock('next/router', () => ({
	useRouter: () => ({ query: {}, asPath: '/chain/ethereum', pathname: '/chain/[chain]', push: vi.fn() })
}))

const session = installSubscriberSession('reader', { account: 'signed-out' })
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

async function renderPanel(
	charts: Array<ChainChartLabels>,
	{
		toggledCharts = [],
		loadingCharts = []
	}: { toggledCharts?: Array<ChainChartLabels>; loadingCharts?: Array<string> } = {}
) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<ChainChartPanel
					charts={charts}
					chainTokenInfo={null}
					metadata={{ name: 'Ethereum' } as IChainOverviewData['metadata']}
					chain="Ethereum"
					toggledCharts={toggledCharts}
					denominations={['USD']}
					denomination="USD"
					hasBarChart={false}
					groupBy="daily"
					chainGeckoId={null}
					finalCharts={{}}
					valueSymbol="$"
					loadingCharts={loadingCharts}
					failedMetrics={[]}
					darkMode={false}
				/>
			</session.Wrapper>
		)
	)
}

function buttonNames() {
	return [...document.querySelectorAll('button')].map(accessibleName)
}

function statuses() {
	return [...document.querySelectorAll('[role="status"]')].map((el) => el.textContent)
}

test('asks for a metric instead of drawing an empty chart when every metric is removed', async () => {
	await renderPanel(['TVL', 'Stablecoins Mcap'])
	expect(statuses()).toContain('Pick metrics to plot')
})

test('says the chain has no chart data when it has no metrics to pick', async () => {
	await renderPanel([])
	expect(statuses()).toContain('No chart data for this chain')
})

test('offers no export or embed while nothing is plotted', async () => {
	await renderPanel(['TVL', 'Stablecoins Mcap'])
	expect(buttonNames().filter((name) => ['.csv', '.png', 'Embed chart'].includes(name))).toEqual([])
})

test('offers export and embed once a metric is plotted', async () => {
	// Fetching keeps the chart itself out of the render; the toolbar is what this test observes.
	await renderPanel(['TVL', 'Stablecoins Mcap'], { toggledCharts: ['TVL'], loadingCharts: ['TVL'] })
	expect(buttonNames().filter((name) => ['.csv', '.png', 'Embed chart'].includes(name))).toEqual([
		'Embed chart',
		'.csv',
		'.png'
	])
})

test('marks the chip of a metric that is still loading', async () => {
	await renderPanel(['TVL', 'Stablecoins Mcap'], {
		toggledCharts: ['TVL', 'Stablecoins Mcap'],
		loadingCharts: ['Stablecoins Mcap']
	})
	const loading = [...container.querySelectorAll('[role="status"][aria-label$="is loading"]')]
	expect(loading.map((status) => status.getAttribute('aria-label'))).toEqual(['Stablecoins Mcap is loading'])
})
