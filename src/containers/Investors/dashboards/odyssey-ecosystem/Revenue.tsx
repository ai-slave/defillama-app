import { useQuery } from '@tanstack/react-query'
import { lazy, useMemo, useState } from 'react'
import { buildSparseCartesianChartModel } from '~/components/ECharts/MultiSeriesChart/model'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import { IncomeStatement } from '~/containers/ProtocolOverview/IncomeStatement'
import type { IProtocolOverviewPageData } from '~/containers/ProtocolOverview/types'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { formatNumber, formatPercent } from '~/utils/numberFormat'
import { readInvestorApiJson } from '../../api.types'
import { useTab, chartToModel, type RevenueResponse } from './api'
import { KpiCard, ChartCard, SectionHeader, ChartSkeleton, SimpleTable, fmtUsd } from './ui'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>
const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>

const INCOME_STATEMENT_PROTOCOL = 'metronome-synth'
const INCOME_STATEMENT_NAME = 'Metronome Synth'

function useMetronomeIncomeStatement() {
	return useQuery({
		queryKey: ['odyssey-ecosystem', 'income-statement', INCOME_STATEMENT_PROTOCOL],
		queryFn: async () => {
			const response = await fetch(`/api/public/income-statement?protocol=${INCOME_STATEMENT_PROTOCOL}&version=2`)
			return response.ok
				? readInvestorApiJson<NonNullable<IProtocolOverviewPageData['incomeStatement']>>(response)
				: null
		},
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false
	})
}

function MetronomeIncomeStatement() {
	const { data: incomeStatement, isLoading } = useMetronomeIncomeStatement()

	const hasData =
		incomeStatement?.data &&
		(['monthly', 'quarterly', 'yearly'] as const).some((k) => Object.keys(incomeStatement.data[k] ?? {}).length > 0)

	if (isLoading || !hasData) return null

	return (
		<>
			<SectionHeader>Metronome · Income Statement</SectionHeader>
			<ChartCard title="Income Statement" subtitle={`${INCOME_STATEMENT_NAME} — fees & revenue`}>
				<IncomeStatement
					name={INCOME_STATEMENT_NAME}
					incomeStatement={incomeStatement}
					view="table"
					anchorId="metronome-income-statement"
					className="border-none bg-transparent p-0"
					showTitles={false}
				/>
			</ChartCard>
			<ChartCard title="Income Statement Visualization" subtitle="Sankey flow of fees → revenue → token holders">
				<IncomeStatement
					name={INCOME_STATEMENT_NAME}
					incomeStatement={incomeStatement}
					view="sankey"
					anchorId="metronome-income-statement-sankey"
					className="border-none bg-transparent p-0"
					showTitles={false}
				/>
			</ChartCard>
		</>
	)
}

const PROTO_COLORS: Record<string, string> = { Metronome: '#fb923c', Vesper: '#a78bfa', Odyssey: '#60a5fa' }
const PIE_COLORS = ['#6366f1', '#22d3ee', '#34d399', '#fbbf24', '#f472b6', '#fb923c', '#a78bfa']

function getPieColor(index: number): string {
	const color = PIE_COLORS[index % PIE_COLORS.length]
	if (color === undefined) throw new Error('Expected the income pipeline color palette to be non-empty')
	return color
}

function sumUsd<Row>(rows: Array<Row> | undefined, getValue: (row: Row) => number): number {
	if (!rows) return 0
	return rows.reduce((sum, row) => sum + (getValue(row) || 0), 0)
}

function SubSectionCard({
	title,
	subtitle,
	total,
	children
}: {
	title: string
	subtitle?: string
	total?: number | null
	children: React.ReactNode
}) {
	return (
		<div className="rounded-lg border border-subtle bg-surface p-4">
			<div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
				<div>
					<h3 className="title-md text-primary">{title}</h3>
					{subtitle && <p className="mt-0.5 body-sm text-secondary">{subtitle}</p>}
				</div>
				{total != null && (
					<div className="text-right">
						<div className="label-xs tracking-wider text-secondary uppercase">Subtotal</div>
						<div className="heading-xs text-primary tabular-nums">{fmtUsd(total)}</div>
					</div>
				)}
			</div>
			{children}
		</div>
	)
}

