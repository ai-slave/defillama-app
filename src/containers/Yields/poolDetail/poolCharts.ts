import type { BorrowMarketHistoryPoint, PoolHistory, PoolHistoryPoint, VerifiedHistoryBlock } from './types'

// [light, dark] hex pairs because ECharts can't resolve CSS vars; the client wrapper
// picks the entry for the active theme.
export type ChartColorKey = 'accent' | 'gold' | 'action' | 'intrinsic' | 'chartFill' | 'warn' | 'mag' | 'verified'

/** The measured line's identity, shared with the metrics picker so its locked stand-in matches exactly. */
export const VERIFIED_APY_SERIES = { key: 'verifiedApy', label: 'Verified Base' } as const

export const CHART_PALETTE: Record<ChartColorKey, readonly [light: string, dark: string]> = {
	accent: ['#089981', '#22ab94'],
	gold: ['#f57f17', '#ffa726'],
	action: ['#2962ff', '#3179f5'],
	chartFill: ['#c2c8cf', '#515c6b'],
	warn: ['#f23645', '#f7525f'],
	mag: ['#7e8aa0', '#7e8aa0'],
	// Its own hue: intrinsic sits under the verified line, which owns the blue. Dark step is
	// violet-500; #a78bfa fell outside the dark lightness band (L 0.71 vs 0.48-0.67).
	intrinsic: ['#7c3aed', '#8b5cf6'],
	verified: ['#3b82f6', '#3b82f6']
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
	/** Key of the bar this one replaces: the two draw one at a time. */
	replaces?: string
	values: Array<number | null>
	avg7: Array<number | null>
	avg30: Array<number | null>
	/** The reported series a measured bar replaced, restored when access ends. */
	reported?: Pick<PoolChartBar, 'label' | 'values' | 'avg7' | 'avg30'>
}

/** The intrinsic source pool's measured APY, by day. */
export type IntrinsicApySeries = Record<string, VerifiedHistoryBlock['apy']>

export function buildIntrinsicApySeries(history: PoolHistory | null | undefined): IntrinsicApySeries | null {
	if (!history?.length) return null
	const series: IntrinsicApySeries = {}
	for (const point of history) {
		const apy = point.verified?.apy
		if (apy && Object.values(apy).some((value) => value != null)) series[point.date] = apy
	}
	return Object.keys(series).length > 0 ? series : null
}

/**
 * Whether a bar has a day it can draw before `today`. A stand-in whose first reading landed today has
 * none yet (today's reading completes at the next anchor), so defaulting to it would open the chart on
 * nothing instead of the reported history.
 */
export function hasDrawableDay(
	bar: PoolChartBar,
	dates: Array<number>,
	today: number = Date.now() - (Date.now() % 86_400_000)
): boolean {
	return bar.values.some((value, index) => value != null && dates[index]! < today)
}

export interface PoolChartLine {
	key: string
	label: string
	colorKey: ChartColorKey
	values: Array<number | null>
	unit: 'percent' | 'usd'
	defaultEnabled?: boolean
	avg7?: Array<number | null>
	avg30?: Array<number | null>
}

export interface PoolChartNet {
	key: string
	label: string
	colorKey: ChartColorKey
	values: Array<number | null>
	avg7: Array<number | null>
	avg30: Array<number | null>
}

export interface PoolChartModel {
	title: string
	// In "net" mode components are signed/diverging and the overlay uses netLine's own averages.
	net: boolean
	dates: Array<number>
	bars: Array<PoolChartBar>
	// Toggleable overlays. Dollar magnitudes use the secondary axis and default off; a percent
	// overlay uses the primary axis and can opt into default-on.
	lines: Array<PoolChartLine>
	netLine: PoolChartNet | null
}

