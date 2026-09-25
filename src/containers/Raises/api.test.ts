import { describe, expect, test } from 'vitest'
import { SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import { fetchRaises } from './api'
import type { RaisesApiResponse } from './api.types'
const http = installFixtureFetch()

describe('Raises API', () => {
	test('converts million-USD transport values to whole-USD domain values', async () => {
		http.serve({
			[`${SERVER_URL}/raises`]: {
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
						valuation: '300',
						source: ''
					}
				]
			} satisfies RaisesApiResponse
		})

		const result = await fetchRaises()

		expect(result.raises[0]).toMatchObject({ amountUsd: 3_100_000, valuationUsd: 300_000_000 })
		expect(result.raises[0]).not.toHaveProperty('amount')
		expect(result.raises[0]).not.toHaveProperty('valuation')
	})

	test.each([null, '', ' ', 'not disclosed', '3,000', '<7000', '9.8 millions'])(
		'keeps freeform valuation %s unavailable',
		async (valuation) => {
			http.serve({
				[`${SERVER_URL}/raises`]: {
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
							valuation,
							source: ''
						}
					]
				} satisfies RaisesApiResponse
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
		}
	)

	test('preserves measured zero, required empty source, exact labels and optional identity', async () => {
		http.serve({
			[`${SERVER_URL}/raises`]: {
				raises: [
					{
						date: 1,
						name: 'wstETH',
						round: null,
						amount: 0,
						chains: [],
						sector: null,
						category: null,
						categoryGroup: null,
						leadInvestors: ['Fund', 'fund'],
						otherInvestors: [],
						valuation: '0',
						source: '',
						defillamaId: 'parent#1'
					}
				]
			} satisfies RaisesApiResponse
		})
		expect((await fetchRaises()).raises[0]).toMatchObject({
			date: 1,
			name: 'wstETH',
			amountUsd: 0,
			valuationUsd: 0,
			source: '',
			defillamaId: 'parent#1',
			leadInvestors: ['Fund', 'fund']
		})
	})
})
