import { lazy, useState } from 'react'
import type { ISankeyChartProps } from '~/components/ECharts/SankeyChart/types'
import { formatCompactNumber, formatPercent } from '~/utils/numberFormat'
import type { Chart, Kpi as KpiT } from './transform'
import {
	BarListCard,
	ChartCard,
	KpiGrid,
	PageLoader,
	SectionHeader,
	SegToggle,
	TimeAreaCard,
	useUniswapData
} from './ui'

interface TopPoolRow {
	pool: string
	chain: string
	version: string
	tvl: number
	tvlFormatted: string
	pctOfTvl: number
}

// All served by the ir-server: TVL comes from the DefiLlama protocol endpoint (no light
// public per-protocol TVL chart API to read client-side), open LP positions from Dune, and the
// segment splits from the maintained token-segment map (snapshot on DefiLlama pool TVL,
// over-time via daily Allium balances). Slippage/price impact and top-pair market
// share were cut by Uniswap in the methodology review.
interface LiquidityData {
	kpis: Record<string, KpiT | undefined>
	tvlTotal: Chart
	tvlByChain: Chart
	tvlByVersion: Chart
	topPools: { title?: string; rows: Array<TopPoolRow> }
	activeLps: Chart
	/** Null until the ir-server serving this deployment ships the LP breakdowns. */
	activeLpsByVersion: Chart | null
	activeLpsByChain: Chart | null
	/** Null until the lp-custody Dune view is materialized (see ir-server sql/lp-custody.sql). */
	activeLpsByCustody: (Chart & { note?: string }) | null
	/** Latest custody x activity snapshot; each owner counted once. */
	lpCustodySankey: {
		title?: string
		note?: string
		asOf?: string
		links: Array<{ source: string; target: string; value: number }>
	} | null
	liquidityBySegment: Chart
}

type LpView = 'all' | 'chain' | 'version'

// The unique-wallet total and the breakdowns are different quantities, not parts of one chart: a
// wallet providing liquidity on several chains is counted in each of them, so the chain parts add up
// to ~116% of unique wallets (~104% for versions). Sharing an axis would put ~1.38M on a chart whose
// answer is 1.19M, so the total gets its own view and each breakdown stacks on its own terms.
// Subtitles stay one short line each: a longer one wraps on some views and not others, which moves
// the chart under it every time the toggle is used. The shared caveat sits above the card instead.
const LP_VIEWS: Record<LpView, { label: string; title: string; subtitle: string }> = {
	all: {
		label: 'All',
		title: 'LPs with Open Positions',
		subtitle: 'Wallets holding a position with liquidity remaining, measured weekly.'
	},
	chain: {
		label: 'Chains',
		title: 'LPs with Open Positions by Chain',
		subtitle: 'The same wallets stacked by chain, measured weekly.'
	},
	version: {
		label: 'Versions',
		title: 'LPs with Open Positions by Version',
		subtitle: 'The same wallets stacked by protocol version, measured weekly.'
	}
}

const LP_SUBTITLES = Object.values(LP_VIEWS).map((view) => view.subtitle)

// Index 0 is the Total view, 1 the By Chain view.
const TVL_SUBTITLES = [
	'Total value locked across all versions and chains.',
	'TVL split by chain (top chains plus Other). Click a legend entry to toggle a chain.'
]

const LP_OVERLAP_NOTE =
	'A wallet providing liquidity on several chains or versions is counted in each of them, so the Chains and Versions stacks run above the deduplicated All total.'

const SankeyChart = lazy(() => import('~/components/ECharts/SankeyChart')) as React.FC<ISankeyChartProps>

const SANKEY_COLORS: Record<string, string> = {
	v2: '#FF5F52',
	v3: '#FFB238',
	v4: '#00C3A0',
	'Wallet-Custodied': '#4C82FB',
	'Contract-Managed': '#9E62FF',
	Active: '#40B66B',
	Passive: '#94A3B8'
}

