import type {
	MasterChartColumnarResponse,
	MasterChartMetric,
	MasterChartPart,
	MasterColumnarSeriesResponse,
	MasterDirectoryResponse,
	MasterExecutionPairMetrics,
	MasterExecutionQualityResponse,
	MasterQualityRanksResponse,
	MasterRankMethodologyResponse,
	MasterDirectoryVenue,
	MasterEntityScope,
	MasterExchangeIndexResponse,
	MasterExchangeMetadataResponse,
	MasterExchangePair,
	MasterLiquidityRelation,
	MasterMetadataField,
	MasterMetadataGroup,
	MasterMetadataKpi,
	MasterMicaResponse,
	MasterMicaVenue,
	MasterPromotion,
	MasterRampCost,
	MasterRelatedEntity,
	MasterSegment,
	MasterSegmentNormalizedVolume,
	MasterVenueCore
} from './master.types'
import { MASTER_SEGMENTS } from './master.types'
import { sumNullable } from './modelHelpers'
import {
	EXCHANGE_SEGMENTS,
	type ExchangeDirectoryModel,
	type ExchangeDirectoryRowModel,
	type ExchangeEeaOrderbookOwnership,
	type ExchangeExecutionModel,
	type ExchangeExecutionPairModel,
	type ExchangeProfileQualityModel,
	type ExchangeFiatFees,
	type ExchangeMetadataFieldModel,
	type ExchangeMetadataGroupModel,
	type ExchangeMetadataKpiModel,
	type ExchangeNormalizedVolume,
	type ExchangeOverviewChartModel,
	type ExchangePairModel,
	type ExchangeProfileModel,
	type ExchangePromotionModel,
	type ExchangeResearchChartModel,
	type ExchangeResearchReportModel,
	type ExchangeResearchView,
	type ExchangeSegment,
	type MicaVenueModel
} from './models'
import { getResearchPresentation } from './researchPresentation'

/** Index a columnar `{ days, key, series }` payload into a `key -> values` map aligned to `days`.
 * A null column means the metric is unsupported for the venue and is omitted from the map. */
function parseColumnarSeries(response: MasterColumnarSeriesResponse): Record<string, Array<number | null>> {
	if (response.series.length !== response.key.length) {
		throw new Error('Series columns do not match the key axis')
	}
	const byKey: Record<string, Array<number | null>> = {}
	for (const [index, key] of response.key.entries()) {
		const values = response.series[index]
		if (values === undefined) throw new Error(`Missing series column ${key}`)
		if (values === null) continue
		if (values.length !== response.days.length) throw new Error(`Series column ${key} does not match the day axis`)
		byKey[key] = values
	}
	return byKey
}

function requiredCapability(venue: MasterDirectoryVenue, segment: ExchangeSegment) {
	const capability = venue.capabilities[segment]
	if (!capability) throw new Error(`Missing ${segment} capabilities for ${venue.slug}`)
	return capability
}

function mapFiatFees(fees: NonNullable<MasterDirectoryVenue['funding']>['fiat_fees']): ExchangeFiatFees | null {
	if (fees === null) return null
	const mapRow = (row: (typeof fees.on_ramp)[number]) => ({
		currency: row.currency,
		fee: row.fee,
		method: row.method,
		minimum: row.min,
		note: row.note,
		source: row.src,
		processingTime: row.time
	})
	return { onRamp: fees.on_ramp.map(mapRow), offRamp: fees.off_ramp.map(mapRow) }
}

/** The backend resolves one destination; split it so the frontend referral override keeps priority. */
function websiteDestination(core: Pick<MasterVenueCore, 'links'>): {
	websiteUrl: string | null
	referralUrl: string | null
} {
	const website = core.links.website
	if (!website) return { websiteUrl: null, referralUrl: null }
	return website.kind === 'referral'
		? { websiteUrl: null, referralUrl: website.url }
		: { websiteUrl: website.url, referralUrl: null }
}

function isEeaRegionalScope(scope: MasterEntityScope): boolean {
	return scope.kind === 'regional' && scope.regions.includes('eea')
}

/** Summarize the required per-segment liquidity relations for an EEA entity. */
function deriveEeaOrderbookOwnership(
	venue: Pick<MasterVenueCore, 'scope' | 'liquidity'>
): ExchangeEeaOrderbookOwnership | null {
	if (!isEeaRegionalScope(venue.scope)) return null
	const sharedSegments: ExchangeSegment[] = []
	const dedicatedSegments: ExchangeSegment[] = []
	for (const segment of MASTER_SEGMENTS) {
		const relation = venue.liquidity[segment]
		if (relation?.mode === 'shared') sharedSegments.push(segment)
		if (relation?.mode === 'own') dedicatedSegments.push(segment)
	}
	if (sharedSegments.length === 0 && dedicatedSegments.length === 0) return null
	if (sharedSegments.length === 0) return { mode: 'own' }
	if (dedicatedSegments.length === 0) return { mode: 'shared' }
	return { mode: 'mixed', sharedSegments, dedicatedSegments }
}

function relatedEntityModel(
	entity: MasterRelatedEntity | null,
	venuesBySlug: Map<string, MasterDirectoryVenue>
): ExchangeDirectoryRowModel['related']['euEntity'] {
	if (entity === null) return null
	const venue = venuesBySlug.get(entity.slug)
	if (!venue) return null
	return {
		slug: entity.slug,
		name: entity.name,
		profileHref: venue.links.profile
	}
}

