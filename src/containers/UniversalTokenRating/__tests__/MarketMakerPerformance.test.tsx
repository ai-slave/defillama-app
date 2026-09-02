import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MarketMakerPerformance } from '../MarketMakerPerformance'

describe('MarketMakerPerformance', () => {
	it('keeps the liquidity provider section and score cards visible without data', () => {
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

		expect(html).toContain('Performance Overview: Liquidity Providers')
		expect(html).toContain('Data not disclosed')
		expect(html).toContain('Market Maker Volume')
		expect(html).toContain('Market Maker Depth')
		expect(html).toContain('Market Maker Uptime / KPI Adherence')
	})

	it('renders provider summary fields from the Forgd asset payload', () => {
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

		expect(html).toContain('Performance Summary')
		expect(html).toContain('Keyrock')
		expect(html).toContain('$1,000')
		expect(html).toContain('1 active market maker')
	})
})
