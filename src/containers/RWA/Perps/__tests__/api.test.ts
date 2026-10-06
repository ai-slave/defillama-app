import { beforeEach, describe, expect, test, vi } from 'vitest'
import * as api from '../api'

const { fetchJson } = vi.hoisted(() => ({ fetchJson: vi.fn() }))

vi.mock('~/utils/async', () => ({
	fetchJson
}))

beforeEach(() => {
	fetchJson.mockReset()
	fetchJson.mockResolvedValue([])
})

describe('fetchRWAPerpsFundingHistory', () => {
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