function relatedEntities(
	venue: MasterDirectoryVenue,
	venuesBySlug: Map<string, MasterDirectoryVenue>
): ExchangeDirectoryRowModel['related'] {
	const globalEntity =
		venue.parent_entity && venue.parent_entity.scope.kind === 'global'
			? venue.parent_entity
			: (venue.related_entities.find((entity) => entity.scope.kind === 'global') ?? null)
	const euEntity = venue.related_entities.find((entity) => isEeaRegionalScope(entity.scope)) ?? null
	return {
		euEntity: relatedEntityModel(euEntity, venuesBySlug),
		globalEntity: relatedEntityModel(globalEntity, venuesBySlug)
	}
}

function mapLiquidityRelation(
	relation: MasterLiquidityRelation | null
): ExchangeDirectoryRowModel['liquidity'][MasterSegment] {
	if (relation === null) return null
	if (relation.mode === 'own') return { mode: 'own' }
	return {
		mode: 'shared',
		coverage: relation.coverage,
		source: { slug: relation.source.slug, name: relation.source.name }
	}
}

function mapNormalizedVolume(nvol: MasterSegmentNormalizedVolume | null): ExchangeNormalizedVolume | null {
	if (nvol === null) return null
	return {
		reported: nvol.reported,
		normalized: nvol.normalized,
		activeLiquidity: nvol.active_liquidity,
		discountFraction: nvol.discount_pct,
		unverifiedFraction: nvol.unverified_pct,
		flag: nvol.flag
	}
}

function mapDirectoryVenue(
	venue: MasterDirectoryVenue,
	venuesBySlug: Map<string, MasterDirectoryVenue>,
	execution: MasterExecutionQualityResponse | null
): ExchangeDirectoryRowModel {
	const executionMetrics = execution?.venues[venue.slug] ?? null
	const segments: ExchangeDirectoryRowModel['segments'] = {}
	for (const segment of EXCHANGE_SEGMENTS) {
		const stats = venue.segments[segment]
		if (!stats) continue
		const capability = requiredCapability(venue, segment)
		const doubleCount = stats.doublecount
			? {
					...(stats.doublecount.volume ? { volume: stats.doublecount.volume } : null),
					...(stats.doublecount.oi ? { openInterest: stats.doublecount.oi } : null),
					...(stats.doublecount.depth ? { depth: stats.doublecount.depth } : null)
				}
			: null
		segments[segment] = {
			marketCount: stats.markets,
			coinCount: stats.coins,
			volume24h: stats.volume_24h,
			volumePrevious24h: stats.volume_prev_24h,
			openInterestUsd: stats.oi_usd ?? null,
			openInterestPreviousUsd: stats.oi_prev_usd ?? null,
			depthBidUsd: stats.depth_2pct_bid_usd,
			depthAskUsd: stats.depth_2pct_ask_usd,
			depthPartial: stats.depth_partial,
			volumeUpdatedAt: stats.freshness.volume,
			...(doubleCount ? { doubleCount } : null),
			supportsOpenInterest: capability.oi,
			supportsDepth: capability.depth
		}
	}

	const { websiteUrl, referralUrl } = websiteDestination(venue)
	const hasNormalizedVolume = MASTER_SEGMENTS.some((segment) => venue.nvol[segment] !== null)
	const defillama = venue.links.defillama

	return {
		slug: venue.slug,
		name: venue.display_name,
		kind: venue.type,
		tracked: venue.tracked,
		totalVolume24h: venue.totals.total_trading_volume_24h,
		profileHref: venue.links.profile,
		// Cex-type defillama links now live on the venue's own Reserves tab;
		// linking /cex/:slug directly would just bounce off a permanent redirect.
		secondaryUrl: defillama && defillama.type !== 'cex' ? defillama.url : null,
		reservesHref: defillama?.type === 'cex' ? `/exchange/${venue.slug}?section=reserves` : null,
		websiteUrl,
		referralUrl,
		related: relatedEntities(venue, venuesBySlug),
		parent: venue.parent_entity ? { slug: venue.parent_entity.slug, name: venue.parent_entity.name } : null,
		liquidity: {
			spot: mapLiquidityRelation(venue.liquidity.spot),
			linear_perp: mapLiquidityRelation(venue.liquidity.linear_perp),
			inverse_perp: mapLiquidityRelation(venue.liquidity.inverse_perp)
		},
		segments,
		sparks: venue.sparks,
		reserves: venue.reserves
			? {
					totalUsd: venue.reserves.total_usd,
					cleanUsd: venue.reserves.clean_usd,
					ownTokenFraction: venue.reserves.own_token_pct,
					inflows24hUsd: venue.reserves.inflows_24h_usd,
					inflows7dUsd: venue.reserves.inflows_7d_usd,
					inflows1mUsd: venue.reserves.inflows_1m_usd,
					auditor: venue.reserves.auditor,
					sourceUrl: venue.reserves.source_url
				}
			: null,
		fees: venue.fees
			? {
					spot: venue.fees.spot,
					linearPerp: venue.fees.linear_perp,
					inversePerp: venue.fees.inverse_perp,
					feeToken: venue.fees.fee_token
						? {
								symbol: venue.fees.fee_token.symbol,
								discountFraction:
									venue.fees.fee_token.discount_pct == null ? null : venue.fees.fee_token.discount_pct / 100
							}
						: null
				}
			: null,
		compliance: venue.compliance
			? {
					headquarters: venue.compliance.hq,
					euStatus: venue.compliance.eu_status,
					eeaOrderbookOwnership: deriveEeaOrderbookOwnership(venue),
					mica: venue.compliance.mica
						? {
								status: venue.compliance.mica.status,
								licensed: venue.compliance.mica.licensed,
								memberState: venue.compliance.mica.member_state,
								regulator: venue.compliance.mica.regulator
							}
						: null,
					licenseCount: venue.compliance.license_count,
					kyc: venue.compliance.kyc
				}
			: null,
		profile: venue.profile
			? {
					founded: venue.profile.founded,
					nativeToken: venue.profile.native_token
				}
			: null,
		funding: venue.funding
			? {
					fiatCurrencies: venue.funding.fiat_currencies,
					fiatFees: mapFiatFees(venue.funding.fiat_fees),
					hasFiatOnramp: venue.funding.has_fiat_onramp,
					rampCost: venue.funding.ramp_cost_1k ? mapRampCost(venue.funding.ramp_cost_1k) : null
				}
			: null,
		warnings: venue.warnings,
		regional: venue.regional,
		selectedCountry: null,
		selectedCountryStatus: null,
		normalizedVolume: hasNormalizedVolume
			? {
					spot: mapNormalizedVolume(venue.nvol.spot),
					linear_perp: mapNormalizedVolume(venue.nvol.linear_perp),
					inverse_perp: mapNormalizedVolume(venue.nvol.inverse_perp)
				}
			: null,
		execution: executionMetrics
			? {
					assets: executionMetrics.assets,
					hoursCovered: executionMetrics.hours_covered,
					costToTradeBps: executionMetrics.cost_to_trade_bps,
					realizedSlippage10kBps: executionMetrics.realized_slippage_bps_10k,
					predictedSlippage10kBps: executionMetrics.predicted_slippage_bps_10k,
					markout1mBps: executionMetrics.markout_bps_1m
				}
			: null,
		quality: venue.rank ?? null
	}
}

