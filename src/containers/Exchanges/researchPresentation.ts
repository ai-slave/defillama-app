import type {
	ExchangeResearchChartModel,
	ExchangeResearchGrouping,
	ExchangeResearchMetric,
	ExchangeResearchSegmentMode,
	ExchangeResearchView
} from './models'
import type { ExchangeResearchPart } from './queryState'

export type ResearchPresentation = Pick<ExchangeResearchChartModel, 'title' | 'description' | 'valueSymbol'> & {
	id: ExchangeResearchView
	label: string
	metric: ExchangeResearchMetric
	segment: ExchangeResearchSegmentMode
	grouping: ExchangeResearchGrouping
}

const TOP_EXCHANGES = 'Top eight by latest observation; the rest grouped as Other.'

/** Provenance, not decoration: these are our measurements, not venue-reported figures. */
const OWN_BOOKS = 'Measured from our own order-book snapshots.'

/** Repeated tail of the survival-ratio views. */
const SURVIVAL_OTHER = 'Ranked by latest reported volume; Other is aggregated before dividing.'

/** Said wherever normalized volume is charted: the gap it draws is a measurement limit
 *  as often as a venue's, and the chart should not be read as an accusation. */
const NVOL_CAVEAT = 'A gap to reported volume may also be liquidity our snapshot missed.'

const LINEAR_PERPS = 'USD perps settle in USDT or USDC.'
const INVERSE_PERPS = 'COIN perps settle in the underlying coin.'

