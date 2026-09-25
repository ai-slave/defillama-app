import { beforeEach, describe, expect, test, vi } from 'vitest'
import { RWA_PERPS_SERVER_URL as base } from '~/constants'
import * as api from '../api'

const { fetchJson } = vi.hoisted(() => ({ fetchJson: vi.fn() }))

vi.mock('~/utils/async', () => ({
	fetchJson
}))

beforeEach(() => {
	fetchJson.mockReset()
	fetchJson.mockResolvedValue([])
})

describe('rwa perps api urls', () => {
	function callsWithoutCacheVersion(): Array<Array<unknown>> {
		return fetchJson.mock.calls.map(([url, ...args]) => {
			const parsed = new URL(url)
			parsed.searchParams.delete('cachebust')
			return [parsed.toString(), ...args]
		})
	}

	test('encodes contract, venue, and market ids in request paths', async () => {
		await api.fetchRWAPerpsCurrent(false)
		await api.fetchRWAPerpsList(true)
		await api.fetchRWAPerpsStats(true)
		await api.fetchRWAPerpsMarketById('xyz:META/2026')
		await api.fetchRWAPerpsMarketsByContract('xyz:META/2026')
		await api.fetchRWAPerpsMarketsByVenue('my venue')
		await api.fetchRWAPerpsMarketsByAssetGroup('US Equities', true)
		await api.fetchRWAPerpsMarketsByAsset('SK Hynix', true)
		await api.fetchRWAPerpsVenueChart('venue/one')
		await api.fetchRWAPerpsOverviewBreakdownChartData({
			breakdown: 'assetGroup',
			key: 'openInterest',
			target: { kind: 'venue', slug: 'xyz' },
			includeCex: false
		})
		await api.fetchRWAPerpsContractBreakdownChartData({
			key: 'markets',
			target: { kind: 'assetGroup', slug: 'US Equities' },
			includeCex: true
		})
		await api.fetchRWAPerpsMarketBreakdownChartData({
			key: 'openInterest',
			target: { kind: 'baseAsset', slug: 'SK Hynix' },
			includeCex: false
		})

		expect(callsWithoutCacheVersion()).toEqual([
			[`${base}/current`],
			[`${base}/list?includeCex=true`],
			[`${base}/stats?includeCex=true`],
			[`${base}/market/xyz%3AMETA%2F2026`],
			[`${base}/contract/xyz%3AMETA%2F2026`],
			[`${base}/venue/my%20venue`],
			[`${base}/assetGroup/US%20Equities?includeCex=true`],
			[`${base}/asset/SK%20Hynix?includeCex=true`],
			[`${base}/chart/venue/venue%2Fone`],
			[`${base}/chart/overview-breakdown?breakdown=assetGroup&key=openInterest&venue=xyz`],
			[`${base}/chart/contract-breakdown?key=markets&includeCex=true&assetGroup=US+Equities`],
			[`${base}/chart/market-breakdown?key=openInterest&baseAsset=SK+Hynix`]
		])
	})

	test('builds funding history urls with optional query params', async () => {
		await api.fetchRWAPerpsFundingHistory('xyz:META', { startTime: 10, endTime: 20 })
		await api.fetchRWAPerpsFundingHistory('xyz:META')

		expect(callsWithoutCacheVersion()).toEqual([
			[`${base}/funding/xyz%3AMETA?startTime=10&endTime=20`],
			[`${base}/funding/xyz%3AMETA`]
		])
	})

	test('normalizes funding database decimals and timestamps once at the fetch boundary', async () => {
		fetchJson.mockResolvedValueOnce([
			{
				timestamp: 1_774_454_400,
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
		await expect(api.fetchRWAPerpsFundingHistory('xyz:META')).resolves.toEqual([
			{
				timestamp: 1_774_454_400_000,
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