/** Base row order: internal quality score descending, tie-broken on rank. Score is
 * comparable across CEX and DEX; `rank` is the position within a venue's own kind and
 * only breaks ties here. Unranked venues sort last, by volume — the part a column sort
 * can't express, which is why this pre-sort stays even though the table now ALSO
 * carries the ranking as a visible, sortable Rank column with a default sort (see
 * DirectoryTable sortingFor): the stable pre-order supplies the tie/fallback order
 * underneath TanStack's stable sort. */
function byQualityRank(a: ExchangeDirectoryRowModel, b: ExchangeDirectoryRowModel): number {
	if (a.quality && b.quality) return b.quality.score - a.quality.score || a.quality.rank - b.quality.rank
	if (a.quality) return -1
	if (b.quality) return 1
	return (b.totalVolume24h ?? 0) - (a.totalVolume24h ?? 0)
}

/** Cross-venue perp OI is not part of DirectoryTotals; sum venues within one
 * exact segment while excluding shared-book segments exactly as the backend's
 * own totals do. Linear and inverse totals are never combined. */
function directoryOpenInterest(venues: MasterDirectoryVenue[], segment: MasterSegment): number | null {
	let total = 0
	let observed = false
	for (const venue of venues) {
		if (venue.liquidity[segment]?.mode === 'shared') continue
		const openInterest = venue.segments[segment]?.oi_usd
		if (openInterest == null) continue
		total += openInterest
		observed = true
	}
	return observed ? total : null
}

export function mapMasterDirectory(
	response: MasterDirectoryResponse,
	execution: MasterExecutionQualityResponse | null
): ExchangeDirectoryModel {
	const venuesBySlug = new Map<string, MasterDirectoryVenue>()
	for (const venue of response.venues) venuesBySlug.set(venue.slug, venue)
	const rows = new Array<ExchangeDirectoryRowModel>(response.venues.length)
	for (let index = 0; index < response.venues.length; index++) {
		const venue = response.venues[index]
		if (!venue) throw new Error(`Missing directory venue at index ${index}`)
		rows[index] = mapDirectoryVenue(venue, venuesBySlug, execution)
	}
	rows.sort(byQualityRank)
	const volumeSplit = (totals: {
		spot_volume_24h: number | null
		linear_perp_volume_24h: number | null
		inverse_perp_volume_24h: number | null
		total_trading_volume_24h: number | null
	}) => ({
		spot: totals.spot_volume_24h,
		linearPerp: totals.linear_perp_volume_24h,
		inversePerp: totals.inverse_perp_volume_24h,
		total: totals.total_trading_volume_24h
	})
	return {
		rows,
		summary: {
			venueCount: response.totals.venues,
			trackedVenueCount: response.totals.tracked,
			totalVolume24h: response.totals.total_trading_volume_24h,
			spotVolume24h: response.totals.spot_volume_24h,
			linearPerpVolume24h: response.totals.linear_perp_volume_24h,
			inversePerpVolume24h: response.totals.inverse_perp_volume_24h,
			linearPerpOpenInterestUsd: directoryOpenInterest(response.venues, 'linear_perp'),
			inversePerpOpenInterestUsd: directoryOpenInterest(response.venues, 'inverse_perp'),
			reservesUsd: response.totals.reserves_usd,
			volumeByKind: {
				cex: volumeSplit(response.totals.cex),
				dex: volumeSplit(response.totals.dex)
			}
		},
		updatedAt: response.last_updated,
		executionAvailable: execution !== null
	}
}

function depthAt(values: Array<number | null> | null, index: number, pair: string): number | null {
	if (values === null) return null
	const value = values[index]
	if (value === undefined) throw new Error(`Depth array for ${pair} does not match depth_bands`)
	return value
}

function spreadFraction(pair: MasterExchangePair): number | null {
	if (pair.best_bid == null || pair.best_ask == null) return null
	const mid = (pair.best_bid + pair.best_ask) / 2
	return mid > 0 ? (pair.best_ask - pair.best_bid) / mid : null
}