export const RESEARCH_VIEWS: Record<ExchangeResearchPart, ReadonlyArray<ResearchPresentation>> = {
	volume: [
		{
			id: 'spot-exchanges',
			label: 'Spot',
			metric: 'volume',
			segment: 'spot',
			grouping: 'exchange',
			title: 'Spot volume · Exchanges',
			description: `Daily spot volume by exchange. ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'usd-perp-exchanges',
			label: 'USD Perps',
			metric: 'volume',
			segment: 'linear_perp',
			grouping: 'exchange',
			title: 'USD perp volume · Exchanges',
			description: `Daily USD perp volume by exchange. ${LINEAR_PERPS} ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'coin-perp-exchanges',
			label: 'COIN Perps',
			metric: 'volume',
			segment: 'inverse_perp',
			grouping: 'exchange',
			title: 'COIN perp volume · Exchanges',
			description: `Daily COIN perp volume by exchange. ${INVERSE_PERPS} ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'volume-types',
			label: 'CEX vs DEX',
			metric: 'volume',
			segment: 'separate',
			grouping: 'venue-type',
			title: 'Volume · CEX vs DEX',
			description: 'Daily volume by exchange type, segments kept separate.',
			valueSymbol: '$'
		}
	],
	oi: [
		{
			id: 'open-interest-base-share',
			label: 'BTC vs ETH vs Others',
			metric: 'open-interest',
			segment: 'linear_perp',
			grouping: 'segment',
			title: 'USD perp open interest share · BTC vs ETH vs Others',
			description: `Each base's share of daily USD perp open interest. ${LINEAR_PERPS}`,
			valueSymbol: '%'
		},
		{
			id: 'open-interest-usd-exchanges',
			label: 'USD Perps',
			metric: 'open-interest',
			segment: 'linear_perp',
			grouping: 'exchange',
			title: 'USD perp open interest · Exchanges',
			description: `Daily USD perp open interest by exchange. ${LINEAR_PERPS} ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'open-interest-coin-exchanges',
			label: 'COIN Perps',
			metric: 'open-interest',
			segment: 'inverse_perp',
			grouping: 'exchange',
			title: 'COIN perp open interest · Exchanges',
			description: `Daily COIN perp open interest by exchange. ${INVERSE_PERPS} ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'open-interest-types',
			label: 'CEX vs DEX',
			metric: 'open-interest',
			segment: 'separate',
			grouping: 'venue-type',
			title: 'Open interest · CEX vs DEX',
			description: 'Daily perp open interest by exchange type, segments kept separate.',
			valueSymbol: '$'
		}
	],
	depth: [
		{
			id: 'depth-spot-exchanges',
			label: 'Spot',
			metric: 'depth',
			segment: 'spot',
			grouping: 'exchange',
			title: 'Spot market depth · Exchanges',
			description: `End-of-day spot depth within ±2% of mid, by exchange. ${OWN_BOOKS} ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'depth-usd-exchanges',
			label: 'USD Perps',
			metric: 'depth',
			segment: 'linear_perp',
			grouping: 'exchange',
			title: 'USD perp market depth · Exchanges',
			description: `End-of-day USD perp depth within ±2% of mid, by exchange. ${OWN_BOOKS} ${LINEAR_PERPS} ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'depth-coin-exchanges',
			label: 'COIN Perps',
			metric: 'depth',
			segment: 'inverse_perp',
			grouping: 'exchange',
			title: 'COIN perp market depth · Exchanges',
			description: `End-of-day COIN perp depth within ±2% of mid, by exchange. ${OWN_BOOKS} ${INVERSE_PERPS} ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'depth-types',
			label: 'CEX vs DEX',
			metric: 'depth',
			segment: 'separate',
			grouping: 'venue-type',
			title: 'Market depth · CEX vs DEX',
			description: `End-of-day depth within ±2% of mid by exchange type, segments kept separate. ${OWN_BOOKS}`,
			valueSymbol: '$'
		},
		{
			id: 'btc-depth',
			label: 'BTC depth',
			metric: 'depth',
			segment: 'separate',
			grouping: 'segment',
			title: 'Market depth · BTC by segment',
			description: `Daily BTC depth within ±2% of mid across all exchanges, by segment. ${OWN_BOOKS}`,
			valueSymbol: '$'
		}
	],
	nvol: [
		{
			id: 'normalized-spot-exchanges',
			label: 'Spot',
			metric: 'normalized-volume',
			segment: 'spot',
			grouping: 'exchange',
			title: 'Liquidity-normalized spot volume · Exchanges',
			description: `Daily spot volume constrained by observed active liquidity, by exchange. ${NVOL_CAVEAT} ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'normalized-usd-exchanges',
			label: 'USD Perps',
			metric: 'normalized-volume',
			segment: 'linear_perp',
			grouping: 'exchange',
			title: 'Liquidity-normalized USD perp volume · Exchanges',
			description: `Daily USD perp volume constrained by observed active liquidity, by exchange. ${NVOL_CAVEAT} ${LINEAR_PERPS} ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'normalized-coin-exchanges',
			label: 'COIN Perps',
			metric: 'normalized-volume',
			segment: 'inverse_perp',
			grouping: 'exchange',
			title: 'Liquidity-normalized COIN perp volume · Exchanges',
			description: `Daily COIN perp volume constrained by observed active liquidity, by exchange. ${NVOL_CAVEAT} ${INVERSE_PERPS} ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'normalized-types',
			label: 'CEX vs DEX',
			metric: 'normalized-volume',
			segment: 'separate',
			grouping: 'venue-type',
			title: 'Liquidity-normalized volume · CEX vs DEX',
			description: `Daily normalized volume by exchange type, segments kept separate. ${NVOL_CAVEAT}`,
			valueSymbol: '$'
		},
		{
			id: 'normalized-segments',
			label: 'By segment',
			metric: 'normalized-volume',
			segment: 'separate',
			grouping: 'segment',
			title: 'Liquidity-normalized volume · By segment',
			description: `Daily normalized volume by market segment: spot, USD perps, COIN perps. ${NVOL_CAVEAT}`,
			valueSymbol: '$'
		},
		{
			id: 'survival-spot-exchanges',
			label: 'Survival · Spot',
			metric: 'survival-ratio',
			segment: 'spot',
			grouping: 'exchange',
			title: 'Normalized / reported spot volume · Exchanges',
			description: `Daily normalized spot volume divided by reported, by exchange. ${SURVIVAL_OTHER}`,
			valueSymbol: '%'
		},
		{
			id: 'survival-usd-exchanges',
			label: 'Survival · USD Perps',
			metric: 'survival-ratio',
			segment: 'linear_perp',
			grouping: 'exchange',
			title: 'Normalized / reported USD perp volume · Exchanges',
			description: `Daily normalized USD perp volume divided by reported, by exchange. ${LINEAR_PERPS} ${SURVIVAL_OTHER}`,
			valueSymbol: '%'
		}
		// No COIN-perp survival view: normalized volume is not computed for inverse perps.
	]
}

export function resolveResearchView(
	part: ExchangeResearchPart,
	requestedView: ExchangeResearchView | null
): ExchangeResearchView {
	if (requestedView && RESEARCH_VIEWS[part].some((view) => view.id === requestedView)) return requestedView
	const firstView = RESEARCH_VIEWS[part][0]
	if (!firstView) throw new Error(`Missing research views for ${part}`)
	return firstView.id
}

export function getResearchPresentation(part: ExchangeResearchPart, view: ExchangeResearchView): ResearchPresentation {
	const presentation = RESEARCH_VIEWS[part].find((item) => item.id === view)
	if (!presentation) throw new Error(`Research view ${view} is not valid for ${part}`)
	return presentation
}
