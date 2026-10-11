import assert from 'node:assert/strict'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import { AI_SERVER, RWA_PERPS_SERVER_URL as base } from '~/constants'
import * as overviewPage from '~/pages/rwa/perps'
import * as groupPage from '~/pages/rwa/perps/asset-group/[assetGroup]'
import * as assetPage from '~/pages/rwa/perps/asset/[asset]'
import * as contractPage from '~/pages/rwa/perps/contract/[contract]'
import * as venuePage from '~/pages/rwa/perps/venue/[venue]'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { installMetadataSeeder } from '~/utils/testing/metadataCache'
import { unpackRwaPerpsMarkets } from '../../perpsPayload'
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
		[`${base}/current`]: [market],
		[`${base}/venue/XYZ%20Venue`]: [market],
		[`${base}/contract/xyz%3AMETA`]: [market],
		[`${base}/chart/xyz%3Ameta`]: [],
		[`${base}/funding/xyz%3Ameta`]: [],
		[`${base}/chart/overview-breakdown`]: [{ timestamp: 100, xyz: 100 }]
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

// A second market in another asset group and underlying, with more open interest, so the scope filter and the sort show.
const gold: IRWAPerpsMarket = {
	...market,
	id: 'xyz:gold',
	contract: 'xyz:GOLD',
	openInterest: 200,
	referenceAsset: 'Gold',
	referenceAssetGroup: 'Commodities'
}
test.each([
	{
		name: 'the overview',
		load: () => overviewPage.getStaticProps({}),
		ids: ['xyz:gold', 'xyz:meta'],
		active: 'All',
		assetGroupSlug: null
	},
	{
		name: 'an asset group',
		load: () => groupPage.getStaticProps({ params: { assetGroup: 'us-equities' } }),
		ids: ['xyz:meta'],
		active: 'US Equities',
		assetGroupSlug: 'us-equities'
	},
	{
		name: 'an underlying',
		load: () => assetPage.getStaticProps({ params: { asset: 's-p-500-index' } }),
		ids: ['xyz:meta'],
		active: 'US Equities',
		assetGroupSlug: null
	}
])('builds $name from its markets, with the asset group nav row', async ({ load, ids, active, assetGroupSlug }) => {
	http.serve({ [`${base}/current`]: [market, gold], [`${AI_SERVER}/suggested-questions`]: { questions: [] } })
	const result = await load()
	assert('props' in result)
	expect(unpackRwaPerpsMarkets(result.props.markets).map((row) => row.id)).toEqual(ids)
	expect(result.props.overview.nav.active).toBe(active)
	expect(result.props.overview.assetGroupSlug).toBe(assetGroupSlug)
})
test('builds a venue page from its markets, with the open interest of every venue of its type', async () => {
	metadata.seed({ rwaPlatformsIndex: { generatedAt: 1, byPid: {}, platforms: {} } })
	const tesla = { ...market, id: 'xyz:tsla', contract: 'xyz:TSLA', openInterest: 300 }
	http.serve({
		[`${base}/venue/XYZ%20Venue`]: [market, tesla],
		[`${base}/current`]: [
			market,
			tesla,
			{ ...market, id: 'abc:meta', venue: 'ABC Venue', openInterest: 40 },
			{ ...market, id: 'cex:meta', venue: 'CEX Venue', venueType: 'CEX', openInterest: 1000 }
		],
		[`${AI_SERVER}/suggested-questions`]: { questions: [] }
	})
	const result = await venuePage.getStaticProps({ params: { venue: 'xyz-venue' } })
	assert('props' in result)
	expect(unpackRwaPerpsMarkets(result.props.markets).map((row) => row.id)).toEqual(['xyz:tsla', 'xyz:meta'])
	expect(result.props.venueType).toBe('DEX')
	expect(result.props.typeOpenInterest).toBe(440)
	expect(result.props.nav.active).toBe('XYZ Venue')
})
test('answers notFound for a listed venue the server has no market for', async () => {
	http.serve({ [`${base}/venue/XYZ%20Venue`]: fixtureStatus(404, { error: 'venue "XYZ Venue" not found' }) })
	await expect(venuePage.getStaticProps({ params: { venue: 'xyz-venue' } })).resolves.toMatchObject({ notFound: true })
})
test('throws on a failed venue markets request, so the last good page stays up', async () => {
	http.serve({ [`${base}/venue/XYZ%20Venue`]: fixtureStatus(500) })
	await expect(venuePage.getStaticProps({ params: { venue: 'xyz-venue' } })).rejects.toThrow('[500]')
})
test('throws on a failed all-markets request, so the last good page keeps its Share of DEX OI', async () => {
	http.serve({ [`${base}/current`]: fixtureStatus(500) })
	await expect(venuePage.getStaticProps({ params: { venue: 'xyz-venue' } })).rejects.toThrow('[500]')
})
test('throws when the Perps overview gets no market, so the last good page stays up', async () => {
	http.serve({ [`${base}/current`]: [] })
	await expect(overviewPage.getStaticProps({})).rejects.toThrow('Missing page data for route=/rwa/perps')
})
test('sends a perps address of an asset group with no perps markets to the Perps overview', async () => {
	metadata.seed({
		rwaList: {
			canonicalMarketIds: [],
			idMap: {},
			platforms: [],
			chains: [],
			categories: [],
			assetGroups: ['Private Credit']
		}
	})
	await expect(groupPage.getStaticProps({ params: { assetGroup: 'private-credit' } })).resolves.toMatchObject({
		redirect: { destination: '/rwa/perps', permanent: false }
	})
})