export function mapExchangePair(
	pair: MasterExchangePair,
	depthBands: number[],
	segment: ExchangeSegment
): ExchangePairModel {
	const twoPercentIndex = depthBands.indexOf(0.02)
	if (twoPercentIndex < 0) throw new Error('Profile depth_bands omits the required ±2% band')
	return {
		pairUrl: pair.pair_url,
		symbol: pair.symbol,
		base: pair.base,
		quote: pair.quote,
		baseGeckoId: pair.base_coingecko_id,
		quoteGeckoId: pair.quote_coingecko_id,
		price: pair.price,
		markPrice: pair.mark_price,
		indexPrice: pair.index_price,
		basis:
			pair.mark_price != null && pair.index_price != null && pair.index_price !== 0
				? pair.mark_price / pair.index_price - 1
				: null,
		priceChange24h: pair.price_change_24h,
		volume24h: pair.volume_24h,
		volumeChange24h: pair.volume_change_24h,
		openInterestUsd: pair.oi_usd,
		openInterestChange24h: pair.oi_change_24h,
		fundingRate8h: pair.funding_rate_8h,
		fundingPeriodHours: pair.funding_period_h,
		nextFundingAt: pair.next_funding_ts,
		maxLeverage: pair.max_leverage,
		makerFee: pair.maker_fee,
		takerFee: pair.taker_fee,
		listedAt: pair.listed_ts,
		volumeUpdatedAt: pair.freshness.volume,
		spreadFraction: spreadFraction(pair),
		depthBid2Usd: depthAt(pair.depth_bid_usd, twoPercentIndex, pair.market_id),
		depthAsk2Usd: depthAt(pair.depth_ask_usd, twoPercentIndex, pair.market_id),
		depthBidMaxDistance: pair.depth_bid_max_dist,
		depthAskMaxDistance: pair.depth_ask_max_dist,
		normalizedVolume:
			segment !== 'inverse_perp' && pair.nvol
				? {
						reported: pair.nvol.reported,
						normalized: pair.nvol.normalized,
						activeLiquidity: pair.nvol.active_liquidity,
						discountFraction: (pair.nvol.reported - pair.nvol.normalized) / pair.nvol.reported,
						status: pair.nvol.status
					}
				: null
	}
}

function mapMetadataField(field: MasterMetadataField): ExchangeMetadataFieldModel {
	return { ...field }
}

function mapMetadataKpi(field: MasterMetadataKpi): ExchangeMetadataKpiModel {
	return { ...field, comparable: true }
}

function mapMetadataGroup(group: MasterMetadataGroup): ExchangeMetadataGroupModel {
	return {
		key: group.key,
		title: group.title,
		...(group.fromPor !== undefined ? { fromProofOfReserves: group.fromPor } : null),
		fields: group.fields.map(mapMetadataField),
		...(group.source ? { source: group.source } : null)
	}
}

function twitterUrl(groups: MasterMetadataGroup[]): string | null {
	for (const group of groups) {
		if (group.key !== 'links') continue
		for (const field of group.fields) {
			const links = field.type === 'links' ? field.value : field.type === 'link' ? [field.value] : []
			for (const link of links) {
				const label = link.label.toLowerCase()
				if (label.includes('twitter') || label === 'x') return link.url
			}
		}
	}
	return null
}

function mapPromotion(promotion: MasterPromotion): ExchangePromotionModel {
	return {
		label: promotion.label,
		title: promotion.title,
		subtitle: promotion.subtitle ?? null,
		url: promotion.url ?? null,
		termsUrl: promotion.terms_url ?? null,
		startsAt: promotion.starts_at ?? null,
		endsAt: promotion.ends_at ?? null,
		priority: promotion.priority ?? null,
		sourceUrl: promotion.source.url
	}
}

function mapRampCost(cost: MasterRampCost): NonNullable<MicaVenueModel['rampCost']> {
	return {
		notionalUsd: cost.notional_usd,
		pair: cost.pair,
		onRamp: {
			fiatFeeUsd: cost.on_ramp.fiat_fee_usd,
			tradeFeeUsd: cost.on_ramp.trade_fee_usd,
			slippageUsd: cost.on_ramp.slippage_usd,
			transferFeeUsd: cost.on_ramp.transfer_fee_usd,
			totalUsd: cost.on_ramp.total_usd,
			totalFraction: cost.on_ramp.total_pct
		},
		offRamp: {
			fiatFeeUsd: cost.off_ramp.fiat_fee_usd,
			tradeFeeUsd: cost.off_ramp.trade_fee_usd,
			slippageUsd: cost.off_ramp.slippage_usd,
			transferFeeUsd: cost.off_ramp.transfer_fee_usd,
			totalUsd: cost.off_ramp.total_usd,
			totalFraction: cost.off_ramp.total_pct
		},
		assumptions: {
			method: cost.assumptions.method,
			takerFee: cost.assumptions.taker_fee,
			halfSpreadFraction: cost.assumptions.half_spread_pct,
			btcWithdrawalFeeBtc: cost.assumptions.btc_withdrawal_fee_btc,
			btcNetworkFeeBtc: cost.assumptions.btc_network_fee_btc,
			btcPriceUsd: cost.assumptions.btc_price_usd
		}
	}
}

export function mapMasterProfileMetadata(metadata: MasterExchangeMetadataResponse): ExchangeProfileModel['metadata'] {
	const { websiteUrl, referralUrl } = websiteDestination(metadata)
	return {
		website: websiteUrl,
		referralUrl,
		twitterUrl: twitterUrl(metadata.groups),
		promotions: metadata.promotions.map(mapPromotion),
		kpis: metadata.kpis.map(mapMetadataKpi),
		groups: metadata.groups.map(mapMetadataGroup)
	}
}

function mapDefillamaCexSlug(metadata: MasterExchangeMetadataResponse): string | null {
	const defillama = metadata.links.defillama
	return defillama?.type === 'cex' ? defillama.slug : null
}

