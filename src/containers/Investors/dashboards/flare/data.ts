import { buildColumnarTimeSeriesDataset } from '~/components/ECharts/MultiSeriesChart/timeSeriesDataset'
import type { MultiSeriesChartDataset, MultiSeriesChartSeriesConfig } from '~/components/ECharts/MultiSeriesChart/types'
import { FLARE_BLUE, FLARE_GREEN, FLARE_ORANGE, FLARE_PINK, timeSeriesChartOptions } from './chartDefaults'
import { parseDateToTimestampMs, type UpstreamChart, type UpstreamSeries } from './transform'

interface FormattedValue {
	value: number
	formatted: string
}

interface ProtocolRankingEntry {
	name: string
	category: string | null
	logo: string | null
	url: string | null
	tvl: number
	tvlFormatted: string
	change24h: number
	change24hFormatted: string
}

export interface OverviewAPIResponse {
	tvl: {
		tvlChart: UpstreamChart
		kpis: { currentTvl: FormattedValue; currentBridgedTvl?: FormattedValue }
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
	protocolRankings?: Array<ProtocolRankingEntry>
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
	stakedOrDelegatedPctChart?: UpstreamChart
	kpis: {
		pctStakedOrDelegated: FormattedValue
		totalStakedOrDelegated?: FormattedValue
		ftsoDelegated: FormattedValue
		ftsoDelegatedUsd?: FormattedValue
		totalStake: FormattedValue
		validatorCount: FormattedValue
		averageUptime: FormattedValue
	}
}

interface DistributionChart {
	title?: string
	subtitle?: string
	tooltip?: string
	labels: Array<string>
	series: Array<{ name: string; data: Array<number> }>
}

export interface FAssetsAPIResponse {
	narrative?: string
	lockedOverTimeChart?: UpstreamChart
	distributionChart?: DistributionChart
	allNetworksDistributionChart?: DistributionChart
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

export interface FirePoolWallet {
	name: string
	wallet: string
	feeToken: string
	feesToken: number
	feesUsd: number
	feesUsdFormatted: string
	txCount: number
}

// FIRE went live in May 2026 (FIP.16); the extra fields only exist on the
// live payload, so everything beyond the original stub stays optional.
export interface FirePoolAPI {
	status: string
	note: string
	burnDestination: string
	liveSince?: string
	feesChart?: UpstreamChart
	fdcRewardsChart?: UpstreamChart
	wallets?: Array<FirePoolWallet>
	revenueSources?: Array<{ section: string; name: string; totalUsd: number; formatted: string }>
	kpis?: {
		totalCollectedUsd: FormattedValue
		collected30dUsd: FormattedValue
		fdcCollectedUsd: FormattedValue
		mintingFeeCollectedUsd: FormattedValue
		redemptionFeeCollectedUsd?: FormattedValue
		tagsCollectedUsd: FormattedValue
	}
}

export interface TokenomicsAPIResponse {
	narrative?: string
	burn: {
		burnChart: UpstreamChart
		firePool: FirePoolAPI
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
	// Synced with dune.com/flare/tokenomics (added Aug 2026).
	inflation?: {
		inflationPctChart?: UpstreamChart
		circulatingSupplyChart?: UpstreamChart
		emittedByProtocolChart?: UpstreamChart
		burnedByProtocolChart?: UpstreamChart
		kpis: {
			annualizedInflationPct: FormattedValue
			circulatingSupply: FormattedValue
			cumulativeOnchainBurned: FormattedValue
			lastMonthEmitted: FormattedValue
			lastMonthBurned: FormattedValue
		}
	}
}

const DAILY_BURN_CHART: Array<MultiSeriesChartSeriesConfig> = [
	{
		type: 'bar',
		name: 'Daily Burn',
		encode: { x: 0, y: 1 },
		color: FLARE_ORANGE,
		stack: 'a'
	}
]

const CUMULATIVE_BURN_CHART: Array<MultiSeriesChartSeriesConfig> = [
	{
		type: 'line',
		name: 'Cumulative Burn',
		encode: { x: 0, y: 1 },
		color: FLARE_PINK
	}
]

const PER_EPOCH_CHART: Array<MultiSeriesChartSeriesConfig> = [
	{
		type: 'bar',
		name: 'Per Epoch',
		encode: { x: 'timestamp', y: 'Per Epoch' },
		color: FLARE_BLUE,
		stack: 'a'
	}
]

const BURN_VS_EMIT_SERIES = ['FLR Emitted', 'FLR Burned', 'Net Inflation'] as const
const BURN_VS_EMIT_CHARTS: Array<MultiSeriesChartSeriesConfig> = [
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

// TVL + Bridged TVL, overlaid (not stacked, the two overlap since bridged
// assets already deployed in DeFi count in both) as two filled areas in
// different colors, both on one shared axis pre-aligned by the adapter.
// `null` before a series starts (e.g. bridged TVL's tracking start date)
// leaves a gap rather than drawing a flat 0.
function buildTvlChart(chart: UpstreamChart, fallbackTitle: string) {
	const colors = [FLARE_PINK, FLARE_BLUE]
	const charts = new Array<MultiSeriesChartSeriesConfig>(chart.series.length)
	for (let i = 0; i < chart.series.length; i++) {
		const name = chart.series[i].name
		charts[i] = {
			type: 'line',
			name,
			encode: { x: 'timestamp', y: name },
			color: colors[i % colors.length]
		}
	}
	return {
		title: chart.title ?? fallbackTitle,
		subtitle: chart.subtitle,
		titleTooltip: chart.tooltip,
		dataset: buildColumnarTimeSeriesDataset(chart.dates, chart.series, parseDateToTimestampMs, null),
		chartOptions: timeSeriesChartOptions(chart.dates.length, '$'),
		charts
	}
}

export function buildFlareOverviewData(data: OverviewAPIResponse) {
	const stableSeries: Array<UpstreamSeries> = []
	const stableChartConfigs: Array<MultiSeriesChartSeriesConfig> = []
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
			...buildTvlChart(data.tvl.tvlChart, 'Flare TVL & Bridged TVL'),
			currentFormatted: data.tvl.kpis.currentTvl.formatted,
			currentBridgedFormatted: data.tvl.kpis.currentBridgedTvl?.formatted ?? null
		},
		protocolRankings: data.protocolRankings ?? [],
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
		] satisfies Array<MultiSeriesChartSeriesConfig>
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
		// Stacked (not overlaid): both series get area fill + a shared stack
		// group, so the top of the stack reads as the combined total.
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
				stack: 'total'
			}
		}
		chart = {
			title: upstreamChart.title ?? 'P-Chain Staking + FTSO Delegation',
			subtitle: upstreamChart.subtitle,
			titleTooltip: upstreamChart.tooltip,
			dataset: buildColumnarTimeSeriesDataset(upstreamChart.dates, upstreamChart.series, parseDateToTimestampMs, 0),
			chartOptions: timeSeriesChartOptions(upstreamChart.dates.length, ''),
			charts,
			seriesNames,
			colors
		}
	}

	const pctChart = buildLineChartView(data.stakedOrDelegatedPctChart, '%', FLARE_PINK)

	return {
		narrative: data.narrative,
		kpis: {
			pctStakedOrDelegated: data.kpis.pctStakedOrDelegated.formatted,
			totalStakedOrDelegated: data.kpis.totalStakedOrDelegated?.formatted,
			ftsoDelegated: data.kpis.ftsoDelegated.formatted,
			ftsoDelegatedUsd: data.kpis.ftsoDelegatedUsd?.formatted,
			totalStake: data.kpis.totalStake.formatted,
			validatorCount: data.kpis.validatorCount.formatted,
			averageUptime: data.kpis.averageUptime.formatted
		},
		chart,
		pctChart
	}
}

