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

const LINEAR_PERPS = 'Linear perps are perpetual contracts margined and settled in a quote asset such as USDT or USDC.'
const INVERSE_PERPS =
	'Inverse perps are perpetual contracts margined and settled in the underlying coin (collateral and PnL denominated in that coin).'

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
			label: 'Linear Perps',
			metric: 'volume',
			segment: 'linear_perp',
			grouping: 'exchange',
			title: 'Linear perp volume · Exchanges',
			description: `Daily linear perpetual volume by exchange. ${LINEAR_PERPS} ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'inverse-perp-exchanges',
			label: 'Inverse Perps',
			metric: 'volume',
			segment: 'inverse_perp',
			grouping: 'exchange',
			title: 'Inverse perp volume · Exchanges',
			description: `Daily inverse perpetual volume by exchange. ${INVERSE_PERPS} ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'volume-types',
			label: 'CEX vs DEX',
			metric: 'volume',
			segment: 'separate',
			grouping: 'venue-type',
			title: 'Volume · CEX vs DEX',
			description:
				'Daily volume grouped by exchange type, with spot, linear perp, and inverse perp lines kept separate.',
			valueSymbol: '$'
		}
	],
	oi: [
		{
			id: 'open-interest-linear-exchanges',
			label: 'Linear Perps',
			metric: 'open-interest',
			segment: 'linear_perp',
			grouping: 'exchange',
			title: 'Linear perp open interest · Exchanges',
			description: `Daily linear perpetual open interest by exchange. ${LINEAR_PERPS} ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'open-interest-inverse-exchanges',
			label: 'Inverse Perps',
			metric: 'open-interest',
			segment: 'inverse_perp',
			grouping: 'exchange',
			title: 'Inverse perp open interest · Exchanges',
			description: `Daily inverse perpetual open interest by exchange. ${INVERSE_PERPS} ${TOP_EXCHANGES}`,
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
				'Daily perpetual open interest grouped by exchange type, with linear and inverse perp lines kept separate.',
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
			label: 'Linear Perps',
			metric: 'depth',
			segment: 'linear_perp',
			grouping: 'exchange',
			title: 'Linear perp market depth · Exchanges',
			description: `End-of-day linear perpetual order-book depth within ±2% by exchange. ${LINEAR_PERPS} ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'depth-inverse-exchanges',
			label: 'Inverse Perps',
			metric: 'depth',
			segment: 'inverse_perp',
			grouping: 'exchange',
			title: 'Inverse perp market depth · Exchanges',
			description: `End-of-day inverse perpetual order-book depth within ±2% by exchange. ${INVERSE_PERPS} ${TOP_EXCHANGES}`,
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
				'End-of-day order-book depth within ±2% grouped by exchange type, with spot, linear perp, and inverse perp lines kept separate.',
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
				'Daily BTC order-book depth within ±2% across all exchanges, with spot, linear perp, and inverse perp lines kept separate.',
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
			label: 'Linear Perps',
			metric: 'normalized-volume',
			segment: 'linear_perp',
			grouping: 'exchange',
			title: 'Liquidity-normalized linear perp volume · Exchanges',
			description: `Daily linear perpetual volume constrained by observed active liquidity, by exchange. ${LINEAR_PERPS} ${TOP_EXCHANGES}`,
			valueSymbol: '$'
		},
		{
			id: 'normalized-inverse-exchanges',
			label: 'Inverse Perps',
			metric: 'normalized-volume',
			segment: 'inverse_perp',
			grouping: 'exchange',
			title: 'Liquidity-normalized inverse perp volume · Exchanges',
			description: `Daily inverse perpetual volume constrained by observed active liquidity, by exchange. ${INVERSE_PERPS} ${TOP_EXCHANGES}`,
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
				'Daily normalized volume grouped by exchange type, with spot, linear perp, and inverse perp lines kept separate.',
			valueSymbol: '$'
		},
		{
			id: 'normalized-segments',
			label: 'By segment',
			metric: 'normalized-volume',
			segment: 'separate',
			grouping: 'segment',
			title: 'Liquidity-normalized volume · By segment',
			description: 'Daily normalized volume grouped by market segment: spot, linear perps, and inverse perps.',
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
			label: 'Survival · Linear Perps',
			metric: 'survival-ratio',
			segment: 'linear_perp',
			grouping: 'exchange',
			title: 'Normalized / reported linear perp volume · Exchanges',
			description: `Daily normalized linear perpetual volume divided by reported linear perpetual volume for each exchange. ${LINEAR_PERPS} Exchanges are ranked by latest reported volume; Other is calculated from aggregated normalized and reported volume.`,
			valueSymbol: '%'
		},
		{
			id: 'survival-inverse-exchanges',
			label: 'Survival · Inverse Perps',
			metric: 'survival-ratio',
			segment: 'inverse_perp',
			grouping: 'exchange',
			title: 'Normalized / reported inverse perp volume · Exchanges',
			description: `Daily normalized inverse perpetual volume divided by reported inverse perpetual volume for each exchange. ${INVERSE_PERPS} Exchanges are ranked by latest reported volume; Other is calculated from aggregated normalized and reported volume.`,
			valueSymbol: '%'
		}
	]
}

export function resolveResearchView(
	part: ExchangeResearchPart,
	requestedView: ExchangeResearchView | null
): ExchangeResearchView {
	if (requestedView && RESEARCH_VIEWS[part].some((view) => view.id === requestedView)) return requestedView
	return RESEARCH_VIEWS[part][0].id
}

export function getResearchPresentation(part: ExchangeResearchPart, view: ExchangeResearchView): ResearchPresentation {
	const presentation = RESEARCH_VIEWS[part].find((item) => item.id === view)
	if (!presentation) throw new Error(`Research view ${view} is not valid for ${part}`)
	return presentation
}
