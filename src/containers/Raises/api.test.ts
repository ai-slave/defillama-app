import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchRaises } from './api'

const fetchJsonMock = vi.hoisted(() => vi.fn())

vi.mock('~/utils/async', () => ({ fetchJson: fetchJsonMock }))

describe('Raises API', () => {
	beforeEach(() => {
		fetchJsonMock.mockReset()
	})

	it('converts million-USD transport values to whole-USD domain values', async () => {
		fetchJsonMock.mockResolvedValue({
			raises: [
				{
					date: 1_737_331_200,
					name: 'Coinstash',
					round: 'Series A',
					amount: 3.1,
					chains: [],
					sector: 'CeFi',
					category: 'Exchange',
					categoryGroup: 'CeFi',
					leadInvestors: [],
					otherInvestors: [],
					valuation: '300'
				}
			]
		})

		const result = await fetchRaises()

		expect(result.raises[0]).toMatchObject({ amountUsd: 3_100_000, valuationUsd: 300_000_000 })
		expect(result.raises[0]).not.toHaveProperty('amount')
		expect(result.raises[0]).not.toHaveProperty('valuation')
	})

	it('treats blank and non-numeric transport values as undisclosed', async () => {
		fetchJsonMock.mockResolvedValue({
			raises: [
				{
					date: 1,
					name: 'Undisclosed',
					round: null,
					amount: null,
					chains: [],
					sector: null,
					category: null,
					categoryGroup: null,
					leadInvestors: [],
					otherInvestors: [],
					valuation: ' '
				}
			]
		})

		const result = await fetchRaises()

		expect(result.raises[0]).toMatchObject({
			round: null,
			sector: null,
			category: null,
			categoryGroup: null,
			amountUsd: null,
			valuationUsd: null
		})
	})
})
