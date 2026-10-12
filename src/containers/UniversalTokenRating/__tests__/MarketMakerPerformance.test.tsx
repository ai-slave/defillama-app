// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { installChartCanvas } from '~/utils/testing/chartCanvas'
import { MarketMakerPerformance } from '../MarketMakerPerformance'
import type { UtrMarketMakerBreakdownMetric, UtrMarketMakerPerformanceBreakdown } from '../types'

const router = vi.hoisted(() => ({
	pathname: '/universal-token-rating/token/[asset]',
	asPath: '/universal-token-rating/token/pyth-network',
	query: {} as Record<string, string>,
	push: vi.fn()
}))
vi.mock('next/router', () => ({ useRouter: () => router }))

/** A breakdown metric whose market makers' average is `marketMakers` dollars, so the panel shows which one it read. */
function metric(marketMakers: number): UtrMarketMakerBreakdownMetric {
	return {
		avgBreakdown: {
			marketMakers,
			allOthers: 1,
			total: marketMakers + 1,
			marketMakersPercentage: 50,
			allOthersPercentage: 50
		},
		dailyBreakdown: [],
		series: []
	}
}

describe('MarketMakerPerformance', () => {
	test('says the data is not disclosed when no provider data exists', () => {
		const html = renderToStaticMarkup(
			<MarketMakerPerformance
				metrics={null}
				providers={[]}
				breakdown={null}
				uptimeCalculations={[]}
				criteria={[]}
				onOpenCriterion={() => undefined}
			/>
		)

		expect(html).toContain('Data not disclosed')
		expect(html).not.toContain('Performance summary')
		// Without data the N/A insight cards stay hidden too.
		expect(html).not.toContain('Performance insights')
	})

	test('renders provider summary fields from the Forgd asset payload', () => {
		const html = renderToStaticMarkup(
			<MarketMakerPerformance
				metrics={null}
				providers={[
					{
						name: 'Keyrock',
						engagementType: 'retainer',
						avgSpread: 1.25,
						avgBidAskDepth50: 1000,
						avgBidAskDepth100: 2000,
						avgBidAskDepth200: 3000,
						avgFillVolumeTotal: 4000
					}
				]}
				breakdown={null}
				uptimeCalculations={[]}
				criteria={[]}
				onOpenCriterion={() => undefined}
			/>
		)

		expect(html).toContain('Performance summary')
		expect(html).toContain('Keyrock')
		expect(html).toContain('$1,000')
		expect(html).toContain('1 active market maker')
	})

	test('switches the uptime tables as tabs', async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		const container = document.createElement('div')
		document.body.appendChild(container)
		const root = createRoot(container)
		await act(async () =>
			root.render(
				<MarketMakerPerformance
					metrics={null}
					providers={[]}
					breakdown={null}
					uptimeCalculations={[
						{
							name: 'Keyrock',
							engagementType: 'retainer',
							uptimeObligation: 0.9,
							performance: { avgUptime: 0.95 },
							breakdown: [{ date: '2026-09-01T00:00:00Z', uptimeRatio: 0.97 }]
						}
					]}
					criteria={[]}
					onOpenCriterion={() => undefined}
				/>
			)
		)
		const tab = (name: string) =>
			[...container.querySelectorAll<HTMLElement>('[role="tab"]')].find((item) => item.textContent === name)!
		const panel = () => container.querySelector('[role="tabpanel"]:not([hidden])')!

		expect(container.querySelector('[role="tablist"]')!.getAttribute('aria-label')).toBe('Uptime view')
		expect(tab('Uptime Comparison').getAttribute('aria-selected')).toBe('true')
		expect(panel().textContent).toContain('Achieved')
		expect(panel().textContent).not.toContain('2026-09-01')

		await act(async () => tab('Uptime Breakdown').click())
		expect(tab('Uptime Breakdown').getAttribute('aria-selected')).toBe('true')
		expect(panel().getAttribute('aria-labelledby')).toBe(tab('Uptime Breakdown').id)
		expect(panel().textContent).toContain('2026-09-01')
		expect(panel().textContent).not.toContain('Combined uptime')

		await act(async () => root.unmount())
		container.remove()
	})

	test('the breakdown metric, side and depth band write to the URL and a link opens them', async () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		installChartCanvas()
		const breakdown: UtrMarketMakerPerformanceBreakdown = {
			depth: { bidAsk: { depth200: metric(200) }, bid: { depth100: metric(100) } },
			volume: { total: metric(300), maker: metric(400) }
		}
		const container = document.createElement('div')
		document.body.appendChild(container)
		let root = createRoot(container)
		const client = new QueryClient()
		// A fresh root per link, because the mock router cannot re-render the page the way Next's does.
		const open = async (query: Record<string, string>) => {
			await act(async () => root.unmount())
			root = createRoot(container)
			router.query = { asset: 'pyth-network', ...query }
			await act(async () =>
				root.render(
					<QueryClientProvider client={client}>
						<MarketMakerPerformance
							metrics={null}
							providers={[]}
							breakdown={breakdown}
							uptimeCalculations={[]}
							criteria={[]}
							onOpenCriterion={() => undefined}
						/>
					</QueryClientProvider>
				)
			)
		}
		const radio = (group: string, name: string) =>
			[...container.querySelectorAll<HTMLInputElement>(`[aria-label="${group}"] input[type="radio"]`)].find(
				(input) => accessibleName(input) === name
			)!
		const pushed = () => router.push.mock.lastCall![0].query

		await open({})
		expect(container.textContent).toContain('$200')

		await act(async () => radio('Order book side', 'Bid').click())
		expect(pushed()).toEqual({ side: 'bid' })
		await act(async () => radio('Depth band', '±1.00%').click())
		expect(pushed()).toEqual({ threshold: '1' })

		await open({ side: 'bid', threshold: '1' })
		expect(radio('Order book side', 'Bid').checked).toBe(true)
		expect(container.textContent).toContain('$100')

		// A metric switch drops the depth side, so Volume opens on its own default side.
		await act(async () => radio('Breakdown metric', 'Volume').click())
		expect(pushed()).toEqual({ threshold: '1', metric: 'volume' })

		await open({ metric: 'volume', side: 'maker' })
		expect(radio('Volume side', 'Maker').checked).toBe(true)
		expect(container.textContent).toContain('$400')

		await act(async () => root.unmount())
		container.remove()
	})
})