export function buildFlareFAssetsData(data: FAssetsAPIResponse) {
	const locked = data.lockedOverTimeChart
	// FXRP units (Flare vs. all networks) since the Sept-2026 Dune dashboard
	// migration — the old dual USD/FXRP-unit shape no longer applies.
	const lockedSeries: Array<UpstreamSeries> = locked?.series ?? []

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
			subtitle: locked.subtitle,
			titleTooltip: locked.tooltip,
			dataset: buildColumnarTimeSeriesDataset(locked.dates, lockedSeries, parseDateToTimestampMs, 0),
			// Full range by default (Sept-2026 IR feedback) instead of the usual
			// trailing-90-day zoom.
			chartOptions: timeSeriesChartOptions(0, ''),
			charts
		}
	}

	const distribution = buildDonut(data.distributionChart, 'FXRP Distribution Across DeFi Protocols')
	const allNetworksDistribution = buildDonut(
		data.allNetworksDistributionChart,
		'FXRP Distribution Across DeFi Protocols (All Networks)'
	)

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
		charts: { locked: lockedChart, dist: distribution, allNetworksDist: allNetworksDistribution }
	}
}

function buildDonut(dist: DistributionChart | undefined, fallbackTitle: string) {
	if (!dist || !dist.series[0] || dist.labels.length === 0) return null
	const rows = new Array<{ name: string; value: number }>(dist.labels.length)
	const colors: Record<string, string> = {}
	for (let i = 0; i < dist.labels.length; i++) {
		const name = dist.labels[i]
		rows[i] = { name, value: dist.series[0].data[i] ?? 0 }
		colors[name] = DONUT_PALETTE[i % DONUT_PALETTE.length]
	}
	return { title: dist.title ?? fallbackTitle, subtitle: dist.subtitle, titleTooltip: dist.tooltip, data: rows, colors }
}

const FIRE_SOURCE_COLORS: Record<string, string> = {
	FDC: FLARE_BLUE,
	'FAssets Minting Fee': FLARE_ORANGE,
	'FAssets Redemption Fee': '#7C2D9C',
	Tags: FLARE_GREEN
}

