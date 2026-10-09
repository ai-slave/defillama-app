import { preparePieChartData } from '~/components/ECharts/PieChart/data'
import { CHART_COLORS, CHART_SERIES_LIMIT } from '~/constants/colors'
import { firstDayOfMonth } from '~/utils'
import { formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'
import type { IHacksPageData, IHackRow } from './types'

/** The picker option for hacks without a chain, technique or classification, so users can keep or drop them. */
export const UNKNOWN_OPTION = 'Unknown'

export interface HacksFilterState {
	/** The selected options, or null when every option is selected. */
	chains: Set<string> | null
	techniques: Set<string> | null
	classifications: Set<string> | null
	since: number | null
	minLost: number | null
	maxLost: number | null
}

export type HacksDisplaySummary = Pick<
	IHacksPageData,
	'monthlyHacksChartData' | 'totalHacked' | 'totalHackedDefi' | 'totalRugs' | 'pieChartData'
>

export type HacksPageSummary = HacksDisplaySummary &
	Pick<IHacksPageData, 'chainOptions' | 'techniqueOptions' | 'classificationOptions'>

const addToTotal = (totals: Map<string, number>, key: string, amount: number): void => {
	if (!key) return
	totals.set(key, (totals.get(key) ?? 0) + amount)
}

const byTotalDescThenNameAsc = (left: [string, number], right: [string, number]): number =>
	right[1] - left[1] || left[0].localeCompare(right[0])

const withUnknown = (totals: Array<[string, number]>, hasMissing: boolean): Array<string> => {
	const names = totals.map(([name]) => name)
	if (hasMissing) names.push(UNKNOWN_OPTION)
	return names
}

/** Incident nulls stay unavailable; only additive aggregates give them zero contribution. */
function buildHacksSummary(data: Array<IHackRow>, collectFilterOptions: false): HacksDisplaySummary
function buildHacksSummary(data: Array<IHackRow>, collectFilterOptions: true): HacksPageSummary
function buildHacksSummary(
	data: Array<IHackRow>,
	collectFilterOptions: boolean
): HacksDisplaySummary | HacksPageSummary {
	const monthlyHacks = new Map<number, number>()
	const techniqueTotals = new Map<string, number>()
	const chainTotals = collectFilterOptions ? new Map<string, number>() : null
	const classificationTotals = collectFilterOptions ? new Map<string, number>() : null
	let totalHacked = 0
	let totalHackedDefi = 0
	let totalBridgeHacks = 0
	let missingChain = false
	let missingTechnique = false
	let missingClassification = false

	for (const hack of data) {
		const amount = hack.amountUsd ?? 0
		if (hack.date !== null) {
			const monthlyDate = firstDayOfMonth(hack.date) * 1e3
			monthlyHacks.set(monthlyDate, (monthlyHacks.get(monthlyDate) ?? 0) + amount)
		}

		totalHacked += amount
		if (hack.target === 'DeFi Protocol') totalHackedDefi += amount
		if (hack.bridge) totalBridgeHacks += amount

		if (hack.technique) techniqueTotals.set(hack.technique, (techniqueTotals.get(hack.technique) ?? 0) + amount)
		else missingTechnique = true
		if (!hack.classification) missingClassification = true
		if (hack.chains.length === 0) missingChain = true
		if (classificationTotals) addToTotal(classificationTotals, hack.classification, amount)
		if (chainTotals) {
			for (const chain of hack.chains) addToTotal(chainTotals, chain, amount)
		}
	}

	const monthlySource = Array.from(monthlyHacks, ([timestamp, value]) => [timestamp, value] as [number, number])
	monthlySource.sort((left, right) => left[0] - right[0])

	const summary: HacksDisplaySummary = {
		monthlyHacksChartData: {
			dataset: {
				source: monthlySource,
				dimensions: ['timestamp', 'Total Value Hacked']
			},
			charts: [
				{
					type: 'bar',
					name: 'Total Value Hacked',
					encode: { x: 'timestamp', y: 'Total Value Hacked' },
					color: CHART_COLORS[0],
					stack: 'Total Value Hacked'
				}
			]
		},
		totalHacked: formatUsd(totalHacked, USD_LOWERCASE_MILLIONS_OPTIONS),
		totalHackedDefi: formatUsd(totalHackedDefi, USD_LOWERCASE_MILLIONS_OPTIONS),
		totalRugs: formatUsd(totalBridgeHacks, USD_LOWERCASE_MILLIONS_OPTIONS),
		pieChartData: preparePieChartData({
			data: Array.from(techniqueTotals, ([name, value]) => ({ name, value })),
			limit: CHART_SERIES_LIMIT
		})
	}

	if (!chainTotals || !classificationTotals) return summary

	const chainOptions = Array.from(chainTotals)
	chainOptions.sort(byTotalDescThenNameAsc)

	const classificationOptions = Array.from(classificationTotals)
	classificationOptions.sort(byTotalDescThenNameAsc)
	const sortedTechniqueTotals = Array.from(techniqueTotals)
	sortedTechniqueTotals.sort(byTotalDescThenNameAsc)

	return {
		...summary,
		chainOptions: withUnknown(chainOptions, missingChain),
		techniqueOptions: withUnknown(sortedTechniqueTotals, missingTechnique),
		classificationOptions: withUnknown(classificationOptions, missingClassification)
	}
}

export const buildFilteredHacksSummary = (data: Array<IHackRow>): HacksDisplaySummary => buildHacksSummary(data, false)

export const buildHacksPageSummary = (data: Array<IHackRow>): HacksPageSummary => buildHacksSummary(data, true)

export function filterHacksRows(data: Array<IHackRow>, filters: HacksFilterState): Array<IHackRow> {
	const { chains, techniques, classifications } = filters
	const filtered: Array<IHackRow> = []

	for (const row of data) {
		// A hack on several chains stays while any of them is selected.
		if (chains) {
			const rowChains = row.chains.length > 0 ? row.chains : [UNKNOWN_OPTION]
			if (!rowChains.some((chain) => chains.has(chain.trim()))) continue
		}
		if (techniques && !techniques.has(row.technique.trim() || UNKNOWN_OPTION)) continue
		if (classifications && !classifications.has(row.classification.trim() || UNKNOWN_OPTION)) continue

		if (filters.since !== null && (row.date === null || row.date < filters.since)) continue
		if (filters.minLost !== null || filters.maxLost !== null) {
			if (row.amountUsd === null) continue
			if (filters.minLost !== null && row.amountUsd < filters.minLost) continue
			if (filters.maxLost !== null && row.amountUsd > filters.maxLost) continue
		}

		filtered.push(row)
	}

	return filtered
}