function mapNativeToken(metadata: MasterExchangeMetadataResponse): ExchangeProfileModel['nativeToken'] {
	return metadata.native_token
		? {
				coinId: metadata.native_token.coingecko_id,
				name: metadata.native_token.name,
				symbol: metadata.native_token.symbol,
				url: metadata.native_token.url,
				priceUsd: null,
				change24h: null
			}
		: null
}

export function mapMasterMetadataOnlyProfile(metadata: MasterExchangeMetadataResponse): ExchangeProfileModel {
	return {
		slug: metadata.slug,
		name: metadata.display_name,
		kind: metadata.type,
		profileMode: metadata.profile_mode,
		execution: null,
		quality: null,
		defillamaUrl: metadata.links.defillama?.url ?? null,
		defillamaCexSlug: mapDefillamaCexSlug(metadata),
		nativeToken: mapNativeToken(metadata),
		hacks: [],
		raises: [],
		reserves: null,
		segments: {},
		metadata: mapMasterProfileMetadata(metadata)
	}
}

const mapExecutionPair = (pair: MasterExecutionPairMetrics): ExchangeExecutionPairModel => ({
	asset: pair.asset,
	hoursCovered: pair.hours_covered,
	fillCount: pair.n_trades,
	costToTradeBps: pair.cost_to_trade_bps,
	effectiveSpreadBps: pair.effective_spread_bps,
	quotedSpreadBps: pair.quoted_spread_bps,
	realizedSlippage10kBps: pair.realized_slippage_bps_10k,
	predictedSlippage10kBps: pair.predicted_slippage_bps_10k,
	realizedSlippage100kBps: pair.realized_slippage_bps_100k,
	predictedSlippage100kBps: pair.predicted_slippage_bps_100k,
	realizedSlippage1mBps: pair.realized_slippage_bps_1m,
	predictedSlippage1mBps: pair.predicted_slippage_bps_1m,
	markout1sBps: pair.markout_bps_1s,
	markout15sBps: pair.markout_bps_15s,
	markout1mBps: pair.markout_bps_1m,
	markout5mBps: pair.markout_bps_5m
})

function mapProfileExecution(
	slug: string,
	execution: MasterExecutionQualityResponse | null
): ExchangeExecutionModel | null {
	const venue = execution?.venues[slug]
	if (!venue) return null
	const pairs: ExchangeExecutionPairModel[] = []
	for (const asset of execution.basket) {
		const pair = venue.pairs[asset]
		if (pair) pairs.push(mapExecutionPair(pair))
	}
	return {
		assets: venue.assets,
		hoursCovered: venue.hours_covered,
		costToTradeBps: venue.cost_to_trade_bps,
		realizedSlippage10kBps: venue.realized_slippage_bps_10k,
		predictedSlippage10kBps: venue.predicted_slippage_bps_10k,
		markout1mBps: venue.markout_bps_1m,
		feed: venue.feed
			? {
					date: venue.feed.date,
					avgGapMs: venue.feed.avg_gap_ms,
					p99GapMs: venue.feed.p99_gap_ms,
					maxGapMs: venue.feed.max_gap_ms,
					downtimeS: venue.feed.downtime_s,
					degraded: venue.feed.degraded
				}
			: null,
		pairs
	}
}

function mapProfileQuality(
	slug: string,
	ranks: MasterQualityRanksResponse | null,
	methodology: MasterRankMethodologyResponse | null
): ExchangeProfileQualityModel | null {
	if (ranks === null || methodology === null) return null
	if (methodology.ranks_generated_at !== ranks.generated_at) return null
	const entry = ranks.venues[slug]
	if (!entry) return null
	let overallRank = 1
	let overallTotal = 0
	for (const venueSlug in ranks.venues) {
		const venue = ranks.venues[venueSlug]
		if (!venue) continue
		overallTotal++
		if (venue.score > entry.score) overallRank++
	}
	const definitionsByKey = new Map<string, MasterRankMethodologyResponse['components'][number]>()
	for (const definition of methodology.components) definitionsByKey.set(definition.key, definition)
	const components: ExchangeProfileQualityModel['components'] = []
	for (const key in entry.components) {
		const definition = definitionsByKey.get(key)
		if (!definition) return null
		components.push({
			key,
			label: definition.label,
			weight: definition.weight,
			score: entry.components[key] ?? null,
			what: definition.what,
			na: definition.na
		})
	}
	components.sort((a, b) => b.weight - a.weight)
	const execSubs: ExchangeProfileQualityModel['execSubs'] = []
	if (entry.exec_subs) {
		for (const definition of methodology.exec_subs) {
			const score = entry.exec_subs[definition.key]
			if (score === undefined) continue
			execSubs.push({
				key: definition.key,
				label: definition.label,
				weight: definition.weight,
				score,
				what: definition.what
			})
		}
	}
	return {
		score: entry.score,
		tier: entry.tier,
		rankInKind: entry.rank,
		overallRank,
		overallTotal,
		generatedAt: ranks.generated_at,
		components,
		execSubs
	}
}

export interface MasterProfileExtras {
	execution: MasterExecutionQualityResponse | null
	ranks: MasterQualityRanksResponse | null
	methodology: MasterRankMethodologyResponse | null
}