export default function Revenue() {
	const { data, isLoading } = useTab<RevenueResponse>('revenue')
	const k = data?.kpis ?? ({} as Partial<NonNullable<typeof data>['kpis']>)
	const ra = k.revenueAllTime ?? ({} as Partial<NonNullable<typeof k.revenueAllTime>>)
	const ha = k.holdersAllTime ?? ({} as Partial<NonNullable<typeof k.holdersAllTime>>)
	const cm = k.claimed30d ?? ({} as Partial<NonNullable<typeof k.claimed30d>>)
	const up = data?.unclaimedPipeline ?? ({} as Partial<NonNullable<typeof data>['unclaimedPipeline']>)
	const mc = data?.metronomeClaimed
	const vc = data?.vesperClaimed
	const oc = data?.odysseyClaimed
	const hbm = data?.holdersByMonth
	const llamaDailyChart = data?.llamaDailyChart
	const holderRevenueChart = data?.holderRevenueChart
	const [holderMode, setHolderMode] = useState<'daily' | 'monthly'>('monthly')

	const dailyModel = useMemo(
		() =>
			llamaDailyChart
				? (() => {
						const model = chartToModel(llamaDailyChart)
						return {
							...model,
							charts: model.charts.map((chart) => ({
								...chart,
								type: 'bar' as const,
								stack: 'rev',
								color: PROTO_COLORS[chart.name] || '#6366f1'
							}))
						}
					})()
				: undefined,
		[llamaDailyChart]
	)

	const holderModel = useMemo(
		() =>
			holderRevenueChart
				? (() => {
						const model = chartToModel(holderRevenueChart)
						return {
							...model,
							charts: model.charts.map((chart) => ({
								...chart,
								type: 'bar' as const,
								stack: 'hr',
								color: PROTO_COLORS[chart.name] || '#a78bfa'
							}))
						}
					})()
				: undefined,
		[holderRevenueChart]
	)

	const holdersByMonthModel = useMemo(
		() =>
			hbm
				? buildSparseCartesianChartModel([
						{
							name: 'Metronome',
							type: 'bar' as const,
							color: '#fb923c',
							data: (hbm.metronome || []).map(
								(r) => [Math.floor(Date.parse(`${r.month}-01T00:00:00Z`) / 1000), r.totalUsd] as [number, number]
							)
						},
						{
							name: 'Vesper',
							type: 'bar' as const,
							color: '#a78bfa',
							data: (hbm.vesper || []).map(
								(r) => [Math.floor(Date.parse(`${r.month}-01T00:00:00Z`) / 1000), r.totalUsd] as [number, number]
							)
						}
					])
				: undefined,
		[hbm]
	)

	const lpTotal = sumUsd(up.treasuryLps, (row) => row.rewardsUsd)
	const ethUniv3Total = sumUsd(up.ethUniv3, (row) => row.usd)
	const plasmaTotal = sumUsd(up.plasmaUniv3, (row) => row.usd)
	const amoTotal = sumUsd(up.amoPositions, (row) => row.pnlUsd)
	const veAeroTotal = sumUsd(up.aeroLocks, (row) => row.usd)
	const convexClaimable = (up.convex || []).filter((r) => r.isClaimable).reduce((s, r) => s + (r.usd || 0), 0)
	const synthDaily = (data?.synthInterestDetail || []).reduce((s, r) => s + (r.estimatedDailyUsd || 0), 0)
	const synthMonthly = (data?.synthInterestDetail || []).reduce((s, r) => s + (r.estimatedMonthlyUsd || 0), 0)

	return (
		<div className="flex flex-col gap-6">
			{/* Headline KPIs */}
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<KpiCard
					label="Ecosystem Revenue (All-time)"
					value={ra.ecosystem?.formatted}
					sub="Claimed + unclaimed pipeline"
				/>
				<KpiCard label="Metronome" value={ra.metronome?.formatted} sub="All-time" />
				<KpiCard label="Vesper" value={ra.vesper?.formatted} sub="All-time" />
				<KpiCard label="Odyssey" value={ra.odyssey?.formatted} sub="All-time" />
			</div>
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
				<KpiCard label="Unclaimed Pipeline" value={k.unclaimedPipeline?.formatted} sub="Pending claim / harvest" />
				<KpiCard label="MET Holder Buybacks" value={ha.metronome?.formatted} sub="All-time" />
				<KpiCard label="VSP Holder Buybacks" value={ha.vesper?.formatted} sub="All-time" />
			</div>

			{/* 1 · Claimed revenue */}
			<SectionHeader>Claimed Revenue · Last 30 Days</SectionHeader>
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
				<KpiCard label="Metronome 30d" value={cm.metronome?.formatted} />
				<KpiCard label="Vesper 30d" value={cm.vesper?.formatted} sub={vc ? `${vc.windowDays}d window` : undefined} />
				<KpiCard label="Odyssey 30d" value={cm.odyssey?.formatted} sub={oc ? `${oc.windowDays}d window` : undefined} />
			</div>
			{isLoading || !dailyModel ? (
				<ChartSkeleton title="Daily Revenue" />
			) : (
				<ChartCard title="Daily Claimed Revenue" subtitle="Stacked by protocol">
					<MultiSeriesChart
						dataset={dailyModel.dataset}
						charts={dailyModel.charts}
						valueSymbol="$"
						height="320px"
						hideDefaultLegend={false}
						exportButtons="hidden"
					/>
				</ChartCard>
			)}
			{isLoading || (!holderModel && !holdersByMonthModel) ? (
				<ChartSkeleton title="Holder Buybacks" />
			) : (
				<ChartCard title="Holder Buybacks" subtitle="Revenue routed to token holders (MET / VSP)">
					<div className="mb-3 flex justify-end">
						<SegmentedControl<'daily' | 'monthly'>
							variant="default"
							size="sm"
							label="Holder buybacks period"
							value={holderMode}
							onValueChange={setHolderMode}
							options={[
								{ value: 'monthly', label: 'Monthly' },
								{ value: 'daily', label: 'Daily' }
							]}
						/>
					</div>
					{holderMode === 'monthly' ? (
						holdersByMonthModel ? (
							<MultiSeriesChart
								key="hb-monthly"
								dataset={holdersByMonthModel.dataset}
								charts={holdersByMonthModel.charts}
								valueSymbol="$"
								groupBy="monthly"
								height="300px"
								hideDefaultLegend={false}
								exportButtons="hidden"
							/>
						) : (
							<div className="px-2 py-6 body-sm text-secondary">No monthly holder data</div>
						)
					) : holderModel ? (
						<MultiSeriesChart
							key="hb-daily"
							dataset={holderModel.dataset}
							charts={holderModel.charts}
							valueSymbol="$"
							height="300px"
							hideDefaultLegend={false}
							exportButtons="hidden"
						/>
					) : (
						<div className="px-2 py-6 body-sm text-secondary">No daily holder data</div>
					)}
				</ChartCard>
			)}

			{/* Metronome breakdown · canonical from financial-statement adapter */}
			{mc && (
				<>
					<SectionHeader>Metronome Revenue Breakdown · {mc.monthLabel}</SectionHeader>
					<ChartCard title="Revenue by source" subtitle={`Total ${mc.claimedFormatted} this month`}>
						{mc.hasBreakdown && mc.items?.length ? (
							<SimpleTable
								getRowKey={(row) => JSON.stringify([row.chain, row.id])}
								rows={mc.items}
								cols={[
									{ key: 'label', label: 'Source' },
									{ key: 'chain', label: 'Chain' },
									{ key: 'detail', label: 'Detail' },
									{
										key: 'amountUsd',
										label: 'USD',
										right: true,
										render: (r) => r.amountFormatted || fmtUsd(r.amountUsd)
									}
								]}
							/>
						) : (
							<div className="px-2 py-3 body-sm text-secondary">
								Per-source breakdown not yet available for this month — only the total is reported.
							</div>
						)}
					</ChartCard>
				</>
			)}

			{/* 2 · Income statement */}
			<MetronomeIncomeStatement />

			{/* 3 · Unclaimed pipeline */}
			<SectionHeader>Unclaimed Pipeline · Overview</SectionHeader>
			<div className="rounded-lg border border-subtle bg-surface p-5">
				<div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
					<div>
						<div className="label-sm tracking-wide text-secondary uppercase">Pipeline Total</div>
						<div className="mt-1 mono-xl text-primary">{k.unclaimedPipeline?.formatted || '—'}</div>
					</div>
					{up.asOf && <span className="body-sm text-secondary">As of {up.asOf}</span>}
				</div>
				{up.pie && (
					<PieChart
						chartData={up.pie}
						valueSymbol="$"
						height="320px"
						showLegend
						legendPosition={{ orient: 'vertical', left: 'right', top: 'middle' }}
						stackColors={Object.fromEntries(up.pie.map((p, i) => [p.name, getPieColor(i)]))}
					/>
				)}
			</div>

			<SectionHeader>Treasury LP Positions · Pending Rewards</SectionHeader>
			<SubSectionCard title="Staked LP gauge rewards" total={lpTotal}>
				<SimpleTable
					getOccurrenceKey={(row) => row.pool}
					rows={up.treasuryLps}
					cols={[
						{ key: 'pool', label: 'Pool' },
						{ key: 'stakedLp', label: 'Staked LP' },
						{ key: 'rewards', label: 'Pending Rewards' },
						{ key: 'rewardsUsd', label: 'Rewards USD', right: true, render: (r) => fmtUsd(r.rewardsUsd) },
						{ key: 'value', label: 'Position Value', right: true }
					]}
				/>
			</SubSectionCard>

			<SectionHeader>UniV3 Concentrated Liquidity · Unclaimed Fees</SectionHeader>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<SubSectionCard title="Ethereum UniV3" total={ethUniv3Total}>
					<SimpleTable
						getOccurrenceKey={(row) => JSON.stringify([row.position, row.pool])}
						rows={up.ethUniv3}
						cols={[
							{ key: 'position', label: 'Position' },
							{ key: 'pool', label: 'Pool' },
							{ key: 'rewards', label: 'Unclaimed' },
							{ key: 'usd', label: 'USD', right: true, render: (r) => fmtUsd(r.usd) }
						]}
					/>
				</SubSectionCard>
				<SubSectionCard title="Plasma UniV3" total={plasmaTotal}>
					<SimpleTable
						getOccurrenceKey={(row) => JSON.stringify([row.position, row.pool])}
						rows={up.plasmaUniv3}
						cols={[
							{ key: 'position', label: 'Position' },
							{ key: 'pool', label: 'Pool' },
							{ key: 'rewards', label: 'Pending Rewards' },
							{ key: 'usd', label: 'USD', right: true, render: (r) => fmtUsd(r.usd) }
						]}
					/>
				</SubSectionCard>
			</div>

			<SectionHeader>Gauge & Lock Rewards</SectionHeader>
			<SubSectionCard title="veAERO Locks (Base)" total={veAeroTotal}>
				<SimpleTable
					getOccurrenceKey={(row) => String(row.nft)}
					rows={up.aeroLocks}
					cols={[
						{ key: 'nft', label: 'NFT' },
						{ key: 'locked', label: 'Locked AERO' },
						{ key: 'rewards', label: 'Pending Rewards' },
						{ key: 'usd', label: 'USD', right: true, render: (r) => fmtUsd(r.usd) },
						{ key: 'unlock', label: 'Unlock', right: true, render: (r) => r.unlock || '—' }
					]}
				/>
			</SubSectionCard>

			<SectionHeader>Morpho AMO · Unrealised PnL</SectionHeader>
			<SubSectionCard title="AMO vault positions" total={amoTotal}>
				<SimpleTable
					getOccurrenceKey={(row) => JSON.stringify([row.vaultName, row.asset])}
					rows={up.amoPositions}
					cols={[
						{ key: 'vaultName', label: 'Vault' },
						{ key: 'asset', label: 'Asset' },
						{ key: 'assetsUsd', label: 'NAV', right: true, render: (r) => fmtUsd(r.assetsUsd) },
						{ key: 'grossPnlUsd', label: 'Gross PnL', right: true, render: (r) => fmtUsd(r.grossPnlUsd) },
						{
							key: 'feeRate',
							label: 'Fee',
							right: true,
							render: (r) =>
								`${formatPercent(r.feeRate ?? 0, { input: 'fraction', minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false })}`
						},
						{ key: 'pnlUsd', label: 'Unclaimed Yield', right: true, render: (r) => fmtUsd(r.pnlUsd) },
						{
							key: 'lastHarvestDate',
							label: 'Last Harvest',
							right: true,
							render: (r) => (r.lastHarvestDate ? `${r.lastHarvestDate} · ${fmtUsd(r.lastHarvestUsd)}` : '—')
						}
					]}
				/>
			</SubSectionCard>

			<SectionHeader>Convex vlCVX · Vote-locked Rewards</SectionHeader>
			<SubSectionCard title="vlCVX claimable" subtitle={`Claimable rewards total ${fmtUsd(convexClaimable)}.`}>
				<SimpleTable
					getOccurrenceKey={(row) => JSON.stringify([row.type, row.unlock])}
					rows={up.convex}
					cols={[
						{ key: 'type', label: 'Type' },
						{ key: 'status', label: 'Status' },
						{ key: 'usd', label: 'USD', right: true, render: (r) => fmtUsd(r.usd) },
						{ key: 'unlock', label: 'Unlock', right: true, render: (r) => r.unlock || '—' }
					]}
				/>
			</SubSectionCard>

			{/* Synth interest — informational, not in pipeline total */}
			<SectionHeader>Synth Interest · Borrower-side Accrual</SectionHeader>
			<SubSectionCard
				title="Outstanding synth debt"
				subtitle={`Est. ${fmtUsd(synthDaily)} per day · ${fmtUsd(synthMonthly)} per month`}
			>
				<div className="flex flex-col gap-4">
					{(data?.synthInterestDetail || []).map((r) => (
						<div key={r.asset} className="rounded-md border border-subtle p-3">
							<div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
								<div>
									<span className="title-md text-primary">{r.asset}</span>
									<span className="ml-2 body-sm text-secondary">
										{formatPercent(r.annualRatePct, { input: 'percent' })} APR · debt {fmtUsd(r.totalDebtUsd)}
									</span>
								</div>
								<div className="body-sm text-secondary">
									<span className="mr-3">Daily {fmtUsd(r.estimatedDailyUsd)}</span>
									<span>Monthly {fmtUsd(r.estimatedMonthlyUsd)}</span>
								</div>
							</div>
							<SimpleTable
								getOccurrenceKey={(row) => row.chain}
								rows={r.byChain}
								cols={[
									{ key: 'chain', label: 'Chain' },
									{
										key: 'amount_synth',
										label: 'Debt (synth)',
										right: true,
										render: (x) => formatNumber(x.amount_synth)
									},
									{ key: 'amount_usd', label: 'Debt (USD)', right: true, render: (x) => fmtUsd(x.amount_usd) }
								]}
							/>
						</div>
					))}
				</div>
			</SubSectionCard>
		</div>
	)
}
