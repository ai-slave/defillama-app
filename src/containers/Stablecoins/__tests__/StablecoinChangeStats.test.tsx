import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { StablecoinChangeStats } from '../StablecoinChangeStats'

describe('StablecoinChangeStats', () => {
	test('puts the 7d change beside the headline and the other periods in rows', () => {
		const html = renderToStaticMarkup(
			<StablecoinChangeStats
				label="Total Stablecoins Market Cap"
				value="$300b"
				changes={{
					change1d: null,
					change7d: 2,
					change30d: -1,
					change1dUsd: null,
					change7dUsd: 2_000_000_000,
					change30dUsd: -1_000_000_000
				}}
			/>
		)

		expect(html).toContain('$300b')
		expect(html).toContain('+2.00%')
		expect(html).toContain('over 7d')
		expect(html).not.toContain('Change (1d)')
		expect(html).toContain('Change (30d)')
		expect(html).toContain('-1.00%')
	})

	test('shows only the headline when there are no changes', () => {
		const html = renderToStaticMarkup(<StablecoinChangeStats label="Total" value="$300b" changes={null} />)

		expect(html).toContain('$300b')
		expect(html).not.toContain('over 7d')
		expect(html).not.toContain('Change (')
	})
})