export function mapMasterProfile(
	index: MasterExchangeIndexResponse,
	metadata: MasterExchangeMetadataResponse,
	extras: MasterProfileExtras
): ExchangeProfileModel {
	const segments: ExchangeProfileModel['segments'] = {}
	for (const segment of EXCHANGE_SEGMENTS) {
		const stats = index.segments[segment]
		if (!stats) continue
		const capability = index.capabilities[segment]
		if (!capability) throw new Error(`Missing ${segment} capabilities for ${index.slug}`)
		const pairs = new Array<ExchangePairModel>(stats.pairs.length)
		let depth2Usd = 0
		let hasDepth = false
		for (let pairIndex = 0; pairIndex < stats.pairs.length; pairIndex++) {
			const pair = stats.pairs[pairIndex]
			if (!pair) throw new Error(`Missing ${segment} pair at index ${pairIndex}`)
			const mapped = mapExchangePair(pair, index.depth_bands, segment)
			pairs[pairIndex] = mapped
			if (mapped.depthBid2Usd !== null) {
				depth2Usd += mapped.depthBid2Usd
				hasDepth = true
			}
			if (mapped.depthAsk2Usd !== null) {
				depth2Usd += mapped.depthAsk2Usd
				hasDepth = true
			}
		}
		segments[segment] = {
			segment,
			marketCount: stats.markets,
			volume24h: stats.volume_24h,
			volumePrevious24h: stats.volume_prev_24h,
			openInterestUsd: stats.oi_usd ?? null,
			openInterestPreviousUsd: stats.oi_prev_usd ?? null,
			depth2Usd: hasDepth ? depth2Usd : null,
			capabilities: {
				openInterest: capability.oi,
				funding: capability.funding,
				depth: capability.depth
			},
			pairs
		}
	}

	return {
		slug: index.slug,
		name: metadata.display_name,
		kind: index.type,
		profileMode: metadata.profile_mode,
		execution: mapProfileExecution(index.slug, extras.execution),
		quality: mapProfileQuality(index.slug, extras.ranks, extras.methodology),
		defillamaUrl: metadata.links.defillama?.url ?? null,
		defillamaCexSlug: mapDefillamaCexSlug(metadata),
		nativeToken: mapNativeToken(metadata),
		hacks: [],
		raises: [],
		reserves: null,
		segments,
		metadata: mapMasterProfileMetadata(metadata)
	}
}

export function mapMasterDirectoryOverview(response: MasterColumnarSeriesResponse): ExchangeOverviewChartModel {
	return {
		days: response.days,
		lastUpdated: response.last_updated,
		series: parseColumnarSeries(response)
	}
}

const TOP_VENUE_COUNT = 8
type NullableSeries = ReadonlyArray<number | null>

/** Exact segment vocabulary for chart lines: perpetual classes are never summed. */
interface ChartSegmentSpec {
	metric: 'spot' | 'linear_perp' | 'inverse_perp'
	reported: MasterChartMetric
	label: string
}

const CHART_SEGMENTS = [
	{ metric: 'spot', reported: 'reported_spot', label: 'Spot' },
	{ metric: 'linear_perp', reported: 'reported_linear_perp', label: 'Linear Perps' },
	{ metric: 'inverse_perp', reported: 'reported_inverse_perp', label: 'Inverse Perps' }
] as const satisfies readonly ChartSegmentSpec[]

const PERP_CHART_SEGMENTS = CHART_SEGMENTS.filter((spec) => spec.metric !== 'spot')

function aggregateResearchSeries(series: NullableSeries[], dayCount: number): Array<number | null> {
	const aggregated = new Array<number | null>(dayCount)
	for (let index = 0; index < dayCount; index++) {
		let total = 0
		let observed = false
		for (const values of series) {
			const value = values[index]
			if (value == null) continue
			total += value
			observed = true
		}
		aggregated[index] = observed ? total : null
	}
	return aggregated
}

function researchChart(
	part: MasterChartPart,
	response: MasterChartColumnarResponse,
	view: ExchangeResearchView,
	lines: ExchangeResearchChartModel['lines']
): ExchangeResearchChartModel {
	const presentation = getResearchPresentation(part, view)
	return {
		metric: presentation.metric,
		segment: presentation.segment,
		grouping: presentation.grouping,
		title: presentation.title,
		description: presentation.description,
		days: response.days,
		lines,
		valueSymbol: presentation.valueSymbol,
		builtAt: response.built_at ?? response.last_updated ?? null
	}
}

export interface DecodedChartExchange {
	exchange: string
	type: 'cex' | 'dex'
	metrics: Partial<Record<MasterChartMetric, Array<number | null>>>
}

/** Decode one canonical compact chart payload without retaining a second transport shape. */
export function decodeMasterChart(response: MasterChartColumnarResponse): DecodedChartExchange[] {
	if (response.types.length !== response.exchanges.length || response.series.length !== response.exchanges.length) {
		throw new Error('Chart type and series axes do not match the exchange axis')
	}
	if (response.btc_depth) {
		for (const segment of ['spot', 'linear_perp', 'inverse_perp'] as const) {
			if (response.btc_depth[segment].length !== response.days.length) {
				throw new Error('BTC depth columns do not match the day axis')
			}
		}
	}
	const exchanges: DecodedChartExchange[] = new Array(response.exchanges.length)
	for (let exchangeIndex = 0; exchangeIndex < response.exchanges.length; exchangeIndex++) {
		const metrics: Partial<Record<MasterChartMetric, Array<number | null>>> = {}
		const exchange = response.exchanges[exchangeIndex]
		const type = response.types[exchangeIndex]
		const columns = response.series[exchangeIndex]
		if (exchange === undefined || type === undefined || columns === undefined) {
			throw new Error(`Missing chart exchange at index ${exchangeIndex}`)
		}
		if (columns.length !== response.key.length) {
			throw new Error(`Chart columns for ${exchange} do not match the metric axis`)
		}
		for (let metricIndex = 0; metricIndex < response.key.length; metricIndex++) {
			const key = response.key[metricIndex]
			const values = columns[metricIndex]
			if (key === undefined || values === undefined) throw new Error(`Missing chart metric for ${exchange}`)
			if (values !== null) {
				if (values.length !== response.days.length) {
					throw new Error(`Chart column ${key} for ${exchange} does not match the day axis`)
				}
				metrics[key] = values
			}
		}
		exchanges[exchangeIndex] = {
			exchange,
			type,
			metrics
		}
	}
	return exchanges
}

