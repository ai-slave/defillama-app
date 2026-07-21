import type {
	ChartTimeGroupingWithCumulative,
	MultiSeriesChartDataset,
	MultiSeriesChartSeriesConfig
} from '~/components/ECharts/MultiSeriesChart/types'
import { CHART_COLORS } from '~/constants/colors'
import { getGroupedTimestampSec } from './chartSeries.utils'

export type ProtocolFeeChartSeries = Array<[number, number]>
export type ProtocolFeeChartRows = Array<[number, number | null]>

const toRows = (store: Map<number, number | null>): ProtocolFeeChartRows =>
	Array.from(store, ([date, value]) => [date * 1e3, value] as [number, number | null]).sort((a, b) => a[0] - b[0])

interface ICumulativeBucket {
	fees: number
	revenue: number
	holdersRevenue: number
	extras: number
	feesEvent: boolean
	revenueEvent: boolean
	holdersRevenueEvent: boolean
	extrasEvent: boolean
	feesNull: boolean
	revenueNull: boolean
	holdersRevenueNull: boolean
	extrasNull: boolean
}

const getCumulativeBucket = (buckets: Map<number, ICumulativeBucket>, dateKey: number) => {
	let bucket = buckets.get(dateKey)
	if (bucket) return bucket
	bucket = {
		fees: 0,
		revenue: 0,
		holdersRevenue: 0,
		extras: 0,
		feesEvent: false,
		revenueEvent: false,
		holdersRevenueEvent: false,
		extrasEvent: false,
		feesNull: false,
		revenueNull: false,
		holdersRevenueNull: false,
		extrasNull: false
	}
	buckets.set(dateKey, bucket)
	return bucket
}

