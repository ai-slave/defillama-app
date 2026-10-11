import type { RWAPerpsContractOverlayRow } from './api.types'
import { normalizeRwaAssetGroup } from './assetGroup'
import { getRwaPlatforms, UNKNOWN_PLATFORM } from './grouping'
import type { IRWAPerpsMarket } from './Perps/api.types'
import { rwaSlug } from './rwaSlug'

export const getRealRwaPlatforms = (value: Parameters<typeof getRwaPlatforms>[0]) =>
	getRwaPlatforms(value).filter((platform) => platform !== UNKNOWN_PLATFORM && rwaSlug(platform) !== 'unknown')

export function toRWAPerpsContractOverlayRow(market: IRWAPerpsMarket): RWAPerpsContractOverlayRow {
	return {
		id: market.id,
		kind: 'perps',
		detailHref: `/rwa/perps/contract/${encodeURIComponent(market.contract)}`,
		contract: market.contract,
		venueType: market.venueType,
		assetName: market.referenceAsset ?? market.contract,
		ticker: market.contract,
		primaryChain: null,
		chain: null,
		price: market.price,
		priceChange24h: market.priceChange24h,
		openInterestChange24h: market.openInterestChange24h,
		volume7d: market.volume7d,
		fundingRate: market.fundingRate,
		fundingIntervalHours: market.fundingIntervalHours,
		premium: market.premium,
		maxLeverage: market.maxLeverage,
		protocolFees24h: market.estimatedProtocolFees24h,
		// Page props serialize to JSON, so a field an older payload lacks reads null, not undefined.
		timestamp: market.timestamp ?? null,
		venue: market.venue ?? null,
		volume24hChange24h: market.volume24hChange24h ?? null,
		volumeAllTime: market.volumeAllTime ?? null,
		oraclePrice: market.oraclePx ?? null,
		midPrice: market.midPx ?? null,
		previousDayPrice: market.prevDayPx ?? null,
		protocolFees7d: market.estimatedProtocolFees7d ?? null,
		protocolFees30d: market.estimatedProtocolFees30d ?? null,
		protocolFeesAllTime: market.estimatedProtocolFeesAllTime ?? null,
		pair: market.pair ?? null,
		marginAsset: market.marginAsset ?? null,
		settlementAsset: market.settlementAsset ?? null,
		sizeDecimals: market.szDecimals ?? null,
		makerFeeRate: market.makerFeeRate ?? null,
		takerFeeRate: market.takerFeeRate ?? null,
		oracleProvider: market.oracleProvider ?? null,
		website: market.website ?? null,
		openInterest: market.openInterest,
		volume24h: market.volume24h,
		volume30d: market.volume30d,
		assetGroup: market.referenceAssetGroup,
		parentPlatform: market.parentPlatform,
		category: market.category,
		assetClass: market.assetClass,
		accessModel: market.accessModel,
		type: 'Perp',
		rwaClassification: market.rwaClassification,
		issuer: market.issuer,
		redeemable: null,
		attestations: null,
		cexListed: null,
		kycForMintRedeem: null,
		kycAllowlistedWhitelistedToTransferHold: null,
		transferable: null,
		selfCustody: null,
		stablecoin: null,
		governance: null,
		trueRWA: false,
		suspicious: market.suspicious,
		suspiciousReason: null,
		onChainMcap: null,
		activeMcap: null,
		defiActiveTvl: null,
		defiActiveTvlByChain: null
	}
}

export function buildRWAPerpsContractOverlayRows({
	markets,
	selectedPlatform,
	selectedAssetGroup
}: {
	markets: Array<IRWAPerpsMarket>
	selectedPlatform?: string
	selectedAssetGroup?: string
}): Array<RWAPerpsContractOverlayRow> {
	const rows: Array<RWAPerpsContractOverlayRow> = []

	for (const market of markets) {
		const row = toRWAPerpsContractOverlayRow(market)
		const hasPlatformMatch = selectedPlatform
			? getRealRwaPlatforms(row.parentPlatform).some((platform) => rwaSlug(platform) === selectedPlatform)
			: true
		const hasAssetGroupMatch = selectedAssetGroup
			? rwaSlug(normalizeRwaAssetGroup(row.assetGroup)) === selectedAssetGroup
			: true

		if (!hasPlatformMatch || !hasAssetGroupMatch) {
			continue
		}

		rows.push(row)
	}

	return rows
}
