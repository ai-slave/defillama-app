import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchCoinGeckoChartMock, getProtocolEmissonsMock } = vi.hoisted(() => ({
	fetchCoinGeckoChartMock: vi.fn(),
	getProtocolEmissonsMock: vi.fn()
}))

vi.mock('~/api/coingecko', () => ({
	fetchCoinGeckoChartByIdWithCacheFallback: fetchCoinGeckoChartMock
}))

vi.mock('~/containers/Unlocks/queries', () => ({
	getProtocolEmissons: getProtocolEmissonsMock
}))

import { calculateTotalUnlockValue, getProtocolUnlocksStaticPropsData } from '../protocolUnlocksStaticProps'

describe('protocol unlock static props boundary', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('does not present a weekly rate as a one-time unlock value', () => {
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

	it('excludes unavailable amounts while retaining a known zero', () => {
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

	it('treats a nonpositive price as unavailable', () => {
		expect(
			calculateTotalUnlockValue({
				tokenPrice: { price: -2 },
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

	it('returns canonical absence without requesting a detail outside the producer list', async () => {
		const result = await getProtocolUnlocksStaticPropsData('Missing Protocol', {}, ['aave'])

		expect(result).toEqual({
			normalizedName: 'missing-protocol',
			emissions: null,
			geckoId: null,
			tokenSymbol: null,
			initialTokenMarketData: null
		})
		expect(getProtocolEmissonsMock).not.toHaveBeenCalled()
	})

	it('throws on transient detail failure so ISR can retain its stale page', async () => {
		const error = new Error('detail source unavailable')
		getProtocolEmissonsMock.mockRejectedValue(error)

		await expect(getProtocolUnlocksStaticPropsData('Aave', {}, ['aave'])).rejects.toBe(error)
		expect(fetchCoinGeckoChartMock).not.toHaveBeenCalled()
	})
})
