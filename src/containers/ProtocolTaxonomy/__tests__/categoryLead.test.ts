import { describe, expect, test } from 'vitest'
import { categoryIntro } from '../categoryLead'

const DATE = Date.UTC(2026, 9, 14) / 1000

describe('categoryIntro', () => {
	test('names the three largest categories', () => {
		expect(
			categoryIntro(DATE, [
				{ name: 'Lending', tvl: 53.1e9 },
				{ name: 'Liquid Staking', tvl: 56.8e9 },
				{ name: 'Bridges', tvl: 58.7e9 }
			])
		).toBe(
			'DeFi categories are groups of protocols that do the same job. On Oct 14, 2026 Bridges led with $58.7b, then Liquid Staking at $56.8b and Lending at $53.1b.'
		)
	})
})
