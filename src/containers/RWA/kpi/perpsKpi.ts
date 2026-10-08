import type { RWAOverviewDisplayRow } from '../api.types'
import { foldRwaPerpsTotals, getRwaPerpsMarkets, type RwaPerpsTotals } from '../cards/cardData'
import { aggregateRwaGroupMetrics, collectRwaGroupDistinct } from '../table/grouping'
import { buildRwaLeafRows } from '../table/rows'

export type RwaPerpsKpi = RwaPerpsTotals & {
	markets: number
	venues: number
	/** Distinct reference assets, as the table's Asset column names them. */
	referenceAssets: number
	assetGroups: number
	volume7d: number | null
	volume30d: number | null
	volumeAllTime: number | null
	/** 30 day volume over open interest: how many times the open book turned over. */
	turnover30d: number | null
	fees24h: number | null
	fees7d: number | null
	fees30d: number | null
	feesAllTime: number | null
}

/** 30 day volume over open interest, for the card and the table column alike; a gap without either. */
export function getRwaPerpsTurnover(volume30d: number | null, openInterest: number | null): number | null {
	return volume30d == null || !openInterest ? null : volume30d / openInterest
}

/** Every number a perps Key Metrics card shows: the perps totals plus the group row fold, over the markets Venue Type
    keeps (`includeCex` false under DEX only). `everyVenueType` is the same page before the Venue Type choice: the DEX
    share reads over both types, so DEX only never reads 100% and CEX only never 0%. */
export function foldRwaPerpsKpi(
	assets: Array<RWAOverviewDisplayRow>,
	includeCex: boolean,
	everyVenueType: Array<RWAOverviewDisplayRow> = assets
): RwaPerpsKpi {
	const markets = getRwaPerpsMarkets(assets, includeCex)
	const rows = buildRwaLeafRows(markets, { includeBridgeTvl: true })
	const metrics = aggregateRwaGroupMetrics(rows)
	const distinct = collectRwaGroupDistinct(rows)
	const totals = foldRwaPerpsTotals(markets)
	return {
		...totals,
		dexShare: foldRwaPerpsTotals(getRwaPerpsMarkets(everyVenueType, true)).dexShare,
		markets: markets.length,
		venues: new Set(markets.map((market) => market.venue).filter((venue) => !!venue)).size,
		referenceAssets: distinct.asset.length,
		assetGroups: distinct.assetGroup.length,
		volume7d: metrics.volume7d,
		volume30d: metrics.volume30d,
		volumeAllTime: metrics.volumeAllTime,
		turnover30d: getRwaPerpsTurnover(metrics.volume30d, totals.openInterest),
		fees24h: metrics.protocolFees24h,
		fees7d: metrics.protocolFees7d,
		fees30d: metrics.protocolFees30d,
		feesAllTime: metrics.protocolFeesAllTime
	}
}
