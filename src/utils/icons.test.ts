import { describe, expect, it } from 'vitest'
import { geckoTokenIconUrl } from './icons'

describe('geckoTokenIconUrl', () => {
	it('uses the token icon service with a CoinGecko ID', () => {
		expect(geckoTokenIconUrl('coingecko:bitcoin', 20)).toBe(
			'https://token-icons.llamao.fi/icons/tokens/gecko/bitcoin?w=20&h=20'
		)
	})
})