// Latest snapshot as a sankey (version → custody → activity), each owner counted once, in the
// version and custody of their most recently active open position.
function CustodySankeyCard({ sankey }: { sankey: NonNullable<LiquidityData['lpCustodySankey']> }) {
	// A node's size is its incoming flow (outgoing for the leftmost layer, which has none);
	// summing both sides would double-count the middle custody layer.
	const inflow = new Map<string, number>()
	const outflow = new Map<string, number>()
	for (const link of sankey.links) {
		outflow.set(link.source, (outflow.get(link.source) ?? 0) + link.value)
		inflow.set(link.target, (inflow.get(link.target) ?? 0) + link.value)
	}
	const nodes = ['v2', 'v3', 'v4', 'Wallet-Custodied', 'Contract-Managed', 'Active', 'Passive']
		.filter((name) => inflow.has(name) || outflow.has(name))
		.map((name) => {
			const total = inflow.get(name) ?? outflow.get(name) ?? 0
			return {
				name,
				color: SANKEY_COLORS[name],
				displayValue: formatCompactNumber(total) ?? String(total)
			}
		})
	return (
		<ChartCard
			title={sankey.title ?? 'LP Owners - Custody & Activity'}
			subtitle={sankey.note ?? 'Each owner counted once; Active = a liquidity action in the last 7 days.'}
		>
			<SankeyChart nodes={nodes} links={sankey.links} nodeColors={SANKEY_COLORS} height="360px" />
		</ChartCard>
	)
}

const POOL_COLUMNS = 'minmax(140px,1.5fr) minmax(110px,1fr) minmax(70px,0.5fr) minmax(110px,1fr) minmax(90px,0.8fr)'
const POOL_HEADERS: Array<[string, 'left' | 'right']> = [
	['Pool', 'left'],
	['Chain', 'left'],
	['Version', 'left'],
	['TVL', 'right'],
	['% of TVL', 'right']
]

function TopPoolsTable({ rows }: { rows: Array<TopPoolRow> }) {
	return (
		<div className="w-full overflow-auto rounded-lg border border-pro-cards-border">
			<div style={{ display: 'grid', gridTemplateColumns: POOL_COLUMNS }}>
				{POOL_HEADERS.map(([label, align]) => (
					<div
						key={label}
						className="sticky top-0 z-[1] border-b border-subtle bg-pro-cards-bg px-3 py-2.5 text-sm font-medium tracking-wider text-pro-text-tertiary uppercase"
						style={{ textAlign: align }}
					>
						{label}
					</div>
				))}
				{rows.map((row, index) => {
					const rowBg = index % 2 === 1 ? 'bg-pro-cards-bg' : ''
					const cell = `truncate border-b border-subtle px-3 py-2.5 text-sm text-pro-text-primary ${rowBg}`
					const numCell = `${cell} text-right font-jetbrains tabular-nums`
					return [
						<div key={`${index}-pool`} className={cell}>
							{row.pool}
						</div>,
						<div key={`${index}-chain`} className={cell}>
							{row.chain}
						</div>,
						<div key={`${index}-version`} className={`${cell} font-jetbrains`}>
							{row.version.replace(/^uniswap-/, '')}
						</div>,
						<div key={`${index}-tvl`} className={numCell}>
							{row.tvlFormatted}
						</div>,
						<div key={`${index}-pct`} className={numCell}>
							{formatPercent(row.pctOfTvl, {
								input: 'percent',
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
								useGrouping: false
							})}
						</div>
					]
				})}
			</div>
		</div>
	)
}

