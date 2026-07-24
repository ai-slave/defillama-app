import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchHacks } from './api'

const fetchJsonMock = vi.hoisted(() => vi.fn())

vi.mock('~/utils/async', () => ({ fetchJson: fetchJsonMock }))

describe('Hacks API', () => {
	beforeEach(() => {
		fetchJsonMock.mockReset()
	})

	it('keeps amounts in whole USD and gives them explicit domain names', async () => {
		fetchJsonMock.mockResolvedValue([
			{
				date: 1_740_096_000,
				name: 'Bybit',
				classification: 'Infrastructure',
				technique: null,
				amount: 1_400_000_000,
				chain: ['Ethereum'],
				bridgeHack: false,
				targetType: 'CEX',
				returnedFunds: 1_400_000_000,
				defillamaId: '2286',
				language: null
			}
		])

		const result = await fetchHacks()

		expect(result[0]).toMatchObject({ amountUsd: 1_400_000_000, returnedFundsUsd: 1_400_000_000 })
		expect(result[0]).not.toHaveProperty('amount')
	})
})
