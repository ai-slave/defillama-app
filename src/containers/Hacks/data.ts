import { preparePieChartData } from '~/components/ECharts/PieChart/data'
import { CHART_COLORS } from '~/constants/colors'
import { firstDayOfMonth } from '~/utils'
import { formatUsd } from '~/utils/numberFormat'
import type { IHacksPageData, IHackRow } from './types'

export interface HacksFilterState {
	chainKeys: Set<string> | undefined
	techKeys: Set<string> | undefined
	classKeys: Set<string> | undefined
	chainIncludeNone: boolean
	techIncludeNone: boolean
	classIncludeNone: boolean
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

const formatTotal = (value: number): string =>
	formatUsd(value, {
		compact: true,
		minimumCompactValue: 1_000_000,
		compactSuffix: 'lowercase'
	})

const addToTotal = (totals: Map<string, number>, key: string, amount: number): void => {
	if (!key) return
	totals.set(key, (totals.get(key) ?? 0) + amount)
}

const byTotalDescThenNameAsc = (left: [string, number], right: [string, number]): number =>
	right[1] - left[1] || left[0].localeCompare(right[0])

/** Incident nulls stay unavailable; only additive aggregates give them zero contribution. */
function buildHacksSummary(data: IHackRow[], collectFilterOptions: false): HacksDisplaySummary
function buildHacksSummary(data: IHackRow[], collectFilterOptions: true): HacksPageSummary
function buildHacksSummary(data: IHackRow[], collectFilterOptions: boolean): HacksDisplaySummary | HacksPageSummary {
	const monthlyHacks = new Map<number, number>()
	const techniqueTotals = new Map<string, number>()
	const chainTotals = collectFilterOptions ? new Map<string, number>() : null
	const classificationTotals = collectFilterOptions ? new Map<string, number>() : null
	let totalHacked = 0
	let totalHackedDefi = 0
	let totalBridgeHacks = 0

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
		totalHacked: formatTotal(totalHacked),
		totalHackedDefi: formatTotal(totalHackedDefi),
		totalRugs: formatTotal(totalBridgeHacks),
		pieChartData: preparePieChartData({
			data: Array.from(techniqueTotals, ([name, value]) => ({ name, value })),
			limit: 15
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
		chainOptions: chainOptions.map(([name]) => name),
		techniqueOptions: sortedTechniqueTotals.map(([name]) => name),
		classificationOptions: classificationOptions.map(([name]) => name)
	}
}

export const buildFilteredHacksSummary = (data: IHackRow[]): HacksDisplaySummary => buildHacksSummary(data, false)

export const buildHacksPageSummary = (data: IHackRow[]): HacksPageSummary => buildHacksSummary(data, true)

export function filterHacksRows(data: IHackRow[], filters: HacksFilterState): IHackRow[] {
	const filtered: IHackRow[] = []

	for (const row of data) {
		if (filters.chainKeys && (filters.chainKeys.size > 0 || filters.chainIncludeNone)) {
			const matchesNone = filters.chainIncludeNone && row.chains.length === 0
			let matchesAny = false
			for (const chain of row.chains) {
				if (filters.chainKeys.has(chain.trim())) {
					matchesAny = true
					break
				}
			}
			if (!matchesNone && !matchesAny) continue
		}

		if (filters.techKeys && (filters.techKeys.size > 0 || filters.techIncludeNone)) {
			const technique = row.technique.trim()
			if (!(filters.techIncludeNone && technique === '') && !filters.techKeys.has(technique)) continue
		}

		if (filters.classKeys && (filters.classKeys.size > 0 || filters.classIncludeNone)) {
			const classification = row.classification.trim()
			if (!(filters.classIncludeNone && classification === '') && !filters.classKeys.has(classification)) continue
		}

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
