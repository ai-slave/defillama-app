import { describe, expect, test } from 'vitest'
import { DATASETS_SERVER_URL } from '~/constants'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { calculateTotalUnlockValue, getProtocolUnlocksStaticPropsData } from '../protocolUnlocksStaticProps'

const http = installFixtureFetch()

describe('protocol unlock static props boundary', () => {
	test('does not present a weekly rate as a one-time unlock value', () => {
		expect(
			calculateTotalUnlockValue({
				tokenPrice: { price: 2 },
				upcomingEvent: [
					{
						description: 'Rate change',
						category: 'farming',
						unlockType: 'linear',
						timestamp: 1,
						noOfTokens: [10, 4],
						rateDurationDays: 7
					}
				]
			})
		).toBeNull()
	})

	test('excludes unavailable amounts while retaining a known zero', () => {
		expect(
			calculateTotalUnlockValue({
				tokenPrice: { price: 2 },
				upcomingEvent: [
					{
						description: 'Unknown cliff',
						category: 'insiders',
						unlockType: 'cliff',
						timestamp: 1,
						noOfTokens: [],
						hasUnknownTokenAmount: true
					},
					{
						description: 'Known zero',
						category: 'publicSale',
						unlockType: 'cliff',
						timestamp: 1,
						noOfTokens: [0]
					},
					{
						description: 'Negative correction',
						category: 'publicSale',
						unlockType: 'cliff',
						timestamp: 1,
						noOfTokens: [-10]
					}
				]
			})
		).toBe(0)
	})

	test.each([0, -2])('treats a nonpositive price (%d) as unavailable', (price) => {
		expect(
			calculateTotalUnlockValue({
				tokenPrice: { price },
				upcomingEvent: [
					{
						description: 'Cliff',
						category: 'insiders',
						unlockType: 'cliff',
						timestamp: 1,
						noOfTokens: [10]
					}
				]
			})
		).toBeNull()
	})

	test('throws on transient detail failure so ISR can retain its stale page', async () => {
		http.serve({ [`${DATASETS_SERVER_URL}/emissions/aave`]: fixtureStatus(400) })

		await expect(getProtocolUnlocksStaticPropsData('Aave', {}, ['aave'])).rejects.toThrow(/400/)
	})
})
