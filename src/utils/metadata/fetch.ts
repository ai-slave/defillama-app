import { COINS_SERVER_URL } from '~/constants'
import { rwaSlug } from '~/containers/RWA/rwaSlug'
import {
	buildUnlocksHistoricalPriceRequests,
	type UnlockHistoricalPriceProtocol
} from '~/utils/unlocks/historicalPriceRequests'
import type { CoreMetadataPayload } from './artifactContract'
import { buildChainDisplayNameLookupRecord, buildProtocolDisplayNameLookupRecord } from './displayLookups'
import { fetchMetadataJson } from './http'
import { extractLiquidationsTokenSymbols } from './liquidations'
import { fetchMetadataRouteIndexes } from './routeIndexes'
import { fetchCoreMetadataSources } from './sources'
import type { IEmissionsHistoricalPrices, ITokenListEntry } from './types'

const normalizeSlug = (value: string | null | undefined): string =>
	String(value ?? '')
		.toLowerCase()
		.replace(/ /g, '-')
		.replace(/'/g, '')

const EMISSIONS_HISTORICAL_PRICES_BATCH_SIZE = 50

async function fetchEmissionsHistoricalPrices(
	emissions: Array<UnlockHistoricalPriceProtocol>
): Promise<IEmissionsHistoricalPrices> {
	const { priceReqs, hasPriceRequests } = buildUnlocksHistoricalPriceRequests(emissions)
	if (!hasPriceRequests) return {}

	const prices: IEmissionsHistoricalPrices = {}
	let batchReqs: Record<string, Array<number>> = {}
	let batchCount = 0

	for (const [coin, requests] of Object.entries(priceReqs)) {
		batchReqs[coin] = requests
		batchCount++
		if (batchCount < EMISSIONS_HISTORICAL_PRICES_BATCH_SIZE) continue

		Object.assign(prices, await fetchEmissionsHistoricalPriceBatch(batchReqs))
		batchReqs = {}
		batchCount = 0
	}

	if (batchCount > 0) {
		Object.assign(prices, await fetchEmissionsHistoricalPriceBatch(batchReqs))
	}

	return prices
}

async function fetchEmissionsHistoricalPriceBatch(coins: Record<string, Array<number>>) {
	const response = await fetchMetadataJson<{ coins?: IEmissionsHistoricalPrices }>(
		`${COINS_SERVER_URL}/pro/prices/historical`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ coins, searchWidth: '6h' })
		}
	)
	if (!response.coins) throw new Error('Emissions historical prices response did not include coins')
	return response.coins
}

