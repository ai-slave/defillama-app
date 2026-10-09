import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
	fetchAdapterProtocolChartData,
	fetchAdapterProtocolChartDataByBreakdownType
} from '~/containers/AdapterMetrics/api'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { useCustomServerData } from '~/containers/Investors/CustomServerDataContext'
import { EmissionsByProtocol } from '~/containers/Unlocks/EmissionsByProtocol'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { PanelLoadingStatus } from '~/ui/Status'
import { chainIconUrl } from '~/utils/icons'
import { formatPercent } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'
import type { UniswapUnlocks } from './serverData'
import type { Chart, Kpi as KpiT, TrendSeries } from './transform'
import {
	breakdownToSeries,
	chartToTrendSeries,
	groupTopN,
	SeriesTrendChart,
	TOP_CHAINS,
	trimLeadingZeros
} from './TrendChart'
import {
	BarListCard,
	ChartCard,
	KpiGrid,
	PROTOCOL,
	QUERY_OPTS,
	SectionHeader,
	TimeAreaCard,
	usdKpi,
	useProtocolMetrics,
	useUniswapData,
	useUniswapDefs
} from './ui'

interface FeeSwitchData {
	title?: string
	status: string
	mechanism: string
	/** `date` drives the rail spacing; `label` (e.g. 'Mar 6-7, 2026') is what the card shows. */
	schedule: Array<{ date: string; label?: string; chains: Array<string> }>
}

interface FeeActivationRow {
	chain: string
	activationDate: string
	protocolFees30dFormatted: string
	lpFees30dFormatted: string
}

// The ir-server supplies what DefiLlama doesn't have: the fee-switch schedule, the
// onchain UNI-unit burns (Dune), the pair-category split (Dune), and the activation
// table. LP fees and holders revenue (the USD spent buying back and burning UNI) read
// DefiLlama client-side, and the unlocks section reuses the app's own keyed emissions
// pipeline (customServerData), so the ir-server's emissions/supply-derived fields can
// be removed.
interface EconomicsData {
	kpis: Record<string, KpiT | undefined>
	feeSwitch: FeeSwitchData
	uniBurnUnits: Chart
	protocolFeesByCategory: Chart
	feeActivation: { title?: string; rows: Array<FeeActivationRow> }
}

const ANNUALIZE_30D = 365 / 30

const DAY_MS = 86_400_000

// How the protocol's cut is collected on each version, verified against
// docs.uniswap.org/concepts/protocol/fees. Rendered as a compact strip at the top of the
// Protocol Fees section: three short rows beat a paragraph for scanning.
const FEE_MECHANICS: Array<[string, string]> = [
	['v2', 'The swap fee stays 0.30% - 0.25% goes to LPs, 0.05% to the protocol.'],
	['v3', 'The protocol takes 1/4 of LP fees in the 0.01% and 0.05% tiers, 1/6 in the 0.30% and 1.00% tiers.'],
	['v4', 'The protocol fee is charged to the trader on the swap input first; the LP fee applies to the remainder.']
]

function FeeMechanics() {
	return (
		<div className="rounded-lg border border-subtle bg-surface p-4">
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
				{FEE_MECHANICS.map(([version, text]) => (
					<div key={version} className="flex flex-col gap-1">
						<span className="mono-md-bold text-primary">{version}</span>
						<p className="body-sm text-secondary">{text}</p>
					</div>
				))}
			</div>
			<p className="mt-3 body-sm text-tertiary">
				Protocol fees are set by governance-controlled policy and can be adjusted per pool.
			</p>
		</div>
	)
}