function metricSeries(exchange: DecodedChartExchange, metric: MasterChartMetric): Array<number | null> | null {
	const values = exchange.metrics[metric]
	return values === undefined ? null : values
}

interface ResearchSeriesItem {
	exchange: DecodedChartExchange
	values: Array<number | null>
	rankValues: Array<number | null>
}

function exchangeSeriesItems(
	exchanges: DecodedChartExchange[],
	select: (exchange: DecodedChartExchange) => Array<number | null> | null
): ResearchSeriesItem[] {
	const items: ResearchSeriesItem[] = []
	for (const exchange of exchanges) {
		const values = select(exchange)
		if (values === null || !values.some((value) => value !== null)) continue
		items.push({ exchange, values, rankValues: values })
	}
	return items
}

function topExchangeLines<T extends ResearchSeriesItem>(
	response: MasterChartColumnarResponse,
	items: T[],
	otherValues: (other: T[]) => Array<number | null>
): ExchangeResearchChartModel['lines'] {
	const lastDay = response.days.length - 1
	items.sort((a, b) => {
		const byLatest = (b.rankValues[lastDay] ?? -Infinity) - (a.rankValues[lastDay] ?? -Infinity)
		return byLatest || a.exchange.exchange.localeCompare(b.exchange.exchange)
	})
	const lines: ExchangeResearchChartModel['lines'] = []
	const topCount = Math.min(items.length, TOP_VENUE_COUNT)
	for (let index = 0; index < topCount; index++) {
		const item = items[index]
		if (!item) continue
		const id = item.exchange.exchange
		const label = response.names[id]
		if (label === undefined) throw new Error(`Missing chart name for ${id}`)
		lines.push({ id, label, values: item.values })
	}
	const other = items.slice(TOP_VENUE_COUNT)
	if (other.length > 0) lines.push({ id: 'other', label: 'Other', values: otherValues(other) })
	return lines
}

function summedOther(dayCount: number) {
	return (items: ResearchSeriesItem[]) =>
		aggregateResearchSeries(
			items.map((item) => item.values),
			dayCount
		)
}

/** One line per venue type × exact segment (e.g. "CEX · Linear Perps"); segments stay separate. */
function typeSegmentLines(
	exchanges: DecodedChartExchange[],
	dayCount: number,
	specs: readonly ChartSegmentSpec[]
): ExchangeResearchChartModel['lines'] {
	const lines: ExchangeResearchChartModel['lines'] = []
	for (const kind of ['cex', 'dex'] as const) {
		for (const spec of specs) {
			const series: Array<Array<number | null>> = []
			for (const exchange of exchanges) {
				if (exchange.type !== kind) continue
				const values = exchange.metrics[spec.metric]
				if (values !== undefined) series.push(values)
			}
			if (series.length > 0) {
				lines.push({
					id: `${kind}-${spec.metric}`,
					label: `${kind.toUpperCase()} · ${spec.label}`,
					values: aggregateResearchSeries(series, dayCount)
				})
			}
		}
	}
	return lines
}

/** One line per exact segment across all exchanges; perpetual classes stay separate lines. */
function segmentLines(exchanges: DecodedChartExchange[], dayCount: number): ExchangeResearchChartModel['lines'] {
	const lines: ExchangeResearchChartModel['lines'] = []
	for (const spec of CHART_SEGMENTS) {
		const series: Array<Array<number | null>> = []
		for (const exchange of exchanges) {
			const values = exchange.metrics[spec.metric]
			if (values !== undefined) series.push(values)
		}
		if (series.length > 0) {
			lines.push({ id: spec.metric, label: spec.label, values: aggregateResearchSeries(series, dayCount) })
		}
	}
	return lines
}

function survivalRatio(
	normalized: ReadonlyArray<number | null>,
	reported: ReadonlyArray<number | null>
): Array<number | null> {
	const values = new Array<number | null>(reported.length)
	for (let index = 0; index < reported.length; index++) {
		const denominator = reported[index]
		const numerator = normalized[index]
		values[index] = denominator == null || denominator <= 0 || numerator == null ? null : numerator / denominator
	}
	return values
}

interface SurvivalSeriesItem extends ResearchSeriesItem {
	normalized: Array<number | null>
	reported: Array<number | null>
}

function survivalExchangeLines(
	response: MasterChartColumnarResponse,
	exchanges: DecodedChartExchange[],
	spec: ChartSegmentSpec
): ExchangeResearchChartModel['lines'] {
	const dayCount = response.days.length
	const items: SurvivalSeriesItem[] = []
	for (const exchange of exchanges) {
		const normalized = metricSeries(exchange, spec.metric)
		const reported = metricSeries(exchange, spec.reported)
		if (normalized === null || reported === null) continue
		const values = survivalRatio(normalized, reported)
		if (!values.some((value) => value !== null)) continue
		items.push({ exchange, normalized, reported, values, rankValues: reported })
	}
	return topExchangeLines(response, items, (other) => {
		const normalized = aggregateResearchSeries(
			other.map((item) => item.normalized),
			dayCount
		)
		const reported = aggregateResearchSeries(
			other.map((item) => item.reported),
			dayCount
		)
		return survivalRatio(normalized, reported)
	})
}

