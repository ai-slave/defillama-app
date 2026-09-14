import { describe, expect, test } from 'vitest'
import { spotAsset } from '../../table/__tests__/fixtures'
import { getRwaNewListings } from '../newListings'

const DAY = 86_400_000
const now = 1_800_000_000_000

describe('getRwaNewListings', () => {
	const assets = [
		spotAsset({ id: 'old', firstSeen: now - 40 * DAY }),
		spotAsset({ id: 'small', firstSeen: now - 5 * DAY, activeMcap: { total: 10, breakdown: [] } }),
		spotAsset({ id: 'big', firstSeen: now - 29 * DAY, activeMcap: { total: 1000, breakdown: [] } }),
		spotAsset({ id: 'unknown', firstSeen: null })
	]

	test('keeps rows first seen inside the window, largest active mcap first', () => {
		expect(getRwaNewListings(assets, now).map((listing) => listing.asset.id)).toEqual(['big', 'small'])
	})

	test('caps at the limit', () => {
		expect(getRwaNewListings(assets, now, 1).map((listing) => listing.asset.id)).toEqual(['big'])
	})
})
