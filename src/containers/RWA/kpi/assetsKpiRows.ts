import type { RwaNamedBar, RwaPerpsTotals } from '../cards/cardData'
import { getRwaRatio } from '../cards/cardData'
import { definitions } from '../definitions'
import { perpsDefinitions } from '../Perps/definitions'
import type { RWAPlatformMeta } from '../PlatformPage/api.types'
import type { RWATableMetrics } from '../table/rows'
import { kpiCount, kpiUsd, RWA_DEX_SHARE_TOOLTIP, type RwaKpiHeadline, type RwaKpiRow } from './kpiRows'
import { RWA_KPI_PERIOD, RWA_KPI_PERIOD_LABEL } from './MetricChange'
import type { RWAPlatformKpi } from './platformKpi'

type Definition = { label: string; description: string }
type RwaKpiLabels = Record<'activeMcap' | 'onChainMcap' | 'defiActiveTvl', Definition>

const CHANGE = `Change (${RWA_KPI_PERIOD_LABEL})`

/** The overview reads the totals over every asset, a platform its own numbers, so the labels differ, the rows do not. */
const OVERVIEW_LABELS: RwaKpiLabels = {
	activeMcap: definitions.totalActiveMcap,
	onChainMcap: definitions.totalOnChainMcap,
	defiActiveTvl: definitions.totalDefiActiveTvl
}
const PLATFORM_LABELS: RwaKpiLabels = {
	activeMcap: definitions.activeMcap,
	onChainMcap: definitions.onChainMcap,
	defiActiveTvl: definitions.defiActiveTvl
}

export function getRwaAssetsKpiHeadline(
	metrics: RWATableMetrics,
	label: Definition,
	headline?: string
): RwaKpiHeadline {
	return {
		label: headline ?? label.label,
		labelAs: headline ? 'h1' : 'h2',
		tooltip: label.description,
		value: metrics.activeMcap,
		change: metrics.change[RWA_KPI_PERIOD].activeMcap,
		csv: { value: label.label, change: 'Active AUM' }
	}
}

function getCoreRows(
	metrics: RWATableMetrics,
	largestProtocol: RwaNamedBar | null,
	labels: RwaKpiLabels
): Array<RwaKpiRow> {
	const change = metrics.change[RWA_KPI_PERIOD]
	return [
		{
			label: labels.onChainMcap.label,
			tooltip: labels.onChainMcap.description,
			value: kpiUsd(metrics.onChainMcap),
			rows: [
				{
					label: CHANGE,
					csv: `Onchain AUM change (${RWA_KPI_PERIOD_LABEL}) %`,
					value: { kind: 'change', change: change.onChainMcap, total: metrics.onChainMcap }
				},
				{
					label: 'Active / Onchain',
					csv: 'Active / Onchain %',
					tooltip: 'Active mcap as a share of onchain AUM.',
					value: { kind: 'ratio', value: getRwaRatio(metrics.activeMcap, metrics.onChainMcap) }
				}
			]
		},
		{
			label: labels.defiActiveTvl.label,
			tooltip: labels.defiActiveTvl.description,
			value: kpiUsd(metrics.defiActiveTvl),
			rows: [
				{
					label: CHANGE,
					csv: `DeFi Active TVL change (${RWA_KPI_PERIOD_LABEL}) %`,
					value: { kind: 'change', change: change.defiActiveTvl, total: metrics.defiActiveTvl }
				},
				{
					label: 'Utilization',
					csv: 'Utilization %',
					tooltip: 'DeFi Active TVL as a share of active AUM.',
					value: { kind: 'ratio', value: getRwaRatio(metrics.defiActiveTvl, metrics.activeMcap) }
				},
				{
					label: 'Largest Protocol',
					value: {
						kind: 'named',
						name: largestProtocol?.name ?? null,
						value: largestProtocol?.value ?? null,
						csvValue: 'Largest Protocol DeFi Active TVL'
					}
				}
			]
		}
	]
}

/** The Assets overview and its scope pages: the two AUM sections, then the perps totals of the page's markets. */
export function getRwaOverviewKpiRows(
	metrics: RWATableMetrics,
	perps: RwaPerpsTotals,
	largestProtocol: RwaNamedBar | null
): Array<RwaKpiRow> {
	return [
		...getCoreRows(metrics, largestProtocol, OVERVIEW_LABELS),
		{
			label: 'RWA Perps OI',
			tooltip: perpsDefinitions.totalOpenInterest.description,
			value: kpiUsd(perps.openInterest),
			rows: [
				{
					label: CHANGE,
					csv: `RWA Perps OI change (${RWA_KPI_PERIOD_LABEL}) %`,
					value: { kind: 'change', change: perps.openInterestChange24h, total: perps.openInterest }
				},
				{
					label: 'DEX Share',
					csv: 'DEX Share %',
					tooltip: RWA_DEX_SHARE_TOOLTIP,
					value: { kind: 'ratio', value: perps.dexShare }
				},
				{ label: 'Volume (24h)', csv: 'Perps volume (24h)', value: kpiUsd(perps.volume24h) }
			]
		}
	]
}

export const RWA_OVERVIEW_KPI_LABEL = OVERVIEW_LABELS.activeMcap
export const RWA_PLATFORM_KPI_LABEL = PLATFORM_LABELS.activeMcap

/** A platform: the two AUM sections, its flows, its live assets and issuers, and the revenue the index has. */
export function getRwaPlatformKpiRows(kpi: RWAPlatformKpi, meta: RWAPlatformMeta): Array<RwaKpiRow> {
	const { metrics } = kpi
	const flows = definitions.flows
	return [
		...getCoreRows(metrics, kpi.largestProtocol, PLATFORM_LABELS),
		{
			label: flows.assetNetFlow30d.label,
			tooltip: flows.assetNetFlow30d.description,
			value: kpiUsd(metrics.netFlow30d),
			rows: [
				{
					label: flows.assetNetFlow7d.label,
					tooltip: flows.assetNetFlow7d.description,
					value: kpiUsd(metrics.netFlow7d)
				}
			]
		},
		{
			label: 'Live Assets',
			value: kpiCount(metrics.assetCount),
			rows: [{ label: 'Issuers', tooltip: definitions.issuer.description, value: kpiCount(metrics.issuerCount) }]
		},
		...(meta.estAnnualRevenueUsd != null
			? [
					{
						label: 'Est. Annual Revenue',
						value: kpiUsd(meta.estAnnualRevenueUsd),
						rows: [
							{
								label: 'Confidence',
								csv: 'Revenue confidence',
								value: { kind: 'text' as const, value: meta.revenueConfidence ?? null }
							}
						]
					}
				]
			: [])
	]
}
