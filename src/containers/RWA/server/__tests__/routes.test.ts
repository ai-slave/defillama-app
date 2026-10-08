import { describe, expect, test } from 'vitest'
import type { MetadataCache } from '~/utils/metadata/artifactContract'
import { getRWASitemapRoutes } from '../routes'

const metadata = {
	rwaList: {
		canonicalMarketIds: [],
		platforms: ['Ondo', 'Ostium'],
		platformRoutes: [
			{ name: 'Ondo', slug: 'ondo' },
			{ name: 'Ostium', slug: 'ostium' }
		],
		chains: [],
		categories: [],
		assetGroups: ['Bonds'],
		idMap: {}
	},
	rwaPlatformsIndex: {
		generatedAt: 0,
		byPid: {},
		platforms: { ondo: { onchainAum: 10, activeAum: 5 }, ostium: { onchainAum: 0, activeAum: 0 } }
	},
	rwaPerpsList: {
		contracts: [],
		venues: ['Ostium'],
		categories: [],
		assets: [],
		assetGroups: ['US Equities'],
		total: 0
	}
} as unknown as MetadataCache

describe('getRWASitemapRoutes', () => {
	test('lists final addresses: no platform that redirects to its venue page, the Unknown asset group included', () => {
		const routes = getRWASitemapRoutes(metadata)
		expect(routes).toContain('rwa/platform/ondo')
		expect(routes).not.toContain('rwa/platform/ostium')
		expect(routes).toContain('rwa/perps/venue/ostium')
		expect(routes).toEqual(expect.arrayContaining(['rwa/asset-group/bonds', 'rwa/asset-group/unknown']))
	})
})