export function mapMasterResearchReport(
	part: MasterChartPart,
	response: MasterChartColumnarResponse
): ExchangeResearchReportModel {
	const dayCount = response.days.length
	const decoded = decodeMasterChart(response)
	const exchangeView = (view: ExchangeResearchView, metric: MasterChartMetric) => ({
		id: view,
		label: getResearchPresentation(part, view).label,
		chart: researchChart(
			part,
			response,
			view,
			topExchangeLines(
				response,
				exchangeSeriesItems(decoded, (exchange) => metricSeries(exchange, metric)),
				summedOther(dayCount)
			)
		)
	})
	const typeView = (view: ExchangeResearchView, specs: readonly ChartSegmentSpec[]) => ({
		id: view,
		label: getResearchPresentation(part, view).label,
		chart: researchChart(part, response, view, typeSegmentLines(decoded, dayCount, specs))
	})

	if (part === 'volume') {
		return {
			views: [
				exchangeView('spot-exchanges', 'spot'),
				exchangeView('linear-perp-exchanges', 'linear_perp'),
				exchangeView('inverse-perp-exchanges', 'inverse_perp'),
				typeView('volume-types', CHART_SEGMENTS)
			]
		}
	}

	if (part === 'oi') {
		return {
			views: [
				exchangeView('open-interest-linear-exchanges', 'linear_perp'),
				exchangeView('open-interest-inverse-exchanges', 'inverse_perp'),
				typeView('open-interest-types', PERP_CHART_SEGMENTS)
			]
		}
	}

	if (part === 'depth') {
		const views: ExchangeResearchReportModel['views'] = [
			exchangeView('depth-spot-exchanges', 'spot'),
			exchangeView('depth-linear-exchanges', 'linear_perp'),
			exchangeView('depth-inverse-exchanges', 'inverse_perp'),
			typeView('depth-types', CHART_SEGMENTS)
		]
		if (response.btc_depth) {
			views.push({
				id: 'btc-depth',
				label: getResearchPresentation(part, 'btc-depth').label,
				chart: researchChart(part, response, 'btc-depth', [
					{ id: 'btc-spot', label: 'BTC spot depth', values: response.btc_depth.spot },
					{ id: 'btc-linear-perp', label: 'BTC linear perp depth', values: response.btc_depth.linear_perp },
					{ id: 'btc-inverse-perp', label: 'BTC inverse perp depth', values: response.btc_depth.inverse_perp }
				])
			})
		}
		return { views }
	}

	const survivalView = (view: ExchangeResearchView, spec: ChartSegmentSpec) => ({
		id: view,
		label: getResearchPresentation(part, view).label,
		chart: researchChart(part, response, view, survivalExchangeLines(response, decoded, spec))
	})

	return {
		views: [
			exchangeView('normalized-spot-exchanges', 'spot'),
			exchangeView('normalized-linear-exchanges', 'linear_perp'),
			exchangeView('normalized-inverse-exchanges', 'inverse_perp'),
			typeView('normalized-types', CHART_SEGMENTS),
			{
				id: 'normalized-segments',
				label: getResearchPresentation(part, 'normalized-segments').label,
				chart: researchChart(part, response, 'normalized-segments', segmentLines(decoded, dayCount))
			},
			survivalView('survival-spot-exchanges', CHART_SEGMENTS[0]),
			survivalView('survival-linear-exchanges', CHART_SEGMENTS[1]),
			survivalView('survival-inverse-exchanges', CHART_SEGMENTS[2])
		]
	}
}

function micaMarketCount(venue: MasterMicaVenue): number | null {
	return sumNullable(MASTER_SEGMENTS.map((segment) => venue.metrics[segment]?.market_count ?? null))
}

export function mapMasterMica(response: MasterMicaResponse): MicaVenueModel[] {
	return response.exchanges
		.filter((venue) => venue.mica_licensed === true && venue.eu_status === 'available')
		.map((venue) => {
			const { websiteUrl, referralUrl } = websiteDestination(venue)
			const spotDepth = venue.depth_summary.spot
			// Perp columns present the linear class ("Perps"); inverse books stay separate per contract.
			const perpDepth = venue.depth_summary.linear_perp
			return {
				exchange: venue.slug,
				name: venue.display_name,
				profileHref: venue.links.profile,
				website: websiteUrl,
				referralUrl,
				promotions: venue.promotions.map(mapPromotion),
				micaStatus: venue.mica_status,
				micaLicensed: true,
				micaMemberState: venue.mica_member_state,
				micaRegulator: venue.mica_regulator,
				licenseCount: venue.license_count,
				products: venue.products,
				marketCount: micaMarketCount(venue),
				spotFee: venue.fees.spot,
				perpFee: venue.fees.linear_perp,
				depth: {
					spotPartialCoverage: spotDepth?.partial ?? false,
					perpPartialCoverage: perpDepth?.partial ?? false,
					spotBid05Usd: spotDepth?.bid_05pct_usd ?? null,
					spotAsk05Usd: spotDepth?.ask_05pct_usd ?? null,
					spotBid2Usd: spotDepth?.bid_2pct_usd ?? null,
					spotAsk2Usd: spotDepth?.ask_2pct_usd ?? null,
					perpBid05Usd: perpDepth?.bid_05pct_usd ?? null,
					perpAsk05Usd: perpDepth?.ask_05pct_usd ?? null,
					perpBid2Usd: perpDepth?.bid_2pct_usd ?? null,
					perpAsk2Usd: perpDepth?.ask_2pct_usd ?? null
				},
				kyc:
					venue.kyc_required === null
						? null
						: { required: venue.kyc_required, short: venue.kyc_short, summary: venue.kyc_summary },
				fiatOnramp: venue.has_fiat_onramp,
				rampCost: venue.ramp_cost_1k ? mapRampCost(venue.ramp_cost_1k) : null
			}
		})
}
