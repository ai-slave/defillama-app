import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { RWA_PERPS_SERVER_URL, RWA_SERVER_URL } from '~/constants'
import type { RWAPlatformMeta } from '~/containers/RWA/PlatformPage/api.types'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'

const upstream = vi.hoisted(() => ({ routes: {} as Record<string, unknown> }))

// Upstream routes, answered by URL. An Error fixture is a failed upstream request.
vi.mock('~/utils/async', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/utils/async')>()),
	fetchJson: async (url: string) => {
		// No platform in these tests has per-asset history; the page renders from the listing.
		if (url.includes('/asset-breakdown?')) throw new Error('[404] no history')
		if (!(url in upstream.routes)) throw new Error(`Unrouted upstream request: ${url}`)
		const body = upstream.routes[url]
		if (body instanceof Error) throw body
		return structuredClone(body)
	}
}))
// Heavy page chrome; these tests only read getStaticProps output.
vi.mock('~/layout', () => ({ default: () => null }))
vi.mock('~/containers/RWA', () => ({ RWAOverview: () => null }))

const LISTING = `${RWA_SERVER_URL}/current?lite=true`
const PERPS_CURRENT = `${RWA_PERPS_SERVER_URL}/current?cachebust=091626&includeCex=true`

const metadata = installMetadataSeeder()

const platformRoutes = [
	{ name: 'Avantis', slug: 'avantis' },
	{ name: 'Ondo', slug: 'ondo' },
	{ name: 'Entropy', slug: 'entropy' },
	{ name: 'Tokeshare', slug: 'tokeshare' }
]

function seed({
	index,
	perpsVenues = []
}: {
	index: Record<string, Partial<RWAPlatformMeta> & { isPerpsVenue?: boolean }>
	perpsVenues?: Array<string>
}) {
	const platforms: Record<string, RWAPlatformMeta> = {}
	for (const slug in index) {
		const name = platformRoutes.find((route) => route.slug === slug)?.name ?? slug
		platforms[slug] = { name, slug, onchainAum: 0, activeAum: 0, ...index[slug] } as unknown as RWAPlatformMeta
	}
	metadata.seed({
		rwaList: {
			canonicalMarketIds: [],
			idMap: {},
			platforms: platformRoutes.map((route) => route.name),
			platformRoutes,
			chains: ['Ethereum'],
			categories: ['Treasuries', 'Commodities'],
			assetGroups: ['Commodities']
		},
		rwaPlatformsIndex: { generatedAt: 1, byPid: {}, platforms },
		rwaPerpsList: { contracts: [], venues: perpsVenues, categories: [], assets: [], assetGroups: [], total: 0 }
	})
}

const ondoTreasury = {
	id: 'ousg',
	canonicalMarketId: 'ousg',
	ticker: 'OUSG',
	assetName: 'Ondo Short-Term US Government Treasuries',
	parentPlatform: 'Ondo',
	category: ['Treasuries'],
	onChainMcap: { Ethereum: 100 },
	activeMcap: { Ethereum: 90 },
	defiActiveTvl: {}
}

const entropyGold = {
	id: 'entropy-gold',
	timestamp: 1,
	contract: 'entropy:gold',
	venue: 'Entropy',
	venueType: 'DEX',
	openInterest: 10,
	openInterestChange24h: null,
	volume24h: 20,
	volume24hChange24h: null,
	price: 1.01,
	priceChange24h: 0,
	fundingRate: 0,
	premium: 0,
	cumulativeFunding: 0,
	referenceAsset: 'Gold',
	referenceAssetGroup: 'Commodities',
	assetClass: ['Commodities'],
	parentPlatform: 'Entropy',
	pair: null,
	marginAsset: null,
	settlementAsset: null,
	category: ['Commodities'],
	issuer: 'Entropy',
	website: null,
	link: null,
	oracleProvider: null,
	description: null,
	accessModel: 'Permissionless',
	rwaClassification: 'RWA',
	makerFeeRate: 0,
	takerFeeRate: 0,
	deployerFeeShare: 0,
	oraclePx: 0,
	midPx: 0,
	prevDayPx: 0,
	maxLeverage: 0,
	szDecimals: 0,
	fundingIntervalHours: 1,
	volume7d: 0,
	volume30d: 0,
	volumeAllTime: 0,
	estimatedProtocolFees24h: 0,
	estimatedProtocolFees7d: 0,
	estimatedProtocolFees30d: 0,
	estimatedProtocolFeesAllTime: 0,
	suspicious: false
}

async function getPlatformProps(platform: string) {
	const page = await import('~/pages/rwa/platform/[platform]')
	return page.getStaticProps({ params: { platform } })
}

describe('rwa platform page', () => {
	beforeEach(() => {
		upstream.routes = { [LISTING]: [ondoTreasury], [PERPS_CURRENT]: [entropyGold] }
		vi.spyOn(console, 'error').mockImplementation(() => {})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	test('404s a Platforms-sheet row with no rows, no AUM and no live perps venue', async () => {
		seed({ index: { avantis: {} } })

		await expect(getPlatformProps('avantis')).resolves.toEqual({ notFound: true, revalidate: expect.any(Number) })
	})

	test('renders a platform from its live rows even while the index shows no AUM', async () => {
		seed({ index: { ondo: {} } })

		await expect(getPlatformProps('ondo')).resolves.toMatchObject({
			props: { platformName: 'Ondo', assets: [{ kind: 'spot', ticker: 'OUSG' }] }
		})
	})

	test('keeps a platform with indexed onchain AUM when the listing has none of its rows', async () => {
		upstream.routes[LISTING] = []
		seed({ index: { ondo: { onchainAum: 100, activeAum: 0 } } })

		await expect(getPlatformProps('ondo')).resolves.toMatchObject({ props: { platformName: 'Ondo', assets: [] } })
	})

	test('keeps a platform with indexed active AUM even when onchain AUM is zero and the listing is empty', async () => {
		upstream.routes[LISTING] = []
		seed({ index: { ondo: { onchainAum: 0, activeAum: 90 } } })

		await expect(getPlatformProps('ondo')).resolves.toMatchObject({ props: { platformName: 'Ondo', assets: [] } })
	})

	test('renders a perps-only venue from its live markets', async () => {
		seed({ index: { entropy: {} }, perpsVenues: ['Entropy'] })

		await expect(getPlatformProps('entropy')).resolves.toMatchObject({
			props: { platformName: 'Entropy', assets: [{ kind: 'perps', contract: 'entropy:gold' }] }
		})
	})

	test('keeps a live perps venue up when the perps feed fails, whatever the index says about it', async () => {
		upstream.routes[PERPS_CURRENT] = new Error('[503] perps unavailable')
		// When its own perps join fails, the server publishes isPerpsVenue: false for every platform.
		seed({ index: { entropy: { isPerpsVenue: false } }, perpsVenues: ['Entropy'] })

		await expect(getPlatformProps('entropy')).resolves.toMatchObject({ props: { platformName: 'Entropy', assets: [] } })
	})

	test('keeps a platform the index has no row for, since nothing confirms it is dead', async () => {
		seed({ index: {} })

		await expect(getPlatformProps('tokeshare')).resolves.toMatchObject({
			props: { platformName: 'Tokeshare', assets: [] }
		})
	})

	test('rechecks an unknown platform slug on the next revalidation instead of caching its 404 until deploy', async () => {
		seed({ index: {} })

		await expect(getPlatformProps('no-such-platform')).resolves.toEqual({
			notFound: true,
			revalidate: expect.any(Number)
		})
	})
})
