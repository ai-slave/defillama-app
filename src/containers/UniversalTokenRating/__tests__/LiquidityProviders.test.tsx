import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { LpPerformanceInsights } from '../LiquidityProviders'
import { marketMakerCriterionRawPercent } from '../units'

describe('liquidity provider percentage units', () => {
	test('converts Forgd criterion raw basis points into percentage values', () => {
		expect(marketMakerCriterionRawPercent(47.97)).toBeCloseTo(0.4797)
		expect(marketMakerCriterionRawPercent(2723.93)).toBeCloseTo(27.2393)
		expect(marketMakerCriterionRawPercent(null)).toBeNull()
	})

	test('keeps snapshot percentage metrics on their existing scale', () => {
		const html = renderToStaticMarkup(
			<LpPerformanceInsights mmDepthPct={27.2393} mmVolumePct={0.4797} avgSpreadPct={0.2966} />
		)

		expect(html).toContain('27.24%')
		expect(html).toContain('0.48%')
		expect(html).toContain('0.30%')
	})
})