// FIRE fees chart: daily per-source bars stacked, cumulative USD as a line.
function buildFireView(firePool: FirePoolAPI) {
	const feesChart = firePool.feesChart
	if (firePool.status !== 'live' || !feesChart || !firePool.kpis) return null

	const charts = new Array<MultiSeriesChartSeriesConfig>(feesChart.series.length)
	for (let i = 0; i < feesChart.series.length; i++) {
		const series = feesChart.series[i]
		charts[i] =
			series.type === 'line'
				? {
						type: 'line',
						name: series.name,
						encode: { x: 'timestamp', y: series.name },
						color: FLARE_PINK,
						hideAreaStyle: true
					}
				: {
						type: 'bar',
						name: series.name,
						encode: { x: 'timestamp', y: series.name },
						color: FIRE_SOURCE_COLORS[series.name] ?? DONUT_PALETTE[i % DONUT_PALETTE.length],
						stack: 'fire'
					}
	}

	return {
		liveSince: firePool.liveSince ?? null,
		note: firePool.note,
		title: feesChart.title ?? 'FIRE Fees Collected (USD)',
		subtitle: feesChart.subtitle,
		dataset: buildColumnarTimeSeriesDataset(feesChart.dates, feesChart.series, parseDateToTimestampMs, 0),
		chartOptions: timeSeriesChartOptions(feesChart.dates.length, '$'),
		charts,
		wallets: firePool.wallets ?? [],
		kpis: {
			totalCollectedUsd: firePool.kpis.totalCollectedUsd.formatted,
			collected30dUsd: firePool.kpis.collected30dUsd.formatted,
			fdcCollectedUsd: firePool.kpis.fdcCollectedUsd.formatted,
			mintingFeeCollectedUsd: firePool.kpis.mintingFeeCollectedUsd.formatted,
			redemptionFeeCollectedUsd: firePool.kpis.redemptionFeeCollectedUsd?.formatted ?? null,
			tagsCollectedUsd: firePool.kpis.tagsCollectedUsd.formatted
		}
	}
}

function buildLineChartView(chart: UpstreamChart | undefined, valueSymbol: string, color: string, zoom = true) {
	if (!chart || chart.series.length === 0) return null
	const charts = new Array<MultiSeriesChartSeriesConfig>(chart.series.length)
	for (let i = 0; i < chart.series.length; i++) {
		const name = chart.series[i].name
		charts[i] = {
			type: 'line',
			name,
			encode: { x: 'timestamp', y: name },
			...(i === 0 ? { color } : { hideAreaStyle: true })
		}
	}
	return {
		title: chart.title,
		subtitle: chart.subtitle,
		titleTooltip: chart.tooltip,
		dataset: buildColumnarTimeSeriesDataset(chart.dates, chart.series, parseDateToTimestampMs, 0),
		// zoom=false shows the full history (e.g. the FIP.16 5% → 3% inflation cut).
		chartOptions: timeSeriesChartOptions(zoom ? chart.dates.length : 0, valueSymbol),
		charts
	}
}

// Monthly FLR emitted/burned stacked by protocol (Dune 7319929).
function buildProtocolStackView(chart: UpstreamChart | undefined) {
	if (!chart || chart.series.length === 0) return null
	const charts = new Array<MultiSeriesChartSeriesConfig>(chart.series.length)
	for (let i = 0; i < chart.series.length; i++) {
		const name = chart.series[i].name
		charts[i] = {
			type: 'bar',
			name,
			encode: { x: 'timestamp', y: name },
			color: DONUT_PALETTE[i % DONUT_PALETTE.length],
			stack: 'protocol'
		}
	}
	return {
		title: chart.title,
		subtitle: chart.subtitle,
		dataset: buildColumnarTimeSeriesDataset(chart.dates, chart.series, parseDateToTimestampMs, 0),
		chartOptions: timeSeriesChartOptions(0, ''),
		charts
	}
}

function buildInflationView(inflation: TokenomicsAPIResponse['inflation']) {
	if (!inflation) return null
	return {
		kpis: {
			annualizedInflationPct: inflation.kpis.annualizedInflationPct.formatted,
			circulatingSupply: inflation.kpis.circulatingSupply.formatted,
			cumulativeOnchainBurned: inflation.kpis.cumulativeOnchainBurned.formatted,
			lastMonthEmitted: inflation.kpis.lastMonthEmitted.formatted,
			lastMonthBurned: inflation.kpis.lastMonthBurned.formatted
		},
		pctChart: buildLineChartView(inflation.inflationPctChart, '%', FLARE_PINK, false),
		circulatingChart: buildLineChartView(inflation.circulatingSupplyChart, '', FLARE_BLUE, false),
		emittedByProtocol: buildProtocolStackView(inflation.emittedByProtocolChart),
		burnedByProtocol: buildProtocolStackView(inflation.burnedByProtocolChart)
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

	const perEpochSeries: Array<UpstreamSeries> = []
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
	const burnVsEmitSeries: Array<UpstreamSeries> = []
	if (emittedSeries) burnVsEmitSeries.push(emittedSeries)
	if (burnedSeries) burnVsEmitSeries.push(burnedSeries)
	if (netInflationSeries) burnVsEmitSeries.push(netInflationSeries)

	const chartOptions = timeSeriesChartOptions(burn.burnChart.dates.length, '')
	return {
		narrative: data.narrative,
		fire: buildFireView(burn.firePool),
		inflation: buildInflationView(data.inflation),
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
