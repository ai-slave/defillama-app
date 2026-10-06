import { lazy, useMemo } from 'react'
import { buildAlignedCartesianChartModel, type CartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import type { IMultiSeriesChartProps, MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { formatPercent } from '~/utils/numberFormat'
import {
	useTab,
	chartToModel,
	zoomStartPct,
	defaultZoomOptions,
	type MorphoMarketHistory,
	type TvlResponse
} from './api'
import { KpiCard, ChartCard, SectionHeader, ChartSkeleton, SimpleTable, UtilBar, fmtUsd } from './ui'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const PROTO_COLORS: Record<string, string> = {
	Metronome: '#fb923c',
	Vesper: '#a78bfa',
	Odyssey: '#60a5fa',
	'Morpho (Metronome Markets)': '#34d399'
}
const CHAIN_COLORS: Record<string, string> = {
	Ethereum: '#627eea',
	Base: '#0052ff',
	Optimism: '#ff0420',
	Plasma: '#10b981'
}

const MORPHO_HISTORY_CHARTS: IMultiSeriesChartProps['charts'] = [
	{
		name: 'Supply',
		type: 'line',
		color: '#6366f1',
		encode: { x: 'timestamp', y: 'Supply' },
		yAxisIndex: 0,
		valueSymbol: '$'
	},
	{
		name: 'Borrow',
		type: 'line',
		color: '#fb923c',
		encode: { x: 'timestamp', y: 'Borrow' },
		yAxisIndex: 0,
		valueSymbol: '$'
	},
	{
		name: 'Utilization %',
		type: 'line',
		color: '#34d399',
		encode: { x: 'timestamp', y: 'Utilization %' },
		yAxisIndex: 1,
		valueSymbol: '%'
	}
]

function buildMorphoHistoryModel(market: MorphoMarketHistory): CartesianChartModel {
	const source = new Array<MultiSeriesChartDataset['source'][number]>(market.series.length)
	for (let index = 0; index < market.series.length; index++) {
		const point = market.series[index]
		source[index] = [Date.parse(`${point.date}T00:00:00Z`), point.supplyUsd, point.borrowUsd, point.utilization]
	}
	return {
		dataset: { dimensions: ['timestamp', 'Supply', 'Borrow', 'Utilization %'], source },
		charts: MORPHO_HISTORY_CHARTS
	}
}

export default function Tvl() {
	const { data, isLoading } = useTab<TvlResponse>('tvl')
	const k = data?.kpis ?? ({} as Partial<NonNullable<typeof data>['kpis']>)
	const fromDate = data?.defaultFrom || '2025-01-01'
	const ecosystemChart = data?.ecosystemChart
	const marketOverlay = data?.marketOverlay

	const ecoModel = useMemo(
		() =>
			ecosystemChart
				? (() => {
						const model = chartToModel(ecosystemChart)
						return {
							...model,
							charts: model.charts.map((chart) => ({
								...chart,
								type: 'line' as const,
								color: PROTO_COLORS[chart.name] || chart.color || '#6366f1'
							}))
						}
					})()
				: undefined,
		[ecosystemChart]
	)
	const ecoZoom = useMemo(
		() => defaultZoomOptions(zoomStartPct(ecosystemChart?.dates, fromDate)),
		[ecosystemChart?.dates, fromDate]
	)

	const ethOverlay = useMemo(
		() =>
			marketOverlay
				? buildAlignedCartesianChartModel(
						marketOverlay.dates.map((date) => Date.parse(`${date}T00:00:00Z`)),
						[
							{
								name: 'Total TVL',
								type: 'line' as const,
								color: '#6366f1',
								values: marketOverlay.series[0]?.data ?? [],
								yAxisIndex: 0,
								valueSymbol: '$'
							},
							{
								name: 'ETH Price',
								type: 'line' as const,
								color: '#f59e0b',
								values: marketOverlay.series[1]?.data ?? [],
								yAxisIndex: 1,
								valueSymbol: '$'
							}
						],
						{ timestampMultiplier: 1 }
					)
				: undefined,
		[marketOverlay]
	)
	const ethZoom = useMemo(
		() => defaultZoomOptions(zoomStartPct(marketOverlay?.dates, fromDate)),
		[marketOverlay?.dates, fromDate]
	)

	const protocolByChainModels = useMemo(
		() =>
			(data?.protocolByChain ?? []).map((protocol) => {
				const model = chartToModel(protocol)
				return {
					protocol,
					model: {
						...model,
						charts: model.charts.map((chart) => ({
							...chart,
							type: 'bar' as const,
							stack: 'chain',
							color: CHAIN_COLORS[chart.name] || '#6366f1'
						}))
					},
					zoom: defaultZoomOptions(zoomStartPct(protocol.dates, fromDate))
				}
			}),
		[data?.protocolByChain, fromDate]
	)

	const morphoHistoryModels = useMemo(
		() =>
			(data?.morphoMarketHistory?.markets ?? []).map((market) => ({
				market,
				model: buildMorphoHistoryModel(market)
			})),
		[data?.morphoMarketHistory?.markets]
	)

	const u = data?.utilization
	const uk = u?.kpis ?? ({} as Partial<NonNullable<typeof u>['kpis']>)

	return (
		<div className="flex flex-col gap-6">
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
				<KpiCard
					label="Total Ecosystem TVL"
					value={k.total?.formatted}
					info="Includes third-party TVL — the Metronome AMO supply in external Morpho markets — so it is broader than the sum of each protocol's own DefiLlama TVL (which by convention excludes AMO-supplied Morpho liquidity)."
				/>
				<KpiCard label="Metronome" value={k.metronome?.formatted} />
				<KpiCard label="Vesper" value={k.vesper?.formatted} />
				<KpiCard label="Odyssey" value={k.odyssey?.formatted} />
				<KpiCard
					label="Morpho (Metronome Markets)"
					value={k.morpho?.formatted}
					info="Third-party TVL: the Metronome AMO's supply into external Morpho markets. Not part of Metronome's own DefiLlama TVL."
				/>
			</div>

			<SectionHeader>Total Ecosystem TVL</SectionHeader>
			{isLoading || !ecoModel ? (
				<ChartSkeleton title="Ecosystem TVL" />
			) : (
				<ChartCard
					title="Ecosystem TVL"
					subtitle="Metronome, Vesper, Odyssey and Morpho markets — drag the slider for full history"
				>
					<MultiSeriesChart
						dataset={ecoModel.dataset}
						charts={ecoModel.charts}
						valueSymbol="$"
						height="400px"
						chartOptions={ecoZoom}
						hideDefaultLegend={false}
						exportButtons="hidden"
					/>
				</ChartCard>
			)}

			<SectionHeader>TVL vs ETH Price</SectionHeader>
			{isLoading || !ethOverlay ? (
				<ChartSkeleton title="TVL vs ETH" />
			) : (
				<ChartCard title="Ecosystem TVL vs ETH/USD" subtitle="Correlation overlay">
					<MultiSeriesChart
						dataset={ethOverlay.dataset}
						charts={ethOverlay.charts}
						valueSymbol="$"
						height="350px"
						chartOptions={ethZoom}
						hideDefaultLegend={false}
						exportButtons="hidden"
					/>
				</ChartCard>
			)}

			<SectionHeader>TVL by Chain</SectionHeader>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				{protocolByChainModels.map(({ protocol, model, zoom }) => {
					return (
						<ChartCard key={protocol.protocol} title={protocol.protocol} subtitle="Stacked by chain">
							<MultiSeriesChart
								dataset={model.dataset}
								charts={model.charts}
								valueSymbol="$"
								height="280px"
								chartOptions={zoom}
								hideDefaultLegend={false}
								exportButtons="hidden"
							/>
						</ChartCard>
					)
				})}
			</div>

			{u && (
				<>
					<SectionHeader>Morpho Borrow Markets · Utilization</SectionHeader>
					<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
						<KpiCard label="Total Supply" value={uk.supply?.formatted} />
						<KpiCard label="Total Borrows" value={uk.borrows?.formatted} />
						<KpiCard label="Avg Utilization" value={uk.avgUtilization?.formatted} />
						<KpiCard label="Idle Liquidity" value={uk.idleLiquidity?.formatted} />
					</div>
					<ChartCard title="Vaults Overview">
						<SimpleTable
							getOccurrenceKey={(row) => JSON.stringify([row.vault, row.chain])}
							rows={u.vaults}
							cols={[
								{ key: 'vault', label: 'Vault' },
								{ key: 'chain', label: 'Chain' },
								{ key: 'totalAssetsUsd', label: 'Total Assets', right: true, render: (r) => fmtUsd(r.totalAssetsUsd) },
								{ key: 'idleLiquidityUsd', label: 'Idle', right: true, render: (r) => fmtUsd(r.idleLiquidityUsd) },
								{
									key: 'netApyPct',
									label: 'Net APY',
									right: true,
									render: (r) =>
										`${formatPercent(r.netApyPct ?? 0, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
								}
							]}
						/>
					</ChartCard>
					{(u.marketsByChain || []).map((g) => (
						<ChartCard key={g.chain} title={`${g.chain} — Markets`}>
							<SimpleTable
								getOccurrenceKey={(row) => row.market}
								rows={g.markets}
								cols={[
									{ key: 'market', label: 'Market' },
									{ key: 'supplyUsd', label: 'Supply', right: true, render: (r) => fmtUsd(r.supplyUsd) },
									{ key: 'borrowUsd', label: 'Borrow', right: true, render: (r) => fmtUsd(r.borrowUsd) },
									{ key: 'borrowableUsd', label: 'Borrowable', right: true, render: (r) => fmtUsd(r.borrowableUsd) },
									{
										key: 'utilizationPct',
										label: 'Utilization',
										right: true,
										render: (r) => <UtilBar pct={r.utilizationPct} />
									},
									{
										key: 'targetPct',
										label: 'Target',
										right: true,
										render: (r) =>
											r.targetPct != null
												? `${formatPercent(r.targetPct, { input: 'percent', maximumFractionDigits: 0, useGrouping: false })}`
												: '—'
									},
									{
										key: 'mintNeededUsd',
										label: 'Mint Needed',
										right: true,
										render: (r) => fmtUsd(r.mintNeededUsd)
									},
									{
										key: 'lltvPct',
										label: 'LLTV',
										right: true,
										render: (r) =>
											`${formatPercent(r.lltvPct ?? 0, { input: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false })}`
									},
									{
										key: 'supplyApyPct',
										label: 'Supply APY',
										right: true,
										render: (r) =>
											`${formatPercent(r.supplyApyPct ?? 0, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
									},
									{
										key: 'borrowApyPct',
										label: 'Borrow APY',
										right: true,
										render: (r) =>
											`${formatPercent(r.borrowApyPct ?? 0, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
									}
								]}
							/>
						</ChartCard>
					))}
				</>
			)}

			{morphoHistoryModels.length > 0 ? (
				<>
					<SectionHeader>
						{data.morphoMarketHistory.title || 'Morpho Market · Supply / Borrow / Utilization'}
					</SectionHeader>
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						{morphoHistoryModels.map(({ market, model }) => {
							return (
								<ChartCard
									key={market.marketId}
									title={market.name || market.marketId}
									subtitle={`${market.chain}${market.source ? ` · ${market.source}` : ''}`}
								>
									<MultiSeriesChart
										dataset={model.dataset}
										charts={model.charts}
										valueSymbol="$"
										height="300px"
										hideDefaultLegend={false}
										exportButtons="hidden"
									/>
								</ChartCard>
							)
						})}
					</div>
				</>
			) : null}

			<SectionHeader>Ecosystem DEX LP TVL</SectionHeader>
			<ChartCard title={data?.synthLpTvl?.title || 'Ecosystem Liquidity Pools'} subtitle={data?.synthLpTvl?.subtitle}>
				<SimpleTable
					getOccurrenceKey={(row) => JSON.stringify([row.venue, row.chain, row.pool])}
					rows={data?.synthLpTvl?.pools}
					cols={[
						{ key: 'venue', label: 'Venue' },
						{ key: 'chain', label: 'Chain' },
						{ key: 'pool', label: 'Pool' },
						{ key: 'tvl', label: 'TVL', right: true },
						{ key: 'apy', label: 'APY', right: true }
					]}
				/>
			</ChartCard>

			<SectionHeader>MetBasis LP TVL</SectionHeader>
			<ChartCard
				title={data?.metbasis?.title || 'MetBasis LP TVL'}
				subtitle={data?.metbasis?.totalFormatted ? `Total ${data.metbasis.totalFormatted}` : undefined}
			>
				<SimpleTable
					getOccurrenceKey={(row) => JSON.stringify([row.chain, row.venue, row.pool])}
					rows={data?.metbasis?.pools}
					cols={[
						{ key: 'chain', label: 'Chain' },
						{ key: 'venue', label: 'Venue' },
						{ key: 'pool', label: 'Pool' },
						{ key: 'tvl', label: 'TVL', right: true },
						{ key: 'apy', label: 'APY', right: true }
					]}
				/>
			</ChartCard>
		</div>
	)
}
