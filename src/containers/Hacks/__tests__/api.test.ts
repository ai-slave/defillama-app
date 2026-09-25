import { describe, expect, test } from 'vitest'
import { SERVER_URL } from '~/constants'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { fetchHacks } from '../api'

const http = installFixtureFetch()

describe('Hacks API', () => {
	test('keeps amounts in whole USD and gives them explicit domain names', async () => {
		http.serve({
			[`${SERVER_URL}/hacks`]: [
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
					language: null,
					source: ''
				}
			]
		})

		const result = await fetchHacks()

		expect(result[0]).toMatchObject({ amountUsd: 1_400_000_000, returnedFundsUsd: 1_400_000_000 })
		expect(result[0]).not.toHaveProperty('amount')
	})
})