export async function fetchCoreMetadata(): Promise<CoreMetadataPayload> {
	const [
		{
			protocols,
			chains,
			categoriesAndTags,
			chainCategories,
			cexsResponse,
			rwaList,
			rwaPlatformsIndex,
			rwaProtocolMcapIndex,
			rwaPerpsList,
			tokenlistArray,
			tokenDirectory,
			liquidationsResponse,
			bridgesResponse,
			emissionsProtocolsList,
			emissionsSupplyMetrics,
			emissions,
			equitiesCompanyRoutes,
			preIpoCompanyIds,
			tokenFilterMetadata
		},
		routeIndexes
	] = await Promise.all([fetchCoreMetadataSources(), fetchMetadataRouteIndexes()])

	const tokenlist: Record<string, ITokenListEntry> = {}
	for (const t of tokenlistArray) {
		tokenlist[t.id] = {
			symbol: t.symbol,
			current_price: t.current_price ?? null,
			price_change_24h: t.price_change_24h ?? null,
			price_change_percentage_24h: t.price_change_percentage_24h ?? null,
			ath: t.ath ?? null,
			ath_date: t.ath_date ?? null,
			atl: t.atl ?? null,
			atl_date: t.atl_date ?? null,
			market_cap: t.market_cap ?? null,
			fully_diluted_valuation: t.fully_diluted_valuation ?? null,
			total_volume: t.total_volume ?? null,
			total_supply: t.total_supply ?? null,
			circulating_supply: t.circulating_supply ?? null,
			max_supply: t.max_supply ?? null
		}
	}

	const bridgeChainSlugToName: Record<string, string> = {}
	const bridgeProtocolSlugsSet = new Set<string>()
	const bridgeChainSlugsSet = new Set<string>()
	for (const bridge of bridgesResponse.bridges) {
		const fromApiSlug = normalizeSlug(bridge.slug)
		const fromDisplayName = normalizeSlug(bridge.displayName)
		if (fromApiSlug) bridgeProtocolSlugsSet.add(fromApiSlug)
		if (fromDisplayName) bridgeProtocolSlugsSet.add(fromDisplayName)

		const chainNames = [...bridge.chains]
		if (bridge.destinationChain && bridge.destinationChain !== 'false') {
			chainNames.push(bridge.destinationChain)
		}
		for (const chainName of chainNames) {
			const normalized = normalizeSlug(chainName)
			if (!normalized) continue
			bridgeChainSlugsSet.add(normalized)
			if (!bridgeChainSlugToName[normalized]) bridgeChainSlugToName[normalized] = chainName
		}
	}
	const bridgeProtocolSlugs = Array.from(bridgeProtocolSlugsSet)
	const bridgeChainSlugs = Array.from(bridgeChainSlugsSet)

	const protocolDisplayNames = buildProtocolDisplayNameLookupRecord(protocols)
	const chainDisplayNames = buildChainDisplayNameLookupRecord(chains)
	const liquidationsTokenSymbols = extractLiquidationsTokenSymbols(liquidationsResponse)
	const emissionsHistoricalPrices = await fetchEmissionsHistoricalPrices(emissions)
	const platformRoutesBySlug = new Map<string, { name: string; slug: string }>()
	for (const platform of rwaList.platforms) {
		const slug = rwaSlug(platform)
		if (slug) platformRoutesBySlug.set(slug, { name: platform, slug })
	}
	for (const slug in rwaPlatformsIndex.platforms) {
		const platform = rwaPlatformsIndex.platforms[slug]
		if (!platform) continue
		const nameSlug = rwaSlug(platform.name)
		if (nameSlug !== platform.slug) platformRoutesBySlug.delete(nameSlug)
		platformRoutesBySlug.set(platform.slug, { name: platform.name, slug: platform.slug })
	}
	const platformRoutes = Array.from(platformRoutesBySlug.values())
	const platformNames = platformRoutes.map((platform) => platform.name)

	// Stamp the RWA platform onto the protocol it declares in the sheet, so every protocol
	// route can offer the RWA tab without re-resolving the index.
	const platformSlugByProtocolSlug = rwaPlatformsIndex.byProtocolSlug ?? {}
	// Superset of the above, including children of a declared parent. Kept separate because the RWA
	// tab renders the whole parent platform — a child may redirect there but must not host the tab.
	const redirectSlugByProtocolSlug = rwaPlatformsIndex.redirectByProtocolSlug ?? {}
	// Protocols credited with issuing RWA assets of their own. These headline that number instead
	// of the platform aggregate, which on a single-product child is the whole parent book.
	// Keyed by protocol id, NOT by a re-derived slug. The index slug is the server's
	// `sluggifyString(protocol.name)`; deriving a key here from `displayName` only works while that
	// field and the server's `name` agree AND the two slug helpers stay byte-identical across the
	// repos. Both hold today (all 56 entries match), but either drifting would silently drop a
	// protocol back onto the parent aggregate with no error. The stored value is the index's own
	// slug because that is what the chart file is keyed on server-side.
	const protocolMcapSlugById = new Map(
		(rwaProtocolMcapIndex?.protocols ?? []).map((entry) => [String(entry.protocolId), entry.slug])
	)
	for (const protocolId in protocols) {
		const protocol = protocols[protocolId]
		if (!protocol) continue
		const protocolSlug = normalizeSlug(protocol.displayName || protocol.name)
		const platformSlug = platformSlugByProtocolSlug[protocolSlug]
		if (platformSlug) protocol.rwaPlatformSlug = platformSlug
		const redirectSlug = redirectSlugByProtocolSlug[protocolSlug]
		if (redirectSlug) protocol.rwaPlatformRedirectSlug = redirectSlug
		const protocolMcapSlug = protocolMcapSlugById.get(protocolId)
		if (protocolMcapSlug) protocol.rwaProtocolMcapSlug = protocolMcapSlug
	}

	return {
		protocols,
		chains,
		categoriesAndTags,
		chainCategories,
		cexs: cexsResponse.cexs,
		cgExchangeIdentifiers: cexsResponse.cg_volume_cexs,
		rwaList: { ...rwaList, platforms: platformNames, platformRoutes },
		rwaPlatformsIndex,
		rwaPerpsList,
		tokenlist,
		tokenDirectory,
		protocolDisplayNames,
		chainDisplayNames,
		liquidationsTokenSymbols,
		emissionsProtocolsList,
		emissionsSupplyMetrics,
		emissionsHistoricalPrices,
		bridgeProtocolSlugs,
		bridgeChainSlugs,
		bridgeChainSlugToName,
		narrativeCategories: routeIndexes.narrativeCategories,
		oracleRoutes: routeIndexes.oracleRoutes,
		digitalAssetTreasuryRoutes: routeIndexes.digitalAssetTreasuryRoutes,
		stablecoinPeggedAssetSlugs: routeIndexes.stablecoinPeggedAssetSlugs,
		equitiesCompanyRoutes,
		preIpoCompanyIds,
		tokenFilterMetadata
	}
}