export function buildProtocolFeeFamilyCharts({
	fees,
	revenue,
	holdersRevenue,
	bribes,
	tokenTaxes,
	groupBy,
	denominationPriceHistory
}: {
	fees: ProtocolFeeChartSeries | null | undefined
	revenue: ProtocolFeeChartSeries | null | undefined
	holdersRevenue: ProtocolFeeChartSeries | null | undefined
	bribes: ProtocolFeeChartSeries | null | undefined
	tokenTaxes: ProtocolFeeChartSeries | null | undefined
	groupBy: ChartTimeGroupingWithCumulative
	denominationPriceHistory: Record<string, number> | null
}) {
	const feesStore = new Map<number, number | null>()
	const revenueStore = new Map<number, number | null>()
	const holdersRevenueStore = new Map<number, number | null>()
	const isCumulative = groupBy === 'cumulative'

	const applyValue = (date: number, value: number) => {
		if (!denominationPriceHistory) return value
		const price = denominationPriceHistory[String(date)] ?? denominationPriceHistory[String(date * 1e3)]
		return price ? value / price : null
	}

	if (isCumulative) {
		const buckets = new Map<number, ICumulativeBucket>()

		const applyBaseChart = (
			chart: ProtocolFeeChartSeries | null | undefined,
			key: 'fees' | 'revenue' | 'holdersRevenue',
			eventKey: 'feesEvent' | 'revenueEvent' | 'holdersRevenueEvent',
			nullKey: 'feesNull' | 'revenueNull' | 'holdersRevenueNull'
		) => {
			if (!chart) return
			for (const [date, value] of chart) {
				const dateKey = getGroupedTimestampSec(date, groupBy)
				const finalValue = applyValue(date, value)
				const bucket = getCumulativeBucket(buckets, dateKey)
				bucket[eventKey] = true
				if (finalValue == null) {
					bucket[nullKey] = true
					continue
				}
				bucket[key] += finalValue
			}
		}

		const applyExtraChart = (chart: ProtocolFeeChartSeries | null | undefined) => {
			if (!chart) return
			for (const [date, value] of chart) {
				const dateKey = getGroupedTimestampSec(date, groupBy)
				const finalValue = applyValue(date, value)
				const bucket = getCumulativeBucket(buckets, dateKey)
				bucket.extrasEvent = true
				if (finalValue == null) {
					bucket.extrasNull = true
					continue
				}
				bucket.extras += finalValue
			}
		}

		applyBaseChart(fees, 'fees', 'feesEvent', 'feesNull')
		applyBaseChart(revenue, 'revenue', 'revenueEvent', 'revenueNull')
		applyBaseChart(holdersRevenue, 'holdersRevenue', 'holdersRevenueEvent', 'holdersRevenueNull')
		applyExtraChart(bribes)
		applyExtraChart(tokenTaxes)

		let feesTotal = 0
		let revenueTotal = 0
		let holdersRevenueTotal = 0
		for (const dateKey of Array.from(buckets.keys()).sort((a, b) => a - b)) {
			const bucket = buckets.get(dateKey)!
			if (fees && (bucket.feesEvent || bucket.extrasEvent)) {
				if (bucket.feesNull || bucket.extrasNull) {
					feesStore.set(dateKey, null)
				} else {
					feesTotal += bucket.fees + bucket.extras
					feesStore.set(dateKey, feesTotal)
				}
			}
			if (revenue && (bucket.revenueEvent || bucket.extrasEvent)) {
				if (bucket.revenueNull || bucket.extrasNull) {
					revenueStore.set(dateKey, null)
				} else {
					revenueTotal += bucket.revenue + bucket.extras
					revenueStore.set(dateKey, revenueTotal)
				}
			}
			if (holdersRevenue && (bucket.holdersRevenueEvent || bucket.extrasEvent)) {
				if (bucket.holdersRevenueNull || bucket.extrasNull) {
					holdersRevenueStore.set(dateKey, null)
				} else {
					holdersRevenueTotal += bucket.holdersRevenue + bucket.extras
					holdersRevenueStore.set(dateKey, holdersRevenueTotal)
				}
			}
		}

		return {
			fees: toRows(feesStore),
			revenue: toRows(revenueStore),
			holdersRevenue: toRows(holdersRevenueStore)
		}
	}

	const applyBaseChart = (chart: ProtocolFeeChartSeries | null | undefined, store: Map<number, number | null>) => {
		if (!chart) return
		let total = 0
		for (const [date, value] of chart) {
			const dateKey = getGroupedTimestampSec(date, groupBy)
			const finalValue = applyValue(date, value)
			if (finalValue == null) {
				store.set(dateKey, null)
				continue
			}
			if (store.get(dateKey) === null) continue
			store.set(dateKey, (store.get(dateKey) ?? 0) + finalValue + total)
			if (isCumulative) total += finalValue
		}
	}

	const applyExtraChart = (chart: ProtocolFeeChartSeries | null | undefined) => {
		if (!chart) return
		let total = 0
		for (const [date, value] of chart) {
			const dateKey = getGroupedTimestampSec(date, groupBy)
			const finalValue = applyValue(date, value)
			if (finalValue == null) {
				if (fees) feesStore.set(dateKey, null)
				if (revenue) revenueStore.set(dateKey, null)
				if (holdersRevenue) holdersRevenueStore.set(dateKey, null)
				continue
			}
			if (fees && feesStore.get(dateKey) !== null)
				feesStore.set(dateKey, (feesStore.get(dateKey) ?? 0) + finalValue + total)
			if (revenue && revenueStore.get(dateKey) !== null)
				revenueStore.set(dateKey, (revenueStore.get(dateKey) ?? 0) + finalValue + total)
			if (holdersRevenue && holdersRevenueStore.get(dateKey) !== null)
				holdersRevenueStore.set(dateKey, (holdersRevenueStore.get(dateKey) ?? 0) + finalValue + total)
			if (isCumulative) total += finalValue
		}
	}

	applyBaseChart(fees, feesStore)
	applyBaseChart(revenue, revenueStore)
	applyBaseChart(holdersRevenue, holdersRevenueStore)
	applyExtraChart(bribes)
	applyExtraChart(tokenTaxes)

	return {
		fees: toRows(feesStore),
		revenue: toRows(revenueStore),
		holdersRevenue: toRows(holdersRevenueStore)
	}
}

const FEE_CHART_DEFINITIONS = [
	{ key: 'fees', name: 'Fees', color: CHART_COLORS[0] },
	{ key: 'revenue', name: 'Revenue', color: CHART_COLORS[1] },
	{ key: 'holdersRevenue', name: 'Holders Revenue', color: CHART_COLORS[2] }
] as const

const EMPTY_FEE_CHART_PRESENTATION = {
	dataset: { source: [], dimensions: ['timestamp'] },
	charts: []
} satisfies { dataset: MultiSeriesChartDataset; charts: MultiSeriesChartSeriesConfig[] }

