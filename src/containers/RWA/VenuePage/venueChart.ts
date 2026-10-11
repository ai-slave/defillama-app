import type { MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { formatLineChart } from '~/components/ECharts/shared/timeSeries'
import { CHART_COLORS } from '~/constants/colors'
import type { RWAFlowGrouping } from '../flows'
import { perpsDefinitions } from '../Perps/definitions'
import type { RWAEntityChart, RWAEntityChartCatalog } from '../platformChart/entityChart'
import { cumulativeRwaPoints, getRwaMilestoneHallmarks, periodBarSeries, rwaLineSeries } from '../platformChart/metrics'
import type { RWAPlatformMilestone } from '../PlatformPage/api.types'

/* The venue page's two charts. Every route carries `venue=`: the server splits the venue's own markets, never the
   global contract split. The entity chart sums a split into one series per metric; there is no venue funding series
   until the server folds funding per venue. Pure: the panels fetch and render. */

type RWAVenueChartMetricKey = 'openInterest' | 'volume' | 'markets' | 'cumulativeVolume' | 'oiShare' | 'events'
export const RWA_VENUE_CHART: RWAEntityChartCatalog<RWAVenueChartMetricKey> = {
	groups: ['Core', 'Activity', 'Ratios', 'Annotations'],
	defaults: ['openInterest'],
	metrics: [
		{
			key: 'openInterest',
			label: 'Open Interest',
			group: 'Core',
			description: perpsDefinitions.totalOpenInterest.description
		},
		{ key: 'volume', label: 'Volume', group: 'Core', description: perpsDefinitions.totalVolume24h.description },
		{ key: 'markets', label: 'Markets', group: 'Core', description: 'Markets the venue lists on the day.' },
		{
			key: 'cumulativeVolume',
			label: 'Cumulative Volume',
			group: 'Activity',
			description: 'Daily volume added up since the first tracked day.'
		},
		{
			key: 'oiShare',
			label: 'Share of RWA Perps OI',
			group: 'Ratios',
			description: "The venue's open interest as a share of all RWA perps open interest, the total /rwa/perps draws."
		},
		{
			key: 'events',
			label: 'Events',
			group: 'Annotations',
			description: 'The milestones the index records, marked on the time axis.'
		}
	]
}

type RWAVenueChartInputs = {
	openInterest: Array<[number, number]>
	volume: Array<[number, number]>
	markets: Array<[number, number]>
	/** All RWA perps open interest per day; empty until Share of RWA Perps OI asks for it. */
	totalOpenInterest: Array<[number, number]>
	milestones: Array<RWAPlatformMilestone>
	period: RWAFlowGrouping
}

/** Axis 0 open interest, 1 volume, 2 counts, 3 percent: volume bars on the open interest axis would flatten. */
const OI_AXIS = 0
const VOLUME_AXIS = 1
const COUNT_AXIS = 2
const PERCENT_AXIS = 3

/** The venue's open interest over all RWA perps open interest per day, in percent; a day without a total is left out. */
export function buildRwaVenueOiShare(
	venue: Array<[number, number]>,
	total: Array<[number, number]>
): Array<[number, number]> {
	const totalByDay = new Map<number, number>()
	for (const [timestamp, value] of total) if (value > 0) totalByDay.set(timestamp, value)
	const out: Array<[number, number]> = []
	for (const [timestamp, value] of venue) {
		const base = totalByDay.get(timestamp)
		if (base) out.push([timestamp, (value / base) * 100])
	}
	return out
}

/** One series per selected metric, in catalog order, the platform entity chart's shape. */
export function buildRwaVenueEntityChart(
	selected: ReadonlyArray<RWAVenueChartMetricKey>,
	inputs: RWAVenueChartInputs
): RWAEntityChart {
	const levels = (points: Array<[number, number]>) =>
		formatLineChart({ data: points, groupBy: inputs.period, dateInMs: true, denominationPriceHistory: null })
	const series: Array<MultiSeriesChartSeriesConfig> = []
	for (const { key, label } of RWA_VENUE_CHART.metrics) {
		if (!selected.includes(key)) continue
		switch (key) {
			case 'openInterest':
				series.push(
					rwaLineSeries(label, levels(inputs.openInterest), {
						axis: OI_AXIS,
						color: CHART_COLORS[0],
						symbol: '$',
						fill: true
					})
				)
				break
			case 'volume':
				series.push(
					periodBarSeries(label, inputs.volume, {
						axis: VOLUME_AXIS,
						color: CHART_COLORS[1],
						period: inputs.period
					})
				)
				break
			case 'markets':
				series.push(
					rwaLineSeries(label, levels(inputs.markets), { axis: COUNT_AXIS, color: CHART_COLORS[3], symbol: '' })
				)
				break
			case 'cumulativeVolume':
				series.push(
					rwaLineSeries(label, levels(cumulativeRwaPoints(inputs.volume)), {
						axis: VOLUME_AXIS,
						color: CHART_COLORS[4],
						symbol: '$'
					})
				)
				break
			case 'oiShare':
				series.push(
					rwaLineSeries(label, levels(buildRwaVenueOiShare(inputs.openInterest, inputs.totalOpenInterest)), {
						axis: PERCENT_AXIS,
						color: CHART_COLORS[2],
						symbol: '%'
					})
				)
				break
			case 'events':
				break
		}
	}
	return { series, hallmarks: selected.includes('events') ? getRwaMilestoneHallmarks(inputs.milestones) : [] }
}
