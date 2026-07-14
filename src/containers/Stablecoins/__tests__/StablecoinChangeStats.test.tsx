import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataFreshness } from '~/ui/DataFreshness'
import { StablecoinChangeStats } from '../StablecoinChangeStats'

describe('StablecoinChangeStats', () => {
	it('renders only periods with both valid values', () => {
		const html = renderToStaticMarkup(
			<StablecoinChangeStats
				stats={[
					{ days: 7, percent: '+2.00', absolute: '+$2b' },
					{ days: 1, percent: null, absolute: null },
					{ days: 30, percent: '-1.00', absolute: '-$1b' }
				]}
			/>
		)

		expect(html).toContain('Change (7d)')
		expect(html).not.toContain('Change (1d)')
		expect(html).toContain('Change (30d)')
	})

	it('hides the section when every change is invalid', () => {
		const html = renderToStaticMarkup(
			<StablecoinChangeStats
				stats={[
					{ days: 7, percent: null, absolute: null },
					{ days: 1, percent: null, absolute: null },
					{ days: 30, percent: null, absolute: null }
				]}
			/>
		)

		expect(html).toBe('')
	})

	it('explains which metric is stale', () => {
		const html = renderToStaticMarkup(
			<DataFreshness timestamp={Date.parse('2026-05-15T00:00:00Z') / 1e3} label="Market cap data last updated" />
		)

		expect(html).toContain('Market cap data last updated May 15, 2026')
	})
})
