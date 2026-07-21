import { buildColumnarTimeSeriesDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { FLARE_BLUE, FLARE_GREEN, FLARE_ORANGE, FLARE_PINK, timeSeriesChartOptions } from './chartDefaults'
import { parseDateToTimestampMs, type UpstreamChart, type UpstreamSeries } from './transform'

interface FormattedValue {
	value: number
	formatted: string
}

export interface OverviewAPIResponse {
	tvl: {
		tvlChart: UpstreamChart
		kpis: { currentTvl: FormattedValue }
	}
	stablecoins: {
		stablecoinChart: UpstreamChart
		kpis: {
			currentCirculating: FormattedValue
			currentMinted: FormattedValue
			currentBridged: FormattedValue
		}
	}
	fxrp?: {
		kpis: {
			totalFxrpSupply: FormattedValue
			pctLockedInDefi: FormattedValue
			valueLockedInDefiUsd: FormattedValue
		}
	}
}

export interface NetworkAPIResponse {
	transactionsChart: UpstreamChart
	activeAccountsChart: UpstreamChart
	kpis: {
		totalTransactions: FormattedValue
		transactions24h: FormattedValue
		avgDailyTxs7d: FormattedValue
		avgDailyTxs30d: FormattedValue
		totalAddresses: FormattedValue
	}
}

export interface StakingAPIResponse {
	narrative?: string
	stakingDelegationChart?: UpstreamChart
	kpis: {
		pctStakedOrDelegated: FormattedValue
		ftsoDelegated: FormattedValue
		ftsoDelegatedUsd?: FormattedValue
		totalStake: FormattedValue
		validatorCount: FormattedValue
		averageUptime: FormattedValue
	}
}

interface DistributionChart {
	title?: string
	labels: string[]
	series: { name: string; data: number[] }[]
}

export interface FAssetsAPIResponse {
	narrative?: string
	lockedOverTimeChart?: UpstreamChart
	distributionChart?: DistributionChart
	kpis: {
		totalFxrpSupply: FormattedValue
		pctLockedInDefi: FormattedValue
		valueLockedInDefiUsd: FormattedValue
		fxrpLockedInDefi: FormattedValue
		totalDefiTransactions: FormattedValue
		totalMinters: FormattedValue
		mintCount: FormattedValue
		burnCount: FormattedValue
		swapCount: FormattedValue
	}
}

export interface TokenomicsAPIResponse {
	narrative?: string
	burn: {
		burnChart: UpstreamChart
		firePool: { status: string; note: string; burnDestination: string }
		kpis: {
			latestDailyBurn: FormattedValue
			burn7d: FormattedValue
			burn30d: FormattedValue
			burnYtd: FormattedValue
			totalGasBurned: FormattedValue
		}
	}
	emissions: {
		emissionsChart: UpstreamChart
		burnVsEmitChart: UpstreamChart
		kpis: {
			latestEpochEmit: FormattedValue
			latestEpochBurn: FormattedValue
			latestNetInflation: FormattedValue
			latestBurnVsEmitPct: FormattedValue
			emit30d: FormattedValue
			burn30d: FormattedValue
			netInflation30d: FormattedValue
			burnVsEmit30dPct: FormattedValue
			cumulativeEmissionsTracked: FormattedValue
			epochsTracked: FormattedValue
		}
		note?: string
	}
}

const DAILY_BURN_CHART: MultiSeriesChartSeriesConfig[] = [
	{
		type: 'bar',
		name: 'Daily Burn',
		encode: { x: 0, y: 1 },
		color: FLARE_ORANGE,
		stack: 'a'
	}
]

const CUMULATIVE_BURN_CHART: MultiSeriesChartSeriesConfig[] = [
	{
		type: 'line',
		name: 'Cumulative Burn',
		encode: { x: 0, y: 1 },
		color: FLARE_PINK
	}
]

const PER_EPOCH_CHART: MultiSeriesChartSeriesConfig[] = [
	{
		type: 'bar',
		name: 'Per Epoch',
		encode: { x: 'timestamp', y: 'Per Epoch' },
		color: FLARE_BLUE,
		stack: 'a'
	}
]

const BURN_VS_EMIT_SERIES = ['FLR Emitted', 'FLR Burned', 'Net Inflation'] as const
const BURN_VS_EMIT_CHARTS: MultiSeriesChartSeriesConfig[] = [
	{
		type: 'bar',
		name: 'FLR Emitted',
		encode: { x: 'timestamp', y: 'FLR Emitted' },
		color: FLARE_BLUE,
		stack: 'a'
	},
	{
		type: 'bar',
		name: 'FLR Burned',
		encode: { x: 'timestamp', y: 'FLR Burned' },
		color: FLARE_ORANGE,
		stack: 'b'
	},
	{
		type: 'bar',
		name: 'Net Inflation',
		encode: { x: 'timestamp', y: 'Net Inflation' },
		color: FLARE_PINK,
		stack: 'c'
	}
]

const DONUT_PALETTE = [FLARE_ORANGE, FLARE_PINK, '#7C2D9C', FLARE_BLUE, FLARE_GREEN, '#FBBF24', '#06B6D4', '#A855F7']

export function buildFlareOverviewData(data: OverviewAPIResponse) {
	const tvlChartConfigs = new Array<MultiSeriesChartSeriesConfig>(data.tvl.tvlChart.series.length)
	for (let i = 0; i < data.tvl.tvlChart.series.length; i++) {
		const name = data.tvl.tvlChart.series[i].name
		tvlChartConfigs[i] = {
			type: 'line',
			name,
			encode: { x: 'timestamp', y: name },
			color: FLARE_PINK
		}
	}

	const stableSeries: UpstreamSeries[] = []
	const stableChartConfigs: MultiSeriesChartSeriesConfig[] = []
	for (const series of data.stablecoins.stablecoinChart.series) {
		if (/total/i.test(series.name)) continue
		stableSeries.push(series)
		stableChartConfigs.push({
			type: 'line',
			name: series.name,
			encode: { x: 'timestamp', y: series.name },
			stack: 'Total'
		})
	}

	const fxrp = data.fxrp?.kpis
	return {
		fxrp: fxrp
			? {
					totalFxrpSupply: fxrp.totalFxrpSupply.formatted,
					pctLockedInDefi: fxrp.pctLockedInDefi.formatted,
					valueLockedInDefiUsd: fxrp.valueLockedInDefiUsd.formatted
				}
			: null,
		tvl: {
			title: data.tvl.tvlChart.title ?? 'Flare TVL',
			dataset: buildColumnarTimeSeriesDataset(
				data.tvl.tvlChart.dates,
				data.tvl.tvlChart.series,
				parseDateToTimestampMs,
				0
			),
			chartOptions: timeSeriesChartOptions(data.tvl.tvlChart.dates.length, '$'),
			charts: tvlChartConfigs,
			currentFormatted: data.tvl.kpis.currentTvl.formatted
		},
		stables: {
			title: data.stablecoins.stablecoinChart.title ?? 'Stablecoin Supply on Flare',
			dataset: buildColumnarTimeSeriesDataset(
				data.stablecoins.stablecoinChart.dates,
				stableSeries,
				parseDateToTimestampMs,
				0
			),
			chartOptions: timeSeriesChartOptions(data.stablecoins.stablecoinChart.dates.length, '$'),
			charts: stableChartConfigs,
			kpis: {
				total: data.stablecoins.kpis.currentCirculating.formatted,
				native: data.stablecoins.kpis.currentMinted.formatted,
				bridged: data.stablecoins.kpis.currentBridged.formatted
			}
		}
	}
}

function buildNetworkChart(chart: UpstreamChart, fallbackName: string, color: string) {
	const series = chart.series.slice(0, 1)
	const seriesName = series[0]?.name ?? fallbackName
	const dataset = buildColumnarTimeSeriesDataset(chart.dates, series, parseDateToTimestampMs, 0)
	return {
		dataset,
		title: chart.title,
		chartOptions: timeSeriesChartOptions(dataset.source.length, ''),
		charts: [
			{
				type: 'bar',
				name: seriesName,
				encode: { x: 'timestamp', y: seriesName },
				color,
				stack: 'a'
			}
		] satisfies MultiSeriesChartSeriesConfig[]
	}
}

export function buildFlareNetworkData(data: NetworkAPIResponse) {
	return {
		kpis: {
			totalTransactions: data.kpis.totalTransactions.formatted,
			transactions24h: data.kpis.transactions24h.formatted,
			avgDailyTxs7d: data.kpis.avgDailyTxs7d.formatted,
			avgDailyTxs30d: data.kpis.avgDailyTxs30d.formatted,
			totalAddresses: data.kpis.totalAddresses.formatted
		},
		charts: {
			transactions: buildNetworkChart(data.transactionsChart, 'Transactions', FLARE_BLUE),
			activeAccounts: buildNetworkChart(data.activeAccountsChart, 'Active Accounts', FLARE_GREEN)
		}
	}
}

export function buildFlareStakingData(data: StakingAPIResponse) {
	const upstreamChart = data.stakingDelegationChart
	let chart = null
	if (upstreamChart) {
		const colors = {}
		const seriesNames = new Array<string>(upstreamChart.series.length)
		const charts = new Array<MultiSeriesChartSeriesConfig>(upstreamChart.series.length)
		for (let i = 0; i < upstreamChart.series.length; i++) {
			const name = upstreamChart.series[i].name
			const color = /ftso|deleg/i.test(name) ? FLARE_BLUE : FLARE_ORANGE
			colors[name] = color
			seriesNames[i] = name
			charts[i] = {
				type: 'line',
				name,
				encode: { x: 'timestamp', y: name },
				color,
				hideAreaStyle: true
			}
		}
		chart = {
			title: upstreamChart.title ?? 'P-Chain Staking vs. FTSO Delegation',
			subtitle: upstreamChart.subtitle,
			dataset: buildColumnarTimeSeriesDataset(upstreamChart.dates, upstreamChart.series, parseDateToTimestampMs, 0),
			chartOptions: timeSeriesChartOptions(upstreamChart.dates.length, ''),
			charts,
			seriesNames,
			colors
		}
	}

	return {
		narrative: data.narrative,
		kpis: {
			pctStakedOrDelegated: data.kpis.pctStakedOrDelegated.formatted,
			ftsoDelegated: data.kpis.ftsoDelegated.formatted,
			ftsoDelegatedUsd: data.kpis.ftsoDelegatedUsd?.formatted,
			totalStake: data.kpis.totalStake.formatted,
			validatorCount: data.kpis.validatorCount.formatted,
			averageUptime: data.kpis.averageUptime.formatted
		},
		chart
	}
}

export function buildFlareFAssetsData(data: FAssetsAPIResponse) {
	const locked = data.lockedOverTimeChart
	const lockedSeries: UpstreamSeries[] = []
	if (locked) {
		for (const series of locked.series) {
			if (/USD/i.test(series.name)) lockedSeries.push(series)
		}
		if (lockedSeries.length === 0 && locked.series[0]) lockedSeries.push(locked.series[0])
	}

	let lockedChart = null
	if (locked && lockedSeries.length > 0) {
		const charts = new Array<MultiSeriesChartSeriesConfig>(lockedSeries.length)
		for (let i = 0; i < lockedSeries.length; i++) {
			const name = lockedSeries[i].name
			charts[i] = {
				type: 'line',
				name,
				encode: { x: 'timestamp', y: name },
				...(i === 0 ? { color: FLARE_PINK } : { hideAreaStyle: true })
			}
		}
		lockedChart = {
			title: locked.title ?? 'FXRP Locked in DeFi Over Time',
			dataset: buildColumnarTimeSeriesDataset(locked.dates, lockedSeries, parseDateToTimestampMs, 0),
			chartOptions: timeSeriesChartOptions(locked.dates.length, '$'),
			charts
		}
	}

	const dist = data.distributionChart
	let distribution = null
	if (dist && dist.series[0] && dist.labels.length > 0) {
		const rows = new Array<{ name: string; value: number }>(dist.labels.length)
		const colors = {}
		for (let i = 0; i < dist.labels.length; i++) {
			const name = dist.labels[i]
			rows[i] = { name, value: dist.series[0].data[i] ?? 0 }
			colors[name] = DONUT_PALETTE[i % DONUT_PALETTE.length]
		}
		distribution = {
			title: dist.title ?? 'FXRP Distribution Across DeFi Protocols',
			data: rows,
			colors
		}
	}

	return {
		narrative: data.narrative,
		kpis: {
			totalFxrpSupply: data.kpis.totalFxrpSupply.formatted,
			pctLockedInDefi: data.kpis.pctLockedInDefi.formatted,
			valueLockedInDefiUsd: data.kpis.valueLockedInDefiUsd.formatted,
			fxrpLockedInDefi: data.kpis.fxrpLockedInDefi.formatted,
			totalDefiTransactions: data.kpis.totalDefiTransactions.formatted,
			totalMinters: data.kpis.totalMinters.formatted,
			mintCount: data.kpis.mintCount.formatted,
			burnCount: data.kpis.burnCount.formatted,
			swapCount: data.kpis.swapCount.formatted
		},
		charts: { locked: lockedChart, dist: distribution }
	}
}

export function buildFlareTokenomicsData(data: TokenomicsAPIResponse) {
	const burn = data.burn
	const emissions = data.emissions
	let dailyBurn: UpstreamSeries | undefined
	let cumulativeBurn: UpstreamSeries | undefined
	for (const series of burn.burnChart.series) {
		if (series.name === 'Daily Burn' && !dailyBurn) dailyBurn = series
		else if (series.name === 'Cumulative Burn' && !cumulativeBurn) cumulativeBurn = series
	}
	const dailyBurnSource: MultiSeriesChartDataset['source'] = []
	const cumulativeBurnSource: MultiSeriesChartDataset['source'] = []
	for (let i = 0; i < burn.burnChart.dates.length; i++) {
		const timestamp = parseDateToTimestampMs(burn.burnChart.dates[i])
		dailyBurnSource.push([timestamp, dailyBurn?.data[i] ?? 0])
		// Cumulative Burn is already an API snapshot and must not be summed again.
		cumulativeBurnSource.push([timestamp, cumulativeBurn?.data[i] ?? 0])
	}

	const perEpochSeries: UpstreamSeries[] = []
	for (const series of emissions.emissionsChart.series) {
		if (series.name === 'Per Epoch') perEpochSeries.push(series)
	}

	let emittedSeries: UpstreamSeries | undefined
	let burnedSeries: UpstreamSeries | undefined
	let netInflationSeries: UpstreamSeries | undefined
	for (const series of emissions.burnVsEmitChart.series) {
		if (series.name === BURN_VS_EMIT_SERIES[0] && !emittedSeries) emittedSeries = series
		else if (series.name === BURN_VS_EMIT_SERIES[1] && !burnedSeries) burnedSeries = series
		else if (series.name === BURN_VS_EMIT_SERIES[2] && !netInflationSeries) netInflationSeries = series
	}
	const burnVsEmitSeries: UpstreamSeries[] = []
	if (emittedSeries) burnVsEmitSeries.push(emittedSeries)
	if (burnedSeries) burnVsEmitSeries.push(burnedSeries)
	if (netInflationSeries) burnVsEmitSeries.push(netInflationSeries)

	const chartOptions = timeSeriesChartOptions(burn.burnChart.dates.length, '')
	return {
		narrative: data.narrative,
		burn: {
			burnTitle: burn.burnChart.title ?? 'FLR Burned (Daily Gas)',
			dailyDataset: {
				source: dailyBurnSource,
				dimensions: ['timestamp', 'Daily Burn']
			} satisfies MultiSeriesChartDataset,
			cumulativeDataset: {
				source: cumulativeBurnSource,
				dimensions: ['timestamp', 'Cumulative Burn']
			} satisfies MultiSeriesChartDataset,
			chartOptions,
			charts: {
				daily: DAILY_BURN_CHART,
				cumulative: CUMULATIVE_BURN_CHART
			},
			kpis: {
				latestDailyBurn: burn.kpis.latestDailyBurn.formatted,
				burn7d: burn.kpis.burn7d.formatted,
				burn30d: burn.kpis.burn30d.formatted,
				burnYtd: burn.kpis.burnYtd.formatted,
				totalGasBurned: burn.kpis.totalGasBurned.formatted
			},
			firePoolNote: burn.firePool.note
		},
		emissions: {
			emissionsTitle: emissions.emissionsChart.title ?? 'FLR Emissions per Epoch',
			burnVsEmitTitle: emissions.burnVsEmitChart.title ?? 'Burn vs. Emit',
			burnVsEmitSubtitle: emissions.burnVsEmitChart.subtitle,
			perEpochDataset: buildColumnarTimeSeriesDataset(
				emissions.emissionsChart.dates,
				perEpochSeries,
				parseDateToTimestampMs,
				0
			),
			burnVsEmitDataset: buildColumnarTimeSeriesDataset(
				emissions.burnVsEmitChart.dates,
				burnVsEmitSeries,
				parseDateToTimestampMs,
				0
			),
			perEpochChartOptions: timeSeriesChartOptions(emissions.emissionsChart.dates.length, ''),
			burnVsEmitChartOptions: timeSeriesChartOptions(emissions.burnVsEmitChart.dates.length, ''),
			charts: {
				perEpoch: PER_EPOCH_CHART,
				burnVsEmit: BURN_VS_EMIT_CHARTS
			},
			kpis: {
				latestEpochEmit: emissions.kpis.latestEpochEmit.formatted,
				latestEpochBurn: emissions.kpis.latestEpochBurn.formatted,
				latestNetInflation: emissions.kpis.latestNetInflation.formatted,
				latestBurnVsEmitPct: emissions.kpis.latestBurnVsEmitPct.formatted,
				emit30d: emissions.kpis.emit30d.formatted,
				burn30d: emissions.kpis.burn30d.formatted,
				netInflation30d: emissions.kpis.netInflation30d.formatted,
				burnVsEmit30dPct: emissions.kpis.burnVsEmit30dPct.formatted,
				cumulativeEmissionsTracked: emissions.kpis.cumulativeEmissionsTracked.formatted,
				epochsTracked: emissions.kpis.epochsTracked.formatted
			}
		}
	}
}
