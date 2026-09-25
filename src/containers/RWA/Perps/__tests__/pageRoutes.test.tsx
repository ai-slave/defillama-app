import assert from 'node:assert/strict'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import { RWA_PERPS_SERVER_URL as base } from '~/constants'
import * as groupPage from '~/pages/rwa/perps/asset-group/[assetGroup]'
import * as groupsPage from '~/pages/rwa/perps/asset-groups'
import * as assetPage from '~/pages/rwa/perps/asset/[asset]'
import * as contractPage from '~/pages/rwa/perps/contract/[contract]'
import * as overviewPage from '~/pages/rwa/perps/index'
import * as venuePage from '~/pages/rwa/perps/venue/[venue]'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'
import { installMetadataSeeder } from '~/utils/test/metadataCache'
import type { IRWAPerpsMarket } from '../api.types'

vi.hoisted(() => vi.stubEnv('SKIP_BUILD_STATIC_GENERATION', 'false'))
afterAll(() => vi.unstubAllEnvs())
vi.mock('next/head', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('next/router', () => ({
	useRouter: () => ({
		query: {},
		pathname: '/rwa/perps',
		asPath: '/rwa/perps',
		push() {},
		events: { on() {}, off() {} }
	})
}))
const http = installFixtureFetch()
const metadata = installMetadataSeeder()
const list = {
	contracts: ['xyz:META'],
	venues: ['XYZ Venue'],
	categories: [],
	assets: ['S&P 500 Index'],
	assetGroups: ['US Equities'],
	total: 1
}
const market: IRWAPerpsMarket = {
	id: 'xyz:meta',
	timestamp: 1_775_011_512,
	contract: 'xyz:META',
	venue: 'XYZ Venue',
	venueType: 'DEX' as const,
	openInterest: 100,
	openInterestChange24h: 25,
	volume24h: 50,
	volume24hChange24h: 50,
	price: 500,
	priceChange24h: 5,
	fundingRate: 0.00001,
	premium: 0.0002,
	cumulativeFunding: 10,
	referenceAsset: 'S&P 500 Index',
	referenceAssetGroup: 'US Equities',
	assetClass: ['Stock Perp'],
	parentPlatform: 'trade[XYZ]',
	pair: null,
	marginAsset: 'USDC',
	settlementAsset: 'USDC',
	category: ['RWA Perps'],
	issuer: 'XYZ',
	website: ['https://trade.xyz/'],
	link: 'https://app.hyperliquid.xyz/join/DEFILLAMAS',
	oracleProvider: 'Pyth equity feed',
	description: 'Perpetual market',
	accessModel: 'Permissionless',
	rwaClassification: 'Programmable Finance',
	makerFeeRate: 0.0002,
	takerFeeRate: 0.0005,
	deployerFeeShare: 0.5,
	oraclePx: 501,
	midPx: 500.5,
	prevDayPx: 480,
	maxLeverage: 10,
	szDecimals: 2,
	fundingIntervalHours: 1,
	volume7d: 300,
	volume30d: 1000,
	volumeAllTime: 5000,
	estimatedProtocolFees24h: 1,
	estimatedProtocolFees7d: 3,
	estimatedProtocolFees30d: 10,
	estimatedProtocolFeesAllTime: 50,
	suspicious: false
}

beforeEach(() => {
	metadata.seed({ rwaPerpsList: list })
	http.serve({
		[`${base}/list`]: list,
		[`${base}/stats`]: { totalMarkets: 1, totalCumulativeFunding: 10, byVenue: {}, byAssetGroup: {} },
		[`${base}/current`]: [market],
		[`${base}/asset/S%26P%20500%20Index`]: [market],
		[`${base}/assetGroup/US%20Equities`]: [market],
		[`${base}/venue/XYZ%20Venue`]: [market],
		[`${base}/contract/xyz%3AMETA`]: [market],
		[`${base}/chart/xyz%3Ameta`]: [],
		[`${base}/funding/xyz%3Ameta`]: [],
		[`${base}/chart/overview-breakdown`]: [{ timestamp: 100, xyz: 100 }],
		[`${base}/chart/contract-breakdown`]: [{ timestamp: 100, 'xyz:META': 100 }],
		[`${base}/chart/market-breakdown`]: [{ timestamp: 100, 'xyz:meta': 100 }]
	})
})
const scopes = [
	{
		name: 'asset',
		display: 'S&P 500 Index',
		canonical: 's-p-500-index',
		route: 'asset',
		key: 'asset',
		paths: assetPage.getStaticPaths,
		load: (value: string) => assetPage.getStaticProps({ params: { asset: value } })
	},
	{
		name: 'venue',
		display: 'XYZ Venue',
		canonical: 'xyz-venue',
		route: 'venue',
		key: 'venue',
		paths: venuePage.getStaticPaths,
		load: (value: string) => venuePage.getStaticProps({ params: { venue: value } })
	},
	{
		name: 'asset group',
		display: 'US Equities',
		canonical: 'us-equities',
		route: 'asset-group',
		key: 'assetGroup',
		paths: groupPage.getStaticPaths,
		load: (value: string) => groupPage.getStaticProps({ params: { assetGroup: value } })
	}
]
test.each(scopes)('publishes canonical static paths for each $name', async ({ paths, canonical, key }) => {
	await expect(paths()).resolves.toEqual({ paths: [{ params: { [key]: canonical } }], fallback: 'blocking' })
})
test.each(scopes)('rejects an unknown $name without fetching', async ({ load }) => {
	await expect(load('unknown')).resolves.toEqual({ notFound: true })
	expect(http.requests).toHaveLength(0)
})
test.each(scopes)('redirects display-name $name URLs before fetching', async ({ load, display, canonical, route }) => {
	await expect(load(display)).resolves.toEqual({
		redirect: { destination: `/rwa/perps/${route}/${canonical}`, permanent: false }
	})
	expect(http.requests).toHaveLength(0)
})
test.each(scopes)(
	'loads actual market totals and navigation for a canonical $name',
	async ({ load, canonical, display, key, route }) => {
		const result = await load(canonical)
		assert('props' in result)
		expect(result.props.data).toMatchObject({
			[key]: display,
			markets: [market],
			totals: { openInterest: 100, volume24h: 50, markets: 1, protocolFees24h: 1 }
		})
		const linksKey = `${key}Links` as 'assetLinks' | 'venueLinks' | 'assetGroupLinks'
		expect(result.props.data).toMatchObject({
			[linksKey]: expect.arrayContaining([{ label: display, to: `/rwa/perps/${route}/${canonical}` }])
		})
		expect(result.props.data.initialChartDataset.source).toHaveLength(1)
	}
)
test('keeps raw contract identifiers in static paths', async () => {
	await expect(contractPage.getStaticPaths()).resolves.toEqual({
		paths: [{ params: { contract: 'xyz:META' } }],
		fallback: 'blocking'
	})
})
test.each(['xyz:meta', 'xyz%3ameta', 'xyz-meta'])('canonicalizes the contract alias %s', async (contract) => {
	await expect(contractPage.getStaticProps({ params: { contract } })).resolves.toEqual({
		redirect: { destination: '/rwa/perps/contract/xyz%3AMETA', permanent: false }
	})
	expect(http.requests).toHaveLength(0)
})
test('rejects ambiguous contract slugs and unknown identifiers', async () => {
	metadata.seed({ rwaPerpsList: { ...list, contracts: ['xyz:META', 'xyz META'] } })
	await expect(contractPage.getStaticProps({ params: { contract: 'xyz-meta' } })).resolves.toEqual({ notFound: true })
	await expect(contractPage.getStaticProps({ params: { contract: 'unknown' } })).resolves.toEqual({ notFound: true })
})
test('preserves a canonical lowercase identifier and redirects its uppercase alias', async () => {
	metadata.seed({ rwaPerpsList: { ...list, contracts: ['xyz:sp500'] } })
	http.serve({ [`${base}/contract/xyz%3Asp500`]: [{ ...market, contract: 'xyz:sp500' }] })
	const result = await contractPage.getStaticProps({ params: { contract: 'xyz:sp500' } })
	assert('props' in result)
	expect(result.props.contract.contract.contract).toBe('xyz:sp500')
	await expect(contractPage.getStaticProps({ params: { contract: 'XYZ:SP500' } })).resolves.toEqual({
		redirect: { destination: '/rwa/perps/contract/xyz%3Asp500', permanent: false }
	})
})
test('renders the raw contract identifier in the document title', async () => {
	const result = await contractPage.getStaticProps({ params: { contract: 'xyz:META' } })
	assert('props' in result)
	const client = new QueryClient()
	const html = renderToStaticMarkup(
		<QueryClientProvider client={client}>
			<AuthProvider>
				<contractPage.default {...result.props} />
			</AuthProvider>
		</QueryClientProvider>
	)
	expect(html).toContain('<title>xyz:META - RWA Perps Analytics - DefiLlama</title>')
	client.clear()
})
test('builds overview totals from the actual market response', async () => {
	const result = await overviewPage.getStaticProps({})
	assert('props' in result)
	expect(result.props.data.totals).toMatchObject({
		openInterest: 100,
		volume24h: 50,
		markets: 1,
		protocolFees24h: 1,
		cumulativeFunding: 10
	})
})
test('builds asset-group rows from markets and links from metadata', async () => {
	// A second group makes each share a real fraction of the page total.
	http.serve({
		[`${base}/current`]: [
			market,
			{
				...market,
				id: 'xyz:gold',
				contract: 'xyz:GOLD',
				referenceAssetGroup: 'Commodities',
				openInterest: 300,
				volume24h: 150
			}
		]
	})
	const result = await groupsPage.getStaticProps({})
	assert('props' in result)
	expect(result.props.assetGroupLinks).toContainEqual({
		label: 'US Equities',
		to: '/rwa/perps/asset-group/us-equities'
	})
	const groups = [
		{
			assetGroup: 'Commodities',
			openInterest: 300,
			openInterestShare: 0.75,
			volume24h: 150,
			volume24hShare: 0.75,
			markets: 1
		},
		{
			assetGroup: 'US Equities',
			openInterest: 100,
			openInterestShare: 0.25,
			volume24h: 50,
			volume24hShare: 0.25,
			markets: 1
		}
	]
	expect(result.props.assetGroups).toEqual(groups)
	expect(result.props.dexAssetGroups).toEqual(groups)
})
