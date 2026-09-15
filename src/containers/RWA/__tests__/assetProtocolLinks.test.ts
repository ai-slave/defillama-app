import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getRWAAssetData } from '../queries'

const fetchRWAAssetDataByIdMock = vi.fn()

vi.mock('../api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../api')>()
	return {
		...actual,
		fetchRWAAssetDataById: (...args: Array<unknown>) => fetchRWAAssetDataByIdMock(...args),
		fetchRWAAssetChartData: () => Promise.resolve(null)
	}
})

vi.mock('~/api', () => ({
	fetchBlockExplorers: () => Promise.resolve([])
}))

// `name` is the protocol SLUG in this artifact; `displayName` is the human label.
vi.mock('~/utils/metadata', () => ({
	default: {
		protocolMetadata: {
			'3057': { name: 'openeden-tbill', displayName: 'OpenEden TBILL' },
			'5995': { name: 'openeden-usdo' },
			'7670': { name: 'openeden-prism', displayName: '' },
			'9999': {}
		}
	}
}))

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
	fetchRWAAssetDataByIdMock.mockResolvedValue({ ...baseAsset, projectId })
	return getRWAAssetData({ assetId: '90', yieldsSnapshot: null })
}

describe('rwa asset protocol links', () => {
	beforeEach(() => {
		fetchRWAAssetDataByIdMock.mockReset()
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
