import type { BorrowMarketHistoryPoint, PoolHistoryPoint } from './types'

// [light, dark] hex pairs because ECharts can't resolve CSS vars; the client wrapper
// picks the entry for the active theme.
export type ChartColorKey = 'accent' | 'gold' | 'action' | 'chartFill' | 'warn' | 'mag'

export const CHART_PALETTE: Record<ChartColorKey, readonly [light: string, dark: string]> = {
	accent: ['#089981', '#22ab94'],
	gold: ['#f57f17', '#ffa726'],
	action: ['#2962ff', '#3179f5'],
	chartFill: ['#c2c8cf', '#515c6b'],
	warn: ['#f23645', '#f7525f'],
	mag: ['#7e8aa0', '#7e8aa0']
}

function ms(date: string): number {
	// Bare YYYY-MM-DD → pin to UTC midnight; anything else parse as-is.
	return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00Z` : date)
}

// `sign` is applied by the client at render (borrow "reward offset" draws below zero).
export interface PoolChartBar {
	key: string
	label: string
	colorKey: ChartColorKey
	sign?: 1 | -1
	values: (number | null)[]
	avg7: (number | null)[]
	avg30: (number | null)[]
}

export interface PoolChartLine {
	key: string
	label: string
	colorKey: ChartColorKey
	values: (number | null)[]
}

export interface PoolChartNet {
	key: string
	label: string
	colorKey: ChartColorKey
	values: (number | null)[]
	avg7: (number | null)[]
	avg30: (number | null)[]
}

export interface PoolChartModel {
	title: string
	// In "net" mode components are signed/diverging and the overlay uses netLine's own averages.
	net: boolean
	dates: number[]
	bars: PoolChartBar[]
	// Dollar-magnitude series on the secondary axis (toggleable, default off). Supply: [TVL];
	// borrow: [Borrowed, Available].
	lines: PoolChartLine[]
	netLine: PoolChartNet | null
}

export function buildSupplyChart(series: PoolHistoryPoint[], tvlLabel = 'TVL'): PoolChartModel | null {
	if (!series.length) return null
	const dates = new Array<number>(series.length)
	const tvl = new Array<number | null>(series.length)
	const base = new Array<number | null>(series.length)
	const base7 = new Array<number | null>(series.length)
	const base30 = new Array<number | null>(series.length)
	const reward = new Array<number | null>(series.length)
	const reward7 = new Array<number | null>(series.length)
	const reward30 = new Array<number | null>(series.length)
	const intrinsic = new Array<number | null>(series.length)
	const intrinsic7 = new Array<number | null>(series.length)
	const intrinsic30 = new Array<number | null>(series.length)
	const total = new Array<number | null>(series.length)
	const total7 = new Array<number | null>(series.length)
	const total30 = new Array<number | null>(series.length)
	let hasBase = false
	let hasReward = false
	let hasIntrinsic = false
	let hasTotal = false

	for (let index = 0; index < series.length; index++) {
		const point = series[index]
		dates[index] = ms(point.date)
		tvl[index] = point.tvl_usd
		base[index] = point.apy.avg_1d.base
		base7[index] = point.apy.avg_7d.base
		base30[index] = point.apy.avg_30d.base
		reward[index] = point.apy.avg_1d.reward
		reward7[index] = point.apy.avg_7d.reward
		reward30[index] = point.apy.avg_30d.reward
		intrinsic[index] = point.intrinsic?.apy.avg_1d.base ?? null
		intrinsic7[index] = point.intrinsic?.apy.avg_7d.base ?? null
		intrinsic30[index] = point.intrinsic?.apy.avg_30d.base ?? null
		total[index] = point.apy.avg_1d.total
		total7[index] = point.apy.avg_7d.total
		total30[index] = point.apy.avg_30d.total
		hasBase ||= base[index] != null
		hasReward ||= reward[index] != null
		hasIntrinsic ||= intrinsic[index] != null
		hasTotal ||= total[index] != null
	}

	// Unsplit pool (neither component ever reported): the apy is unattributable, so
	// the total draws as the single series instead of a component breakdown.
	const unsplit = !hasBase && !hasReward && hasTotal

	const bars: PoolChartBar[] = []
	if (hasBase)
		bars.push({
			key: 'base',
			label: 'Base',
			colorKey: 'accent',
			values: base,
			avg7: base7,
			avg30: base30
		})
	if (hasReward)
		bars.push({
			key: 'reward',
			label: 'Reward',
			colorKey: 'gold',
			values: reward,
			avg7: reward7,
			avg30: reward30
		})
	if (unsplit)
		bars.push({
			key: 'apy',
			label: 'APY',
			colorKey: 'accent',
			values: total,
			avg7: total7,
			avg30: total30
		})
	if (hasIntrinsic)
		bars.push({
			key: 'intrinsic',
			label: 'Intrinsic',
			colorKey: 'action',
			values: intrinsic,
			avg7: intrinsic7,
			avg30: intrinsic30
		})

	return {
		title: 'Supply APY',
		net: false,
		dates,
		bars,
		lines: [{ key: 'magnitude', label: tvlLabel, colorKey: 'mag', values: tvl }],
		netLine: null
	}
}

export function buildBorrowChart(series: BorrowMarketHistoryPoint[]): PoolChartModel | null {
	if (!series.length) return null
	const dates = new Array<number>(series.length)
	const borrowed = new Array<number | null>(series.length)
	const available = new Array<number | null>(series.length)
	const base = new Array<number | null>(series.length)
	const base7 = new Array<number | null>(series.length)
	const base30 = new Array<number | null>(series.length)
	const reward = new Array<number | null>(series.length)
	const reward7 = new Array<number | null>(series.length)
	const reward30 = new Array<number | null>(series.length)
	const intrinsic = new Array<number | null>(series.length)
	const intrinsic7 = new Array<number | null>(series.length)
	const intrinsic30 = new Array<number | null>(series.length)
	const net = new Array<number | null>(series.length)
	const net7 = new Array<number | null>(series.length)
	const net30 = new Array<number | null>(series.length)
	let hasBase = false
	let hasReward = false
	let hasIntrinsic = false

	for (let index = 0; index < series.length; index++) {
		const point = series[index]
		dates[index] = ms(point.date)
		borrowed[index] = point.total_borrow_usd
		available[index] = point.available_borrow_usd
		base[index] = point.borrow_cost_apy.avg_1d.base
		base7[index] = point.borrow_cost_apy.avg_7d.base
		base30[index] = point.borrow_cost_apy.avg_30d.base
		reward[index] = point.borrow_cost_apy.avg_1d.reward
		reward7[index] = point.borrow_cost_apy.avg_7d.reward
		reward30[index] = point.borrow_cost_apy.avg_30d.reward
		intrinsic[index] = point.intrinsic?.apy.avg_1d.base ?? null
		intrinsic7[index] = point.intrinsic?.apy.avg_7d.base ?? null
		intrinsic30[index] = point.intrinsic?.apy.avg_30d.base ?? null
		net[index] = point.borrow_cost_apy.avg_1d.total
		net7[index] = point.borrow_cost_apy.avg_7d.total
		net30[index] = point.borrow_cost_apy.avg_30d.total
		hasBase ||= base[index] != null
		hasReward ||= reward[index] != null
		hasIntrinsic ||= intrinsic[index] != null
	}

	const bars: PoolChartBar[] = []
	if (hasBase)
		bars.push({
			key: 'baseCost',
			label: 'Base cost',
			colorKey: 'chartFill',
			sign: 1,
			values: base,
			avg7: base7,
			avg30: base30
		})
	if (hasReward)
		bars.push({
			key: 'rewardOffset',
			label: 'Reward offset',
			colorKey: 'gold',
			sign: -1,
			values: reward,
			avg7: reward7,
			avg30: reward30
		})
	if (hasIntrinsic)
		bars.push({
			key: 'intrinsic',
			label: 'Intrinsic',
			colorKey: 'action',
			sign: 1,
			values: intrinsic,
			avg7: intrinsic7,
			avg30: intrinsic30
		})

	return {
		title: 'Borrow APY',
		net: true,
		dates,
		bars,
		lines: [
			{ key: 'magnitude', label: 'Borrowed', colorKey: 'mag', values: borrowed },
			{ key: 'available', label: 'Available', colorKey: 'accent', values: available }
		],
		netLine: {
			key: 'net',
			label: 'Net cost',
			colorKey: 'warn',
			values: net,
			avg7: net7,
			avg30: net30
		}
	}
}