// The activation waves as a horizontal timeline: a dot per wave with its date and the
// activated chains' logos, spaced in proportion to the real day gaps between waves
// (each labeled on the rail). Waves wrap onto a second row on narrow screens.
function FeeSwitchTimeline({ feeSwitch }: { feeSwitch: FeeSwitchData }) {
	const isActive = feeSwitch.status === 'Active'
	const waves = feeSwitch.schedule
	// Each wave's segment spans to the next dot; the last wave gets the smallest gap as
	// a nominal tail so its content has room without distorting the scale.
	const gaps = waves.map((wave, index) => {
		const next = waves[index + 1]
		return next ? Math.max(1, Math.round((Date.parse(next.date) - Date.parse(wave.date)) / DAY_MS)) : 0
	})
	const tail = Math.min(...gaps.filter((gap) => gap > 0))
	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
				<h3 className="title-md text-primary">Fee Switch</h3>
				<span
					className={`rounded-full px-2 py-0.5 label-sm ${
						isActive ? 'bg-success-tint-strong text-success' : 'bg-surface-elevated-1 text-tertiary'
					}`}
				>
					{feeSwitch.status}
				</span>
				<p className="body-sm text-tertiary">{feeSwitch.mechanism}</p>
			</div>
			<div className="flex flex-wrap gap-y-4">
				{waves.map((wave, index) => {
					const gap = gaps[index] || tail
					return (
						<div
							key={wave.date}
							className="flex flex-col gap-2"
							// Width grows with the day gap to the next wave; the basis keeps every
							// wave readable and lets narrow screens wrap to a second row.
							style={{ flex: `${gap} 1 110px` }}
						>
							<div className="flex items-center gap-1">
								<span className="size-2.5 shrink-0 rounded-full bg-success" />
								{gaps[index] > 0 && (
									<>
										<span className="h-px min-w-2 flex-1 bg-border-subtle" />
										<span className="mono-sm whitespace-nowrap text-tertiary">+{gaps[index]}d</span>
										<span className="h-px min-w-2 flex-1 bg-border-subtle" />
									</>
								)}
							</div>
							<span className="mono-sm text-tertiary tabular-nums">{wave.label ?? wave.date}</span>
							<div className="flex flex-wrap gap-1 pr-3">
								{wave.chains.map((chain) => (
									<img
										key={chain}
										src={chainIconUrl(chain, 48)}
										alt={chain}
										title={chain}
										className="size-5 rounded-full bg-surface"
										loading="lazy"
									/>
								))}
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}

const ACTIVATION_COLUMNS = 'minmax(130px,1.5fr) minmax(110px,1fr) minmax(130px,1fr) minmax(110px,1fr)'
const ACTIVATION_HEADERS: Array<[string, 'left' | 'right']> = [
	['Chain', 'left'],
	['Activation Date', 'left'],
	['Protocol Fees (30d)', 'right'],
	['LP Fees (30d)', 'right']
]

function FeeActivationTable({ rows }: { rows: Array<FeeActivationRow> }) {
	return (
		<div className="w-full overflow-auto rounded-lg border border-subtle">
			<div style={{ display: 'grid', gridTemplateColumns: ACTIVATION_COLUMNS }}>
				{ACTIVATION_HEADERS.map(([label, align]) => (
					<div
						key={label}
						className="sticky top-0 z-[1] border-b border-subtle bg-surface px-3 py-2.5 label-md tracking-wider text-tertiary uppercase"
						style={{ textAlign: align }}
					>
						{label}
					</div>
				))}
				{rows.map((row, index) => {
					const rowBg = index % 2 === 1 ? 'bg-surface' : ''
					const cell = `truncate border-b border-subtle px-3 py-2.5 body-md text-primary ${rowBg}`
					const numCell = `${cell} text-right tabular-nums`
					return [
						<div key={`${row.chain}-chain`} className={cell}>
							{row.chain}
						</div>,
						<div key={`${row.chain}-date`} className={`${cell} tabular-nums`}>
							{(row.activationDate || '').slice(0, 10)}
						</div>,
						<div key={`${row.chain}-pf`} className={numCell}>
							{row.protocolFees30dFormatted}
						</div>,
						<div key={`${row.chain}-lp`} className={numCell}>
							{row.lpFees30dFormatted}
						</div>
					]
				})}
			</div>
		</div>
	)
}

export default function Economics() {
	const { data } = useUniswapData<EconomicsData>('economics')
	const defs = useUniswapDefs()
	const unlocks = useCustomServerData<UniswapUnlocks>('uniswapUnlocks')
	// Every vesting allocation is fully unlocked; the residual "locked" figure is just the unpaid
	// tail of ongoing Merkl incentive campaigns (~7K UNI, 0.001% of supply). Per Uniswap that is
	// not locked supply, so the shared component's unlocked/locked donut is dropped for this
	// dashboard (it hides itself when totalLocked is absent; the other meta fields still drive the
	// schedule chart) and the unlocked share is shown as a KPI below instead. Done here rather than
	// in the shared component so no other protocol's unlocks page changes.
	const { unlockedEmissions, unlockedKpi } = useMemo(() => {
		const emissions = unlocks?.emissions
		if (!emissions?.meta) return { unlockedEmissions: emissions, unlockedKpi: undefined }
		const { totalLocked, ...meta } = emissions.meta
		const pct = meta.maxSupply > 0 ? Math.min(100, Math.max(0, 100 - (totalLocked / meta.maxSupply) * 100)) : null
		return {
			unlockedEmissions: { ...emissions, meta: meta as typeof emissions.meta },
			unlockedKpi:
				pct == null
					? undefined
					: {
							value: pct,
							formatted: formatPercent(pct, {
								input: 'percent',
								maximumFractionDigits: pct >= 99.95 ? 0 : 1,
								useGrouping: false
							})
						}
		}
	}, [unlocks?.emissions])
	const [burnView, setBurnView] = useState<'total' | 'chain'>('total')
	const [lpView, setLpView] = useState<'total' | 'chain'>('total')

	// Same cached metrics queries as Overview, so both tabs show identical figures.
	const fees = useProtocolMetrics(ADAPTER_TYPES.FEES)
	const holders = useProtocolMetrics(ADAPTER_TYPES.FEES, ADAPTER_DATA_TYPES.DAILY_HOLDERS_REVENUE)

	// Daily LP fees: total swap fees minus the protocol fee (holders revenue), from DefiLlama.
	const lpFeesSeries = useQuery({
		queryKey: ['uniswap-lp-fees-daily'],
		queryFn: async (): Promise<Array<TrendSeries>> => {
			const [feesDaily, holdersDaily] = await Promise.all([
				fetchAdapterProtocolChartData({
					adapterType: ADAPTER_TYPES.FEES,
					protocol: PROTOCOL,
					dataType: ADAPTER_DATA_TYPES.DAILY_FEES
				}),
				fetchAdapterProtocolChartData({
					adapterType: ADAPTER_TYPES.FEES,
					protocol: PROTOCOL,
					dataType: ADAPTER_DATA_TYPES.DAILY_HOLDERS_REVENUE
				})
			])
			const buyback = new Map(holdersDaily)
			return [
				{
					name: 'LP Fees',
					data: feesDaily.map(([ts, value]): [number, number] => [ts, value - (buyback.get(ts) ?? 0)])
				}
			]
		},
		...QUERY_OPTS
	})

	// The holders-revenue series carries a long all-zero head before the fee switch
	// activated; both burn views trim it so the chart starts at the first burn.
	const burnUsdSeries = useQuery({
		queryKey: ['uniswap-burn-usd-daily'],
		queryFn: async (): Promise<Array<TrendSeries>> =>
			trimLeadingZeros([
				{
					name: 'Holders Revenue',
					data: await fetchAdapterProtocolChartData({
						adapterType: ADAPTER_TYPES.FEES,
						protocol: PROTOCOL,
						dataType: ADAPTER_DATA_TYPES.DAILY_HOLDERS_REVENUE
					})
				}
			]),
		...QUERY_OPTS
	})

	// LP fees by chain: per-chain daily fees minus that chain's protocol fee.
	const lpFeesByChainSeries = useQuery({
		queryKey: ['uniswap-breakdown', 'lp-fees-by-chain'],
		queryFn: async () => {
			const [feesRows, holdersRows] = await Promise.all([
				fetchAdapterProtocolChartDataByBreakdownType({
					adapterType: ADAPTER_TYPES.FEES,
					protocol: PROTOCOL,
					dataType: ADAPTER_DATA_TYPES.DAILY_FEES,
					type: 'chain'
				}),
				fetchAdapterProtocolChartDataByBreakdownType({
					adapterType: ADAPTER_TYPES.FEES,
					protocol: PROTOCOL,
					dataType: ADAPTER_DATA_TYPES.DAILY_HOLDERS_REVENUE,
					type: 'chain'
				})
			])
			const buybackByDay = new Map(holdersRows)
			const net = feesRows.map(([timestamp, values]): (typeof feesRows)[number] => {
				const buyback = buybackByDay.get(timestamp)
				if (!buyback) return [timestamp, values]
				const row: Record<string, number> = {}
				for (const [chain, value] of Object.entries(values)) row[chain] = value - (buyback[chain] ?? 0)
				return [timestamp, row]
			})
			return groupTopN(breakdownToSeries(net), TOP_CHAINS)
		},
		...QUERY_OPTS
	})

	const burnByChainSeries = useQuery({
		queryKey: ['uniswap-breakdown', 'burn-usd-by-chain'],
		queryFn: async () =>
			groupTopN(
				trimLeadingZeros(
					breakdownToSeries(
						await fetchAdapterProtocolChartDataByBreakdownType({
							adapterType: ADAPTER_TYPES.FEES,
							protocol: PROTOCOL,
							dataType: ADAPTER_DATA_TYPES.DAILY_HOLDERS_REVENUE,
							type: 'chain'
						})
					)
				),
				TOP_CHAINS
			),
		...QUERY_OPTS
	}) // The read each trend card shows, so its Try again reruns that one.
	const lpRead = lpView === 'total' ? lpFeesSeries : lpFeesByChainSeries
	const burnRead = burnView === 'total' ? burnUsdSeries : burnByChainSeries

	const kpis: Record<string, KpiT | undefined> = useMemo(() => {
		const server = data?.kpis ?? {}
		const lp = (total?: number | null, burn?: number | null) => (total != null && burn != null ? total - burn : null)
		return {
			// ir-server (Dune, onchain UNI units)
			totalUniBurned: server.totalUniBurned,
			uniBurnedBuyback: server.uniBurnedBuyback,
			uniBurnedTreasury: server.uniBurnedTreasury,
			uniBurnAnnualizedUnits: server.uniBurnAnnualizedUnits,
			// DefiLlama, client-side
			lpFeesLifetime: usdKpi(lp(fees.data?.totalAllTime, holders.data?.totalAllTime)),
			lpFeesAnnualized: usdKpi(
				fees.data?.total30d != null && holders.data?.total30d != null
					? (fees.data.total30d - holders.data.total30d) * ANNUALIZE_30D
					: null
			),
			lpFees30d: usdKpi(lp(fees.data?.total30d, holders.data?.total30d)),
			lpFees24h: usdKpi(lp(fees.data?.total24h, holders.data?.total24h)),
			holdersRevenueLifetime: usdKpi(holders.data?.totalAllTime),
			holdersRevenueAnnualized: usdKpi(holders.data?.total30d != null ? holders.data.total30d * ANNUALIZE_30D : null),
			holdersRevenue30d: usdKpi(holders.data?.total30d),
			holdersRevenue24h: usdKpi(holders.data?.total24h)
		}
	}, [data, fees.data, holders.data])

	if (!data || fees.isPending || holders.isPending) return <PanelLoadingStatus />

	return (
		<div className="flex flex-col gap-10">
			<FeeSwitchTimeline feeSwitch={data.feeSwitch} />

			{/* All KPIs up top, grouped, so every headline figure reads without scrolling. */}
			<section className="flex flex-col gap-6">
				<KpiGrid
					label="LP Fees (Supply-Side Revenue)"
					kpis={kpis}
					items={[
						['lpFeesAnnualized', 'LP Fees (Annualized)', 'Trailing 30-day LP fees scaled to a year.'],
						['lpFees30d', 'LP Fees (30d)', undefined],
						['lpFees24h', 'LP Fees (24h)', undefined],
						['lpFeesLifetime', 'LP Fees (Lifetime)', defs.lpFees]
					]}
				/>
				{/* "Protocol Fees", not "buyback": fees accrue to the TokenJar and UNI is burned
				    against it - there is no market buyback. */}
				<KpiGrid
					label="Protocol Fees (Holders Revenue)"
					kpis={kpis}
					items={[
						[
							'holdersRevenueAnnualized',
							'Protocol Fees (Annualized)',
							'Trailing 30-day protocol fees scaled to a year.'
						],
						['holdersRevenue30d', 'Protocol Fees (30d)', undefined],
						['holdersRevenue24h', 'Protocol Fees (24h)', undefined],
						['holdersRevenueLifetime', 'Protocol Fees (Lifetime)', defs.holdersRevenue]
					]}
				/>
				<KpiGrid
					label="UNI Burn"
					kpis={kpis}
					items={[
						['totalUniBurned', 'Total UNI Burned', undefined],
						['uniBurnedBuyback', 'UNI Burned (Fee Switch)', undefined],
						['uniBurnedTreasury', 'Treasury Burn (One-off)', undefined],
						['uniBurnAnnualizedUnits', 'Burn Rate (Annualized)', undefined]
					]}
				/>
			</section>

			<section className="flex flex-col gap-6">
				<SectionHeader>Protocol Fees</SectionHeader>
				<FeeMechanics />
				{/* With a single month of history a time axis renders one giant block, so show
				    that month as ranked category bars until the backfill grows. */}
				{data.protocolFeesByCategory.dates.length < 2 ? (
					<BarListCard
						title={`Protocol Fees by Pair Category (${data.protocolFeesByCategory.dates[0]?.slice(0, 7) ?? 'latest month'})`}
						subtitle="The monthly protocol-fee total split by pair category (fee-switch cut, not total swap fees; the category mix is measured on v2 and v3 pools). Renders as a monthly trend once more history accumulates."
						items={data.protocolFeesByCategory.series
							.map((series) => ({ name: series.name, value: series.data[0] ?? 0 }))
							.sort((a, b) => b.value - a.value)}
						valueSymbol="$"
					/>
				) : (
					<SeriesTrendChart
						title="Protocol Fees by Pair Category"
						subtitle={
							data.protocolFeesByCategory.note ??
							'The monthly protocol-fee total split by pair category (fee-switch cut, not total swap fees; the category mix is measured on v2 and v3 pools).'
						}
						series={chartToTrendSeries(data.protocolFeesByCategory)}
					/>
				)}
				<ChartCard
					title="Protocol Fee Activation by Chain"
					subtitle="Per-chain activation date with trailing 30-day protocol fees and LP fees."
				>
					<FeeActivationTable rows={data.feeActivation?.rows ?? []} />
				</ChartCard>
			</section>

			<section className="flex flex-col gap-6">
				<SectionHeader>LP Fees (Supply-Side Revenue)</SectionHeader>
				<SeriesTrendChart
					title="LP Fees (Supply-Side Revenue)"
					subtitle="Swap fees accruing to liquidity providers: total fees minus the protocol fee."
					series={lpView === 'total' ? lpFeesSeries.data : lpFeesByChainSeries.data}
					isLoading={lpView === 'total' ? lpFeesSeries.isLoading : lpFeesByChainSeries.isLoading}
					failedRead={queryReadFailed(lpRead) ? lpRead : null}
					stacked={lpView === 'chain'}
					defaultView="cumulative"
					extraControl={
						<SegmentedControl<'total' | 'chain'>
							variant="default"
							size="md"
							label="LP fees breakdown"
							options={[
								{ value: 'total', label: 'Total' },
								{ value: 'chain', label: 'By Chain' }
							]}
							value={lpView}
							onValueChange={setLpView}
						/>
					}
				/>
			</section>

			<section className="flex flex-col gap-6">
				<SectionHeader>Protocol Fees & UNI Burn</SectionHeader>
				<SeriesTrendChart
					title="Protocol Fees (Holders Revenue)"
					subtitle="The protocol's cut of swap fees since the fee-switch activation, collected in the TokenJar and burned as UNI."
					series={burnView === 'total' ? burnUsdSeries.data : burnByChainSeries.data}
					isLoading={burnView === 'total' ? burnUsdSeries.isLoading : burnByChainSeries.isLoading}
					failedRead={queryReadFailed(burnRead) ? burnRead : null}
					stacked={burnView === 'chain'}
					defaultView="day"
					extraControl={
						<SegmentedControl<'total' | 'chain'>
							variant="default"
							size="md"
							label="Protocol fees breakdown"
							options={[
								{ value: 'total', label: 'Total' },
								{ value: 'chain', label: 'By Chain' }
							]}
							value={burnView}
							onValueChange={setBurnView}
						/>
					}
				/>
				<TimeAreaCard
					chart={data.uniBurnUnits}
					title="UNI Burned by Source (Cumulative)"
					stacked
					valueSymbol=""
					subtitle="Cumulative UNI burned onchain, fee-switch burns and the one-off treasury burn shown separately."
				/>
			</section>

			<section className="flex flex-col gap-6">
				<SectionHeader>UNI Token Unlocks</SectionHeader>
				{unlockedKpi && (
					<KpiGrid
						kpis={{ supplyUnlocked: unlockedKpi }}
						cols={3}
						items={[
							[
								'supplyUnlocked',
								'Supply Unlocked',
								'All vesting allocations (team, investors, advisors, community, airdrop) are fully unlocked. The unpaid tail of ongoing Merkl incentive campaigns (~7K UNI) is not locked supply.'
							]
						]}
					/>
				)}
				{unlockedEmissions ? (
					<EmissionsByProtocol
						data={unlockedEmissions}
						initialTokenMarketData={unlocks.initialTokenMarketData}
						generatedAtSec={unlocks.generatedAtSec}
						isEmissionsPage
						disableClientTokenStatsFetch
					/>
				) : (
					<p className="flex h-[360px] items-center justify-center text-center body-sm text-tertiary">
						No unlocks data.
					</p>
				)}
			</section>
		</div>
	)
}
