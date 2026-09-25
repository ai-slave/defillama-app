import { beforeEach, describe, expect, test, vi } from 'vitest'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import { getRWAAssetData } from '../queries'

const upstream = vi.hoisted(() => ({ asset: {} as Record<string, unknown> }))

vi.mock('~/utils/async', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/utils/async')>()),
	fetchJson: async (url: string) => {
		const { pathname } = new URL(url)
		if (pathname.endsWith('/rwa/90')) return upstream.asset
		if (pathname.endsWith('/chart/asset/90')) return []
		if (pathname.includes('explorer')) return []
		throw new Error(`Unrouted upstream request: ${url}`)
	}
}))

const metadata = installMetadataSeeder()

const baseAsset = {
	id: '90',
	ticker: 'TBILL',
	assetName: 'OpenEden T-Bills',
	canonicalMarketId: 'TBILL',
	onChainMcap: { Ethereum: 100 },
	activeMcap: { Ethereum: 90 },
	defiActiveTvl: { Ethereum: { Morpho: 10 } }
}

async function loadAsset(projectId: unknown) {
	upstream.asset = { ...baseAsset, projectId }
	return getRWAAssetData({ assetId: '90', yieldsSnapshot: null })
}

describe('rwa asset protocol links', () => {
	// `name` is the protocol SLUG in this artifact; `displayName` is the human label.
	beforeEach(() => {
		metadata.seed({
			protocolMetadata: {
				'3057': { name: 'openeden-tbill', displayName: 'OpenEden TBILL' },
				'5995': { name: 'openeden-usdo' },
				'7670': { name: 'openeden-prism', displayName: '' },
				'9999': {}
			}
		})
	})

	test('resolves each projectId to its protocol slug, preferring the display name', async () => {
		const asset = await loadAsset(['3057', '5995'])

		expect(asset?.protocolLinks).toEqual([
			{ name: 'OpenEden TBILL', slug: 'openeden-tbill' },
			{ name: 'openeden-usdo', slug: 'openeden-usdo' }
		])
	})

	test('falls back to the slug when displayName is blank rather than rendering an empty link', async () => {
		expect((await loadAsset(['7670'])).protocolLinks).toEqual([{ name: 'openeden-prism', slug: 'openeden-prism' }])
	})

	test('accepts a scalar projectId', async () => {
		const asset = await loadAsset('3057')

		expect(asset?.protocolLinks).toEqual([{ name: 'OpenEden TBILL', slug: 'openeden-tbill' }])
	})

	test('drops duplicate, unknown and missing ids instead of emitting a broken link', async () => {
		expect((await loadAsset(['3057', '3057', '9999', '404'])).protocolLinks).toEqual([
			{ name: 'OpenEden TBILL', slug: 'openeden-tbill' }
		])
		expect((await loadAsset(null)).protocolLinks).toEqual([])
		expect((await loadAsset(undefined)).protocolLinks).toEqual([])
	})
})
