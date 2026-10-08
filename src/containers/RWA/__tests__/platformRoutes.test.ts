import { describe, expect, test } from 'vitest'
import { getRwaPerpsOnlyPlatformSlugs, getRwaPlatformPageOutcome } from '../platformRoutes'

const noAum = { onchainAum: 0, activeAum: 0 }

describe('getRwaPlatformPageOutcome', () => {
	test('serves the page while the platform has spot rows or indexed spot AUM, linking its live venue', () => {
		expect(getRwaPlatformPageOutcome({ spotRows: 1, meta: noAum, perpsVenue: 'Ondo' })).toEqual({
			kind: 'page',
			perpsVenueHref: '/rwa/perps/venue/ondo'
		})
		expect(
			getRwaPlatformPageOutcome({ spotRows: 0, meta: { onchainAum: 5, activeAum: 0 }, perpsVenue: 'Ondo' })
		).toEqual({
			kind: 'page',
			perpsVenueHref: '/rwa/perps/venue/ondo'
		})
		expect(
			getRwaPlatformPageOutcome({ spotRows: 0, meta: { onchainAum: 0, activeAum: null }, perpsVenue: null })
		).toEqual({ kind: 'notFound' })
	})

	test('sends a platform with no spot rows but a live perps venue to its venue page', () => {
		expect(getRwaPlatformPageOutcome({ spotRows: 0, meta: noAum, perpsVenue: 'trade[XYZ]' })).toEqual({
			kind: 'redirect',
			destination: '/rwa/perps/venue/trade-xyz'
		})
		expect(getRwaPlatformPageOutcome({ spotRows: 0, meta: null, perpsVenue: 'Entropy' })).toEqual({
			kind: 'redirect',
			destination: '/rwa/perps/venue/entropy'
		})
	})

	test('404s an indexed platform with neither, and keeps one the index has no row for', () => {
		expect(getRwaPlatformPageOutcome({ spotRows: 0, meta: noAum, perpsVenue: null })).toEqual({ kind: 'notFound' })
		expect(getRwaPlatformPageOutcome({ spotRows: 0, meta: null, perpsVenue: null })).toEqual({
			kind: 'page',
			perpsVenueHref: null
		})
	})
})

describe('getRwaPerpsOnlyPlatformSlugs', () => {
	test('names the platform routes that redirect: no indexed spot AUM and a live venue of the same slug', () => {
		const slugs = getRwaPerpsOnlyPlatformSlugs({
			rwaList: {
				canonicalMarketIds: [],
				idMap: {},
				platforms: [],
				platformRoutes: [
					{ name: 'Ondo', slug: 'ondo' },
					{ name: 'Ostium', slug: 'ostium' },
					{ name: 'trade[XYZ]', slug: 'trade-xyz' },
					{ name: 'Avantis', slug: 'avantis' }
				],
				chains: [],
				categories: [],
				assetGroups: []
			},
			rwaPlatformsIndex: {
				generatedAt: 0,
				byPid: {},
				platforms: {
					ondo: { onchainAum: 10, activeAum: 0 },
					ostium: { onchainAum: 0, activeAum: 0 },
					avantis: { onchainAum: 0, activeAum: 0 }
				}
			} as never,
			rwaPerpsList: {
				venues: ['Ondo', 'Ostium', 'trade[XYZ]']
			}
		})
		expect([...slugs].sort()).toEqual(['ostium', 'trade-xyz'])
	})
})