export function buildSupplyChart(
	series: Array<PoolHistoryPoint>,
	tvlLabel = 'TVL',
	intrinsicApy: IntrinsicApySeries | null = null
): PoolChartModel | null {
	if (series.length === 0) return null
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
	const verified = new Array<number | null>(series.length)
	const verified7 = new Array<number | null>(series.length)
	const verified30 = new Array<number | null>(series.length)
	let hasBase = false
	let hasReward = false
	let hasIntrinsic = false
	let hasTotal = false
	let hasVerified = false

	for (let index = 0; index < series.length; index++) {
		const point = series[index]!
		dates[index] = ms(point.date)
		// Days the protocol never reported carry every reported field null while the verified block
		// is populated; the measured pool size keeps the TVL line honest across them, and on days the
		// exit could not price the supply, the same supply at the quoted rate does.
		tvl[index] = point.tvl_usd ?? point.verified?.tvl_usd ?? point.verified?.tvl_quoted_usd ?? null
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
		verified[index] = point.verified?.apy.avg_1d ?? null
		verified7[index] = point.verified?.apy.avg_7d ?? null
		verified30[index] = point.verified?.apy.avg_30d ?? null
		hasBase ||= base[index] != null
		hasReward ||= reward[index] != null
		hasIntrinsic ||= intrinsic[index] != null
		hasTotal ||= total[index] != null
		hasVerified ||= verified[index] != null
	}

	// Unsplit pool (neither component ever reported): the apy is unattributable, so
	// the total draws as the single series instead of a component breakdown.
	const unsplit = !hasBase && !hasReward && hasTotal

	// The verified base replaces the reported one rather than mixing with it: one base at a time.
	const bars: Array<PoolChartBar> = []
	if (hasVerified)
		bars.push({
			key: VERIFIED_APY_SERIES.key,
			label: VERIFIED_APY_SERIES.label,
			colorKey: 'verified',
			values: verified,
			avg7: verified7,
			avg30: verified30,
			...(hasBase ? { replaces: 'base' } : unsplit ? { replaces: 'apy' } : {})
		})
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
	if (hasIntrinsic) {
		const reported = { label: 'Intrinsic', values: intrinsic, avg7: intrinsic7, avg30: intrinsic30 }
		// Like the verified base, an unmeasured source day is a gap, never the reported rate.
		const measured = (window: keyof VerifiedHistoryBlock['apy']) =>
			series.map((point) => intrinsicApy?.[point.date]?.[window] ?? null)
		bars.push({
			key: 'intrinsic',
			colorKey: 'intrinsic',
			...(intrinsicApy
				? {
						label: 'Verified Intrinsic',
						values: measured('avg_1d'),
						avg7: measured('avg_7d'),
						avg30: measured('avg_30d'),
						reported
					}
				: reported)
		})
	}

	return {
		title: 'Supply APY',
		net: false,
		dates,
		bars,
		lines: [{ key: 'magnitude', label: tvlLabel, colorKey: 'mag', values: tvl, unit: 'usd' }],
		netLine: null
	}
}

/**
 * The reported view of a measured supply chart, for a reader whose access ended after the page was
 * built: the verified base drops and the bar it replaced draws alone, and a measured intrinsic leg
 * returns to the reported one, as the public build would.
 * (The TVL line may keep a measured pool size on days the protocol never reported.)
 */
export function stripVerifiedSeries(model: PoolChartModel): PoolChartModel {
	if (!model.bars.some((bar) => bar.key === VERIFIED_APY_SERIES.key || bar.reported)) return model
	const bars = model.bars.flatMap(({ reported, ...bar }) =>
		bar.key === VERIFIED_APY_SERIES.key ? [] : [{ ...bar, ...reported }]
	)
	return { ...model, bars }
}

export function buildBorrowChart(series: Array<BorrowMarketHistoryPoint>): PoolChartModel | null {
	if (series.length === 0) return null
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
		const point = series[index]!
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

	const bars: Array<PoolChartBar> = []
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
			colorKey: 'intrinsic',
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
			{ key: 'magnitude', label: 'Borrowed', colorKey: 'mag', values: borrowed, unit: 'usd' },
			{ key: 'available', label: 'Available', colorKey: 'accent', values: available, unit: 'usd' }
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