function buildDailyFeeExtraTotals(
	bribes: ProtocolFeeChartSeries | null,
	tokenTaxes: ProtocolFeeChartSeries | null
): Map<number, number> {
	const totals = new Map<number, number>()
	const lastValues = new Map<number, number>()
	for (const chart of [bribes, tokenTaxes]) {
		if (!chart) continue
		lastValues.clear()
		for (const [timestamp, value] of chart) lastValues.set(timestamp, value)
		for (const [timestamp, value] of lastValues) totals.set(timestamp, (totals.get(timestamp) ?? 0) + value)
	}
	return totals
}

export function buildProtocolFeeChartPresentation({
	fees,
	revenue,
	holdersRevenue,
	bribes,
	tokenTaxes,
	selectedCharts,
	groupBy
}: {
	fees: ProtocolFeeChartSeries
	revenue: ProtocolFeeChartSeries
	holdersRevenue: ProtocolFeeChartSeries
	bribes: ProtocolFeeChartSeries | null
	tokenTaxes: ProtocolFeeChartSeries | null
	selectedCharts: readonly string[]
	groupBy: ChartTimeGroupingWithCumulative
}): { dataset: MultiSeriesChartDataset; charts: MultiSeriesChartSeriesConfig[] } {
	const selected = new Set(selectedCharts)
	if (selected.size === 0) return EMPTY_FEE_CHART_PRESENTATION
	const rowsByTimestamp = new Map<number, Array<number | null>>()
	const dimensions = ['timestamp']
	const charts: MultiSeriesChartSeriesConfig[] = []
	const seriesType = groupBy === 'cumulative' ? 'line' : 'bar'
	const selectedDefinitions = FEE_CHART_DEFINITIONS.filter((definition) => selected.has(definition.name))

	for (let index = 0; index < selectedDefinitions.length; index++) {
		const definition = selectedDefinitions[index]
		dimensions.push(definition.name)
		charts.push({
			type: seriesType,
			name: definition.name,
			encode: { x: 0, y: index + 1 },
			color: definition.color,
			stack: definition.name
		})
	}

	if (groupBy === 'daily') {
		const baseByKey = { fees, revenue, holdersRevenue }
		for (let definitionIndex = 0; definitionIndex < selectedDefinitions.length; definitionIndex++) {
			const definition = selectedDefinitions[definitionIndex]
			for (const [timestampSec, value] of baseByKey[definition.key]) {
				const timestamp = timestampSec * 1e3
				const row =
					rowsByTimestamp.get(timestamp) ?? new Array<number | null>(selectedDefinitions.length + 1).fill(null)
				row[0] = timestamp
				row[definitionIndex + 1] = value
				rowsByTimestamp.set(timestamp, row)
			}
		}
		for (const [timestampSec, value] of buildDailyFeeExtraTotals(bribes, tokenTaxes)) {
			const timestamp = timestampSec * 1e3
			const row = rowsByTimestamp.get(timestamp) ?? new Array<number | null>(selectedDefinitions.length + 1).fill(null)
			row[0] = timestamp
			for (let definitionIndex = 0; definitionIndex < selectedDefinitions.length; definitionIndex++) {
				row[definitionIndex + 1] = (row[definitionIndex + 1] ?? 0) + value
			}
			rowsByTimestamp.set(timestamp, row)
		}
	} else {
		const grouped = buildProtocolFeeFamilyCharts({
			fees: selected.has('Fees') ? fees : null,
			revenue: selected.has('Revenue') ? revenue : null,
			holdersRevenue: selected.has('Holders Revenue') ? holdersRevenue : null,
			bribes,
			tokenTaxes,
			groupBy,
			denominationPriceHistory: null
		})

		for (let definitionIndex = 0; definitionIndex < selectedDefinitions.length; definitionIndex++) {
			const definition = selectedDefinitions[definitionIndex]
			for (const [timestamp, value] of grouped[definition.key]) {
				const row =
					rowsByTimestamp.get(timestamp) ?? new Array<number | null>(selectedDefinitions.length + 1).fill(null)
				row[0] = timestamp
				row[definitionIndex + 1] = value
				rowsByTimestamp.set(timestamp, row)
			}
		}
	}

	return {
		dataset: {
			source: Array.from(rowsByTimestamp.values()).sort((a, b) => a[0]! - b[0]!),
			dimensions
		},
		charts
	}
}
