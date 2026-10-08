import { lazy, useMemo, useState } from 'react'
import { createCappedRemainderTooltipFormatter } from '~/components/ECharts/MultiSeriesChart/tooltip'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { formatRatio } from '~/utils/numberFormat'
import { useTab, chartToModel, type EpochRow, type SpendWindowRow, type IncentivesResponse } from './api'
import { KpiCard, ChartCard, SectionHeader, SimpleTable, fmtUsd, type Col } from './ui'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

const POOL_CHART_OPTIONS = {
	tooltip: { formatter: createCappedRemainderTooltipFormatter({ valueSymbol: '$' }) }
} satisfies NonNullable<IMultiSeriesChartProps['chartOptions']>

const PALETTE = [
	'#6366f1',
	'#3fb950',
	'#fb923c',
	'#a78bfa',
	'#38bdf8',
	'#fbbf24',
	'#f87171',
	'#34d399',
	'#60a5fa',
	'#e879f9'
]
const VENUES = [
	{ value: 'aerodrome', label: 'Aerodrome' },
	{ value: 'velodrome', label: 'Velodrome' },
	{ value: 'votemarket', label: 'VoteMarket' },
	{ value: 'merkl', label: 'Merkl' },
	{ value: 'lithos', label: 'Lithos' }
] as const

type VenueId = (typeof VENUES)[number]['value']
type EpochTableRow = EpochRow | SpendWindowRow

function epochCols(id: VenueId): Array<Col<EpochTableRow>> {
	if (id === 'aerodrome' || id === 'velodrome')
		return [
			{ key: 'pool', label: 'Pool' },
			{ key: 'period', label: 'Period' },
			{ key: 'emissions', label: 'Emissions' },
			{ key: 'incentiveSpend', label: 'Incentive Spend', right: true },
			{
				key: 'currentEpochUsd',
				label: 'Current Epoch',
				right: true,
				render: (r) => fmtUsd('currentEpochUsd' in r ? r.currentEpochUsd : undefined)
			},
			{
				key: 'monthSoFarUsd',
				label: 'MTD',
				right: true,
				render: (r) => fmtUsd('monthSoFarUsd' in r ? r.monthSoFarUsd : undefined)
			},
			{
				key: 'previousMonthUsd',
				label: 'Prev Month',
				right: true,
				render: (r) => fmtUsd('previousMonthUsd' in r ? r.previousMonthUsd : undefined)
			}
		]
	if (id === 'votemarket')
		return [
			{ key: 'pool', label: 'Pool / Gauge' },
			{ key: 'period', label: 'Period' },
			{ key: 'latestCycle', label: 'Latest Cycle', right: true },
			{
				key: 'currentEpochUsd',
				label: 'Current',
				right: true,
				render: (r) => fmtUsd('currentEpochUsd' in r ? r.currentEpochUsd : undefined)
			},
			{
				key: 'monthSoFarUsd',
				label: 'MTD',
				right: true,
				render: (r) => fmtUsd('monthSoFarUsd' in r ? r.monthSoFarUsd : undefined)
			},
			{
				key: 'previousMonthUsd',
				label: 'Prev Month',
				right: true,
				render: (r) => fmtUsd('previousMonthUsd' in r ? r.previousMonthUsd : undefined)
			}
		]
	if (id === 'merkl')
		return [
			{ key: 'period', label: 'Period' },
			{ key: 'spend', label: 'Spend (USD)', right: true }
		]
	return [
		{ key: 'period', label: 'Period' },
		{ key: 'spend', label: 'Spend (USDT0)', right: true }
	]
}

