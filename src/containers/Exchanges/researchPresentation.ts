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

const TOP_EXCHANGES =
	'Up to eight exchanges with the largest latest observation are shown separately; remaining exchanges are grouped as Other.'

const LINEAR_PERPS =
	'USD perps (also called linear perps) are margined and settled in a quote asset such as USDT or USDC.'
const INVERSE_PERPS =
	'COIN perps (also called inverse perps) are margined and settled in the underlying coin, so collateral and PnL are denominated in that coin.'

export const RESEARCH_VIEWS: Record<ExchangeResearchPart, readonly ResearchPresentation[]> = {
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
			id: 'linear-perp-exchanges',
			label: 'USD Perps',
			metric: 'volume',
			segment: 'linear_perp',
			grouping: 'exchange',
			title: 'USD perp volume · Exchanges',
			description: `Daily USD perp volume by exchange. ${LINEAR_PERPS} ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'inverse-perp-exchanges',
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
			description: 'Daily volume grouped by exchange type, with spot, USD perp, and COIN perp lines kept separate.',
			valueSymbol: '$'
		}
	],
	oi: [
		{
			id: 'open-interest-linear-exchanges',
			label: 'USD Perps',
			metric: 'open-interest',
			segment: 'linear_perp',
			grouping: 'exchange',
			title: 'USD perp open interest · Exchanges',
			description: `Daily USD perp open interest by exchange. ${LINEAR_PERPS} ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'open-interest-inverse-exchanges',
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
			description:
				'Daily perpetual open interest grouped by exchange type, with USD and COIN perp lines kept separate.',
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
			description: `End-of-day spot order-book depth within ±2% by exchange. ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'depth-linear-exchanges',
			label: 'USD Perps',
			metric: 'depth',
			segment: 'linear_perp',
			grouping: 'exchange',
			title: 'USD perp market depth · Exchanges',
			description: `End-of-day USD perp order-book depth within ±2% by exchange. ${LINEAR_PERPS} ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'depth-inverse-exchanges',
			label: 'COIN Perps',
			metric: 'depth',
			segment: 'inverse_perp',
			grouping: 'exchange',
			title: 'COIN perp market depth · Exchanges',
			description: `End-of-day COIN perp order-book depth within ±2% by exchange. ${INVERSE_PERPS} ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'depth-types',
			label: 'CEX vs DEX',
			metric: 'depth',
			segment: 'separate',
			grouping: 'venue-type',
			title: 'Market depth · CEX vs DEX',
			description:
				'End-of-day order-book depth within ±2% grouped by exchange type, with spot, USD perp, and COIN perp lines kept separate.',
			valueSymbol: '$'
		},
		{
			id: 'btc-depth',
			label: 'BTC depth',
			metric: 'depth',
			segment: 'separate',
			grouping: 'segment',
			title: 'Market depth · BTC by segment',
			description:
				'Daily BTC order-book depth within ±2% across all exchanges, with spot, USD perp, and COIN perp lines kept separate.',
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
			description: `Daily spot volume constrained by observed active liquidity, by exchange. ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'normalized-linear-exchanges',
			label: 'USD Perps',
			metric: 'normalized-volume',
			segment: 'linear_perp',
			grouping: 'exchange',
			title: 'Liquidity-normalized USD perp volume · Exchanges',
			description: `Daily USD perp volume constrained by observed active liquidity, by exchange. ${LINEAR_PERPS} ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'normalized-inverse-exchanges',
			label: 'COIN Perps',
			metric: 'normalized-volume',
			segment: 'inverse_perp',
			grouping: 'exchange',
			title: 'Liquidity-normalized COIN perp volume · Exchanges',
			description: `Daily COIN perp volume constrained by observed active liquidity, by exchange. ${INVERSE_PERPS} ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'normalized-types',
			label: 'CEX vs DEX',
			metric: 'normalized-volume',
			segment: 'separate',
			grouping: 'venue-type',
			title: 'Liquidity-normalized volume · CEX vs DEX',
			description:
				'Daily normalized volume grouped by exchange type, with spot, USD perp, and COIN perp lines kept separate.',
			valueSymbol: '$'
		},
		{
			id: 'normalized-segments',
			label: 'By segment',
			metric: 'normalized-volume',
			segment: 'separate',
			grouping: 'segment',
			title: 'Liquidity-normalized volume · By segment',
			description: 'Daily normalized volume grouped by market segment: spot, USD perps, and COIN perps.',
			valueSymbol: '$'
		},
		{
			id: 'survival-spot-exchanges',
			label: 'Survival · Spot',
			metric: 'survival-ratio',
			segment: 'spot',
			grouping: 'exchange',
			title: 'Normalized / reported spot volume · Exchanges',
			description:
				'Daily normalized spot volume divided by reported spot volume for each exchange. Exchanges are ranked by latest reported volume; Other is calculated from aggregated normalized and reported volume.',
			valueSymbol: '%'
		},
		{
			id: 'survival-linear-exchanges',
			label: 'Survival · USD Perps',
			metric: 'survival-ratio',
			segment: 'linear_perp',
			grouping: 'exchange',
			title: 'Normalized / reported USD perp volume · Exchanges',
			description: `Daily normalized USD perp volume divided by reported USD perp volume for each exchange. ${LINEAR_PERPS} Exchanges are ranked by latest reported volume; Other is calculated from aggregated normalized and reported volume.`,
			valueSymbol: '%'
		},
		{
			id: 'survival-inverse-exchanges',
			label: 'Survival · COIN Perps',
			metric: 'survival-ratio',
			segment: 'inverse_perp',
			grouping: 'exchange',
			title: 'Normalized / reported COIN perp volume · Exchanges',
			description: `Daily normalized COIN perp volume divided by reported COIN perp volume for each exchange. ${INVERSE_PERPS} Exchanges are ranked by latest reported volume; Other is calculated from aggregated normalized and reported volume.`,
			valueSymbol: '%'
		}
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