export default function Liquidity() {
	const { data } = useUniswapData<LiquidityData>('liquidity')
	// Kept as its own endpoint upstream so a slow Allium run never blocks the rest of the tab.
	const { data: segmentsOverTime } = useUniswapData<Chart>('liquiditySegments')
	const [tvlView, setTvlView] = useState<'total' | 'chain'>('total')
	// Opens on the chain split: where the LPs are is the finding, and the headline value carries the
	// deduplicated total on every view anyway.
	const [lpView, setLpView] = useState<LpView>('chain')
	if (!data) return <PageLoader />

	// Older ir-server deployments send no breakdowns, so the toggle offers only what arrived and any
	// view whose chart is missing falls back to the total.
	const lpCharts: Record<LpView, Chart | null> = {
		all: data.activeLps,
		chain: data.activeLpsByChain,
		version: data.activeLpsByVersion
	}
	const lpOptions = (Object.keys(LP_VIEWS) as Array<LpView>)
		.filter((view) => lpCharts[view])
		.map((view) => ({ value: view, label: LP_VIEWS[view].label }))
	const resolvedLpView: LpView = lpCharts[lpView] ? lpView : 'all'

	// Top-10 concentration derived from the pools table itself, so the KPI always agrees with it.
	const top10Pct = data.topPools.rows.slice(0, 10).reduce((sum, row) => sum + (row.pctOfTvl || 0), 0)
	const kpis: Record<string, KpiT | undefined> = {
		...data.kpis,
		top10Concentration:
			top10Pct > 0
				? {
						value: top10Pct,
						formatted: formatPercent(top10Pct, {
							input: 'percent',
							minimumFractionDigits: 1,
							maximumFractionDigits: 1,
							useGrouping: false
						})
					}
				: undefined
	}

	// Largest segment first (HBarChart renders the first item at the top), catch-all last.
	const segmentSnapshot = (data.liquidityBySegment?.dates ?? [])
		.map((name, index) => ({
			name,
			value: data.liquidityBySegment.series[0]?.data[index] ?? 0
		}))
		.sort((a, b) => {
			const aOther = a.name.startsWith('Other')
			const bOther = b.name.startsWith('Other')
			if (aOther !== bOther) return aOther ? 1 : -1
			return b.value - a.value
		})

	return (
		<div className="flex flex-col gap-10">
			<KpiGrid
				kpis={kpis}
				cols={3}
				items={[
					['totalTvl', 'Total TVL', 'Total value locked across all versions and chains, as measured by DefiLlama.'],
					['activeLps', 'LPs with Open Positions', undefined],
					['top10Concentration', 'Top 10 Pools Share of TVL', 'Share of total TVL held by the ten largest pools.']
				]}
			/>

			<section className="flex flex-col gap-6">
				<SectionHeader>TVL</SectionHeader>
				<TimeAreaCard
					title="TVL"
					chart={tvlView === 'total' ? data.tvlTotal : data.tvlByChain}
					stacked={tvlView === 'chain'}
					valueSymbol="$"
					value={data.kpis.totalTvl?.formatted}
					subtitle={tvlView === 'chain' ? TVL_SUBTITLES[1] : TVL_SUBTITLES[0]}
					subtitles={TVL_SUBTITLES}
					control={
						<SegToggle<'total' | 'chain'>
							options={[
								{ value: 'total', label: 'Total' },
								{ value: 'chain', label: 'By Chain' }
							]}
							value={tvlView}
							onChange={setTvlView}
						/>
					}
				/>
				<TimeAreaCard chart={data.tvlByVersion} stacked valueSymbol="$" subtitle="TVL split by protocol version." />
			</section>

			<section className="flex flex-col gap-6">
				<SectionHeader>Liquidity Providers</SectionHeader>
				{lpOptions.length > 1 && (
					<p className="-mt-3 text-xs leading-relaxed text-pro-text-tertiary">{LP_OVERLAP_NOTE}</p>
				)}
				<TimeAreaCard
					chart={lpCharts[resolvedLpView] ?? data.activeLps}
					title={LP_VIEWS[resolvedLpView].title}
					subtitle={LP_VIEWS[resolvedLpView].subtitle}
					subtitles={LP_SUBTITLES}
					valueSymbol=""
					value={data.kpis.activeLps?.formatted}
					stacked={resolvedLpView !== 'all'}
					// The total sits in a band a few percent wide, so only it needs the axis scaled to the
					// data; a stack has to keep its zero baseline to read as composition.
					level={resolvedLpView === 'all'}
					{...(lpOptions.length > 1
						? { control: <SegToggle<LpView> options={lpOptions} value={resolvedLpView} onChange={setLpView} /> }
						: {})}
				/>
				{/* Two standalone custody charts: the full-history weekly split as a stacked
				    area, the latest snapshot as a sankey. */}
				{(data.activeLpsByCustody || data.lpCustodySankey) && (
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						{data.activeLpsByCustody && (
							<TimeAreaCard
								chart={data.activeLpsByCustody}
								title="LP Owners by Custody"
								stacked
								valueSymbol=""
								subtitle="Wallet-custodied vs contract-managed owners of open positions, weekly, v2-v4."
							/>
						)}
						{data.lpCustodySankey && <CustodySankeyCard sankey={data.lpCustodySankey} />}
					</div>
				)}
			</section>

			<section className="flex flex-col gap-6">
				<SectionHeader>TVL by Token Segment</SectionHeader>
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<BarListCard
						title="TVL by Token Segment"
						subtitle="Current pool TVL mapped to token segments via the maintained segment list."
						items={segmentSnapshot}
						valueSymbol="$"
					/>
					{segmentsOverTime && (
						<TimeAreaCard
							chart={segmentsOverTime}
							title="TVL by Token Segment Over Time"
							stacked
							valueSymbol="$"
							subtitle="Daily snapshots of core pools (both tokens segment-mapped) across the top chains."
						/>
					)}
				</div>
			</section>

			<section className="flex flex-col gap-6">
				<SectionHeader>Top Pools</SectionHeader>
				<ChartCard
					title={data.topPools.title ?? 'Top Uniswap Pools as % of TVL'}
					subtitle="The largest pools by TVL and their share of total protocol TVL."
				>
					<TopPoolsTable rows={data.topPools.rows} />
				</ChartCard>
			</section>
		</div>
	)
}
