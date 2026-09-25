import { describe, expect, test } from 'vitest'
import { cryptoCardIconUrl, geckoTokenIconUrl } from '../icons'

describe('cryptoCardIconUrl', () => {
	test('uses the crypto card icon service category with a card id', () => {
		expect(cryptoCardIconUrl('Coinbase-One', 20)).toBe(
			'https://icons.llamao.fi/icons/crypto-cards/coinbase-one?w=20&h=20'
		)
	})
})

describe('geckoTokenIconUrl', () => {
	test('uses the token icon service with a CoinGecko ID', () => {
		expect(geckoTokenIconUrl('coingecko:bitcoin', 20)).toBe(
			'https://token-icons.llamao.fi/icons/tokens/gecko/bitcoin?w=20&h=20'
		)
	})
})
