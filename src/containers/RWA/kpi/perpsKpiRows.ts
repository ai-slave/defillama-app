import { formatNumber } from '~/utils/numberFormat'
import { perpsDefinitions as d } from '../Perps/definitions'
import type { RwaPerpsVenueType } from '../VenuePage/venueData'
import type { RwaVenueKpi } from '../VenuePage/venueKpi'
import { kpiCount, kpiUsd, RWA_DEX_SHARE_TOOLTIP, type RwaKpiHeadline, type RwaKpiRow } from './kpiRows'
import type { RwaPerpsKpi } from './perpsKpi'

/** Open Interest heads a Perps card, as Active AUM heads an Assets card; on a page it is the page's h1. */
export function getRwaPerpsKpiHeadline(kpi: RwaPerpsKpi, headline?: string): RwaKpiHeadline {
	return {
		label: headline ?? 'Open Interest',
		labelAs: headline ? 'h1' : 'h2',
		tooltip: d.totalOpenInterest.description,
		value: kpi.openInterest,
		change: kpi.openInterestChange24h,
		csv: { value: 'Open Interest', change: 'Open Interest' }
	}
}

function getVolumeRow(kpi: RwaPerpsKpi): RwaKpiRow {
	return {
		label: 'Volume (30d)',
		tooltip: d.volume30d.description,
		value: kpiUsd(kpi.volume30d),
		rows: [
			{ label: '7d', csv: 'Volume (7d)', value: kpiUsd(kpi.volume7d) },
			{ label: '24h', csv: 'Volume (24h)', value: kpiUsd(kpi.volume24h) },
			{ label: 'All-time', csv: 'Volume (all-time)', value: kpiUsd(kpi.volumeAllTime) },
			{
				label: 'Turnover (30d)',
				csv: 'Turnover (30d) x',
				tooltip: '30 day volume divided by open interest: how many times the open positions turned over.',
				value: { kind: 'turnover', value: kpi.turnover30d }
			}
		]
	}
}

function getFeesRow(kpi: RwaPerpsKpi, rows: Array<RwaKpiRow>): RwaKpiRow {
	return {
		label: 'Est. Fees (30d)',
		tooltip: d.estimatedProtocolFees30d.description,
		value: kpiUsd(kpi.fees30d),
		rows: [{ label: '24h', csv: 'Est. Fees (24h)', value: kpiUsd(kpi.fees24h) }, ...rows]
	}
}

/** The Perps overview and its scope pages. */
export function getRwaPerpsKpiRows(kpi: RwaPerpsKpi): Array<RwaKpiRow> {
	return [
		getVolumeRow(kpi),
		{
			label: 'Markets',
			tooltip: d.markets.description,
			value: kpiCount(kpi.markets),
			rows: [
				{ label: 'Venues', value: kpiCount(kpi.venues) },
				{ label: 'Reference Assets', value: kpiCount(kpi.referenceAssets) },
				{ label: 'Asset Groups', value: kpiCount(kpi.assetGroups) }
			]
		},
		{
			label: 'DEX Share of OI',
			csv: 'DEX Share of OI %',
			tooltip: RWA_DEX_SHARE_TOOLTIP,
			value: { kind: 'ratio', value: kpi.dexShare }
		},
		getFeesRow(kpi, [
			{ label: '7d', csv: 'Est. Fees (7d)', value: kpiUsd(kpi.fees7d) },
			{ label: 'All-time', csv: 'Est. Fees (all-time)', value: kpiUsd(kpi.feesAllTime) }
		])
	]
}

/** One venue: its share of its type's open interest in place of the DEX share, the annual run rate, the taker fee. */
export function getRwaVenueKpiRows(
	kpi: RwaVenueKpi,
	venueType: RwaPerpsVenueType | null,
	takerFeeBps: number | null
): Array<RwaKpiRow> {
	const type = venueType ?? 'DEX'
	return [
		getVolumeRow(kpi),
		{
			label: 'Markets',
			tooltip: d.markets.description,
			value: kpiCount(kpi.markets),
			rows: [
				{ label: 'Reference Assets', value: kpiCount(kpi.referenceAssets) },
				{ label: 'Asset Groups', value: kpiCount(kpi.assetGroups) },
				{
					label: `Share of ${type} OI`,
					csv: `Share of ${type} OI %`,
					tooltip: `This venue's open interest as a share of all ${type} open interest.`,
					value: { kind: 'ratio', value: kpi.venueShare }
				}
			]
		},
		getFeesRow(kpi, [
			{ label: 'All-time', csv: 'Est. Fees (all-time)', value: kpiUsd(kpi.feesAllTime) },
			{
				label: 'Est. Annual',
				csv: 'Est. Annual Fees',
				tooltip: 'The 30 day fees times 365 / 30.',
				value: kpiUsd(kpi.feesAnnual)
			},
			...(takerFeeBps != null
				? [
						{
							label: 'Taker Fee',
							csv: 'Taker Fee (bps)',
							value: kpiCount(takerFeeBps),
							text: `${formatNumber(takerFeeBps)} bps`
						}
					]
				: [])
		])
	]
}
