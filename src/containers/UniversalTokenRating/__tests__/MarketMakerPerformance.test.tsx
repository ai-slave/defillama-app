// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { MarketMakerPerformance } from '../MarketMakerPerformance'

// The provider picker is the shared Select, which reads the router.
vi.mock('next/router', () => ({ useRouter: () => ({ query: {} }) }))

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
})
