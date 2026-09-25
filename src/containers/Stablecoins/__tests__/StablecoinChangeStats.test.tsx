import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { StablecoinChangeStats } from '../StablecoinChangeStats'

describe('StablecoinChangeStats', () => {
	test('renders only periods with both valid values', () => {
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

	test('hides the section when every change is invalid', () => {
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
})
