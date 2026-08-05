import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchJson = vi.fn()

vi.mock('~/constants', () => ({
	RWA_PERPS_SERVER_URL: 'https://example.com/rwa-perps'
}))

vi.mock('~/utils/async', () => ({
	fetchJson
}))

beforeEach(() => {
	fetchJson.mockReset()
	fetchJson.mockResolvedValue([])
})

afterEach(() => {
	vi.clearAllMocks()
})

describe('rwa perps api urls', () => {
	function callsWithoutCacheVersion(): unknown[][] {
		return fetchJson.mock.calls.map(([url, ...args]) => {
			const parsed = new URL(url)
			parsed.searchParams.delete('zz')
			return [parsed.toString(), ...args]
		})
	}

	it('encodes contract, venue, and market ids in request paths', async () => {
		const api = await import('../api')

		await api.fetchRWAPerpsMarketById('xyz:META/2026')
		await api.fetchRWAPerpsMarketsByContract('xyz:META/2026')
		await api.fetchRWAPerpsMarketsByVenue('my venue')
		await api.fetchRWAPerpsMarketsByAssetGroup('US Equities')
		await api.fetchRWAPerpsVenueChart('venue/one')
		await api.fetchRWAPerpsOverviewBreakdownChartData({
			breakdown: 'assetGroup',
			key: 'openInterest',
			target: { kind: 'venue', slug: 'xyz' }
		})
		await api.fetchRWAPerpsContractBreakdownChartData({
			key: 'markets',
			target: { kind: 'assetGroup', slug: 'US Equities' }
		})
		await api.fetchRWAPerpsMarketBreakdownChartData({
			key: 'openInterest',
			target: { kind: 'excludeAssetClass', slug: 'Forex Perps' }
		})

		expect(callsWithoutCacheVersion()).toEqual([
			['https://example.com/rwa-perps/market/xyz%3AMETA%2F2026'],
			['https://example.com/rwa-perps/contract/xyz%3AMETA%2F2026'],
			['https://example.com/rwa-perps/venue/my%20venue'],
			['https://example.com/rwa-perps/assetGroup/US%20Equities'],
			['https://example.com/rwa-perps/chart/venue/venue%2Fone'],
			['https://example.com/rwa-perps/chart/overview-breakdown?breakdown=assetGroup&key=openInterest&venue=xyz'],
			['https://example.com/rwa-perps/chart/contract-breakdown?key=markets&assetGroup=US+Equities'],
			['https://example.com/rwa-perps/chart/market-breakdown?key=openInterest&excludeAssetClass=Forex+Perps']
		])
	})

	it('builds funding history urls with optional query params', async () => {
		const api = await import('../api')

		await api.fetchRWAPerpsFundingHistory('xyz:META', { startTime: 10, endTime: 20 })
		await api.fetchRWAPerpsFundingHistory('xyz:META')

		expect(callsWithoutCacheVersion()).toEqual([
			['https://example.com/rwa-perps/funding/xyz%3AMETA?startTime=10&endTime=20'],
			['https://example.com/rwa-perps/funding/xyz%3AMETA']
		])
	})

	it('normalizes funding database decimals and timestamps once at the fetch boundary', async () => {
		fetchJson.mockResolvedValueOnce([
			{
				timestamp: 1774454400,
				id: 'xyz:meta',
				contract: 'xyz:META',
				venue: 'xyz',
				funding_rate: '0.00000625',
				premium: '0.00010000',
				open_interest: '6203.048',
				funding_payment: '0.03876905',
				created_at: '2026-03-26T15:17:54.413Z'
			}
		])
		const api = await import('../api')

		await expect(api.fetchRWAPerpsFundingHistory('xyz:META')).resolves.toEqual([
			{
				timestamp: 1774454400000,
				id: 'xyz:meta',
				contract: 'xyz:META',
				venue: 'xyz',
				fundingRate: 0.00000625,
				premium: 0.0001,
				openInterest: 6203.048,
				fundingPayment: 0.03876905,
				createdAt: '2026-03-26T15:17:54.413Z'
			}
		])
	})
})