export default function Incentives() {
	const { data } = useTab<IncentivesResponse>('incentives')
	const k = data?.kpis ?? ({} as Partial<NonNullable<typeof data>['kpis']>)
	const [poolTab, setPoolTab] = useState<VenueId>('aerodrome')
	const [epochTab, setEpochTab] = useState<VenueId>('aerodrome')

	const poolChart = data?.weeklyPoolCharts?.[poolTab]
	const poolModel = useMemo(
		() =>
			poolChart
				? (() => {
						const model = chartToModel(poolChart)
						return {
							...model,
							charts: model.charts.map((chart, index) => {
								const isAggregate = chart.name === '__historical_aggregate__'
								return {
									...chart,
									name: isAggregate ? 'Historical Aggregate (pre-breakdown)' : chart.name,
									type: 'bar' as const,
									stack: 'pool',
									color: isAggregate ? '#71717a' : PALETTE[index % PALETTE.length]
								}
							})
						}
					})()
				: undefined,
		[poolChart]
	)

	return (
		<div className="flex flex-col gap-6">
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<KpiCard label="30d Total Spend" value={k.thirtyDayTotal?.formatted} />
				<KpiCard label="All-time Total Spend" value={k.allTimeTotal?.formatted} />
				<KpiCard
					label="Fees Rolled Into Incentives (30d)"
					value={k.feesRolledIntoIncentives?.formatted}
					sub="AERO/VELO emissions beyond what we paid in bribes"
				/>
				<KpiCard label="Gov-Token Power (locked USD)" value={k.govTokenPowerUsd?.formatted} sub="vlCVX + veAERO" />
			</div>
			<ChartCard title="30d Spend by Venue">
				<SimpleTable
					getRowKey={(row) => JSON.stringify([row.chain, row.id])}
					rows={k.thirtyDayByVenue}
					cols={[
						{ key: 'venue', label: 'Venue' },
						{ key: 'chain', label: 'Chain' },
						{ key: 'amountUsd', label: 'Spend', right: true, render: (r) => r.amountFormatted || fmtUsd(r.amountUsd) }
					]}
				/>
			</ChartCard>

			<SectionHeader>Weekly Spend per Pool</SectionHeader>
			<ChartCard title="Per-pool weekly spend">
				<SegmentedControl<VenueId>
					variant="default"
					size="sm"
					label="Pool venue"
					className="mb-3"
					options={VENUES}
					value={poolTab}
					onValueChange={setPoolTab}
				/>
				{poolModel?.dataset.source.length ? (
					<MultiSeriesChart
						key={poolTab}
						dataset={poolModel.dataset}
						charts={poolModel.charts}
						chartOptions={POOL_CHART_OPTIONS}
						valueSymbol="$"
						height="360px"
						hideDefaultLegend={false}
						exportButtons="hidden"
					/>
				) : (
					<div className="px-2 py-6 text-xs text-pro-text-secondary">No weekly pool data</div>
				)}
			</ChartCard>

			<SectionHeader>Epochs & Spend</SectionHeader>
			<ChartCard title="Epoch breakdown">
				<SegmentedControl<VenueId>
					variant="default"
					size="sm"
					label="Epoch venue"
					className="mb-3"
					options={VENUES}
					value={epochTab}
					onValueChange={setEpochTab}
				/>
				<div key={epochTab}>
					<SimpleTable<EpochTableRow>
						getOccurrenceKey={(row) => JSON.stringify([row.period, 'pool' in row ? row.pool : null])}
						rows={data?.epochTables?.[epochTab]}
						cols={epochCols(epochTab)}
					/>
				</div>
			</ChartCard>

			{data?.nonSpendIncentives && (
				<>
					<SectionHeader>{data.nonSpendIncentives.title || 'Incentives not paid out of pocket'}</SectionHeader>
					{data.nonSpendIncentives.feesRolledIntoIncentives && (
						<ChartCard
							title={
								data.nonSpendIncentives.feesRolledIntoIncentives.title || 'Protocol-issuance rolled into incentives'
							}
							subtitle={
								data.nonSpendIncentives.feesRolledIntoIncentives.totalFormatted
									? `Total ${data.nonSpendIncentives.feesRolledIntoIncentives.totalFormatted}`
									: undefined
							}
						>
							<SimpleTable
								getOccurrenceKey={(row) => JSON.stringify([row.venue, row.pool])}
								rows={data.nonSpendIncentives.feesRolledIntoIncentives.rows}
								cols={[
									{ key: 'venue', label: 'Venue' },
									{ key: 'pool', label: 'Pool' },
									{ key: 'bribesUsd', label: 'Bribes', right: true, render: (r) => fmtUsd(r.bribesUsd) },
									{ key: 'emissionsUsd', label: 'Emissions', right: true, render: (r) => fmtUsd(r.emissionsUsd) },
									{
										key: 'feesRolledInUsd',
										label: 'Fees Rolled In',
										right: true,
										render: (r) => fmtUsd(r.feesRolledInUsd)
									},
									{
										key: 'multiplier',
										label: 'Multiplier',
										right: true,
										render: (r) => (r.multiplier != null ? `${formatRatio(r.multiplier)}x` : '—')
									}
								]}
							/>
						</ChartCard>
					)}

					{data.nonSpendIncentives.govTokenPower && (
						<ChartCard title={data.nonSpendIncentives.govTokenPower.title || 'Gov-token incentive power'}>
							<div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
								<KpiCard label="vlCVX locked" value={fmtUsd(data.nonSpendIncentives.govTokenPower.vlCvxLockedUsd)} />
								<KpiCard label="veAERO locked" value={fmtUsd(data.nonSpendIncentives.govTokenPower.veAeroLockedUsd)} />
								<KpiCard
									label="Total locked"
									value={
										data.nonSpendIncentives.govTokenPower.totalFormatted ||
										fmtUsd(data.nonSpendIncentives.govTokenPower.totalUsd)
									}
								/>
							</div>
						</ChartCard>
					)}

					{data.nonSpendIncentives.thirdPartySponsorship && (
						<ChartCard title="3rd-party sponsorship">
							<SimpleTable
								getOccurrenceKey={(row) => JSON.stringify([row.sponsor, row.pool, row.venue, row.chain, row.token])}
								rows={data.nonSpendIncentives.thirdPartySponsorship.knownSponsors}
								cols={[
									{ key: 'sponsor', label: 'Sponsor' },
									{ key: 'pool', label: 'Pool' },
									{ key: 'venue', label: 'Venue' },
									{ key: 'chain', label: 'Chain' },
									{ key: 'token', label: 'Token', render: (r) => r.token || '—' },
									{
										key: 'amountUsd',
										label: 'Amount',
										right: true,
										render: (r) => (r.amountUsd != null ? fmtUsd(r.amountUsd) : '—')
									}
								]}
							/>
						</ChartCard>
					)}
				</>
			)}

			<SectionHeader>Gauges</SectionHeader>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<ChartCard title="Aerodrome (Base)">
					<SimpleTable
						getOccurrenceKey={(row) => row.pool}
						rows={data?.gauges?.aerodrome}
						cols={[
							{ key: 'pool', label: 'Pool' },
							{ key: 'tvl', label: 'TVL' },
							{ key: 'apy', label: 'APY', right: true }
						]}
					/>
				</ChartCard>
				<ChartCard title="Velodrome (Optimism)">
					<SimpleTable
						getOccurrenceKey={(row) => row.pool}
						rows={data?.gauges?.velodrome}
						cols={[
							{ key: 'pool', label: 'Pool' },
							{ key: 'tvl', label: 'TVL' },
							{ key: 'apy', label: 'APY', right: true }
						]}
					/>
				</ChartCard>
			</div>
			<ChartCard title="Lithos (Plasma)">
				<SimpleTable
					getOccurrenceKey={(row) => row.pool}
					rows={data?.gauges?.lithos}
					cols={[
						{ key: 'pool', label: 'Pool' },
						{ key: 'tvl', label: 'TVL' },
						{ key: 'apy', label: 'APY', right: true }
					]}
				/>
			</ChartCard>

			<SectionHeader>Curve Pools</SectionHeader>
			<ChartCard title="Curve Pools">
				<SimpleTable
					getOccurrenceKey={(row) => row.pool}
					rows={data?.curvePools}
					cols={[
						{ key: 'pool', label: 'Pool' },
						{ key: 'apy', label: 'APY', right: true },
						{ key: 'balances', label: 'Balances' },
						{ key: 'tvlUsd', label: 'USD TVL', right: true }
					]}
				/>
			</ChartCard>
		</div>
	)
}
