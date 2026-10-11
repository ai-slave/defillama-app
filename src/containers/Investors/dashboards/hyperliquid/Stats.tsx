import { useSelector } from '@tanstack/react-store'
import {
	type ColumnDef,
	createPaginatedRowModel,
	type PaginationState,
	rowPaginationFeature,
	type SortingState,
	type Table as TableInstance,
	tableFeatures,
	useTable
} from '@tanstack/react-table'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { IHBarChartProps } from '~/components/ECharts/HBarChart/types'
import type { IPieChartProps } from '~/components/ECharts/PieChart/types'
import type { IScatterChartProps, ScatterChartPoint } from '~/components/ECharts/ScatterChart/types'
import { escapeHtml } from '~/components/ECharts/shared/escapeHtml'
import { filteredTableFeatures } from '~/components/Table/features/filtering'
import { Table } from '~/components/Table/Table'
import { TablePager } from '~/components/Table/TablePager'
import {
	CHART_FILL,
	ChartPanel,
	ChartPanelBody,
	ChartPanelBodyLoading,
	ChartPanelTitle,
	ChartPanelToolbar
} from '~/ui/ChartPanel'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { StatTile } from '~/ui/SummaryStats'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { mergeFailedReads, queryReadFailed } from '~/utils/query'
import {
	type PerpMarket,
	type PredictedFunding,
	type SpotMarket,
	useHyperliquidPerps,
	useHyperliquidPredictedFundings,
	useHyperliquidSpot,
	useHyperliquidWsChannels,
	type WsSubscription
} from './api'

const tableFeaturesConfig = tableFeatures({
	...filteredTableFeatures,
	rowPaginationFeature,
	paginatedRowModel: createPaginatedRowModel()
})

const HBarChart = lazy(() => import('~/components/ECharts/HBarChart')) as React.FC<IHBarChartProps>
const PieChart = lazy(() => import('~/components/ECharts/PieChart')) as React.FC<IPieChartProps>
const ScatterChart = lazy(() => import('~/components/ECharts/ScatterChart')) as React.FC<IScatterChartProps>

const ALL_MIDS_SUB: Array<WsSubscription> = [{ type: 'allMids' }]
const TICKER_SPEED_PX_PER_SEC = 52
const PAGE_SIZE = 10

const FUNDING_UP_COLOR = '#10b981'
const FUNDING_DOWN_COLOR = '#ef4444'
const OI_COLORS = ['#2172e5', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a78bfa', '#94a3b8']

function formatPct(value: number | null | undefined) {
	if (value == null) return '—'
	return `${value >= 0 ? '+' : ''}${formatPercent(value, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
}

function formatTimestamp(ts: number | null | undefined) {
	if (!ts) return '—'
	return new Date(ts).toLocaleString('en-US', {
		hour12: false,
		month: 'short',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	})
}

const renderItem = (coin: string, i: number) => (
	<span
		key={`${coin}-${i}`}
		data-coin={coin}
		className="inline-flex h-full shrink-0 items-center gap-1.5 border-r border-subtle px-4 label-sm text-primary transition-colors duration-300"
	>
		<span className="shrink-0 text-secondary">{coin}</span>
		<span data-price className="shrink-0 overflow-hidden mono-sm whitespace-nowrap tabular-nums">
			--
		</span>
	</span>
)

function PriceTickerTape({ coins }: { coins: Array<string> }) {
	const trackRef = useRef<HTMLDivElement>(null)
	const priceEls = useRef<Map<string, Array<HTMLElement>>>(new Map())
	const itemEls = useRef<Map<string, Array<HTMLElement>>>(new Map())
	const prevPrices = useRef<Record<string, string>>({})
	const latestMidsRef = useRef<Record<string, string> | null>(null)
	const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
	const offsetRef = useRef(0)
	const halfWidthRef = useRef(0)
	const lastTsRef = useRef<number | null>(null)
	const rafRef = useRef(0)

	useEffect(() => {
		const track = trackRef.current
		if (!track) return

		const nextPrices = new Map<string, Array<HTMLElement>>()
		const nextItems = new Map<string, Array<HTMLElement>>()
		for (const coin of coins) {
			const els = Array.from(track.querySelectorAll<HTMLElement>(`[data-coin="${coin}"]`))
			nextItems.set(coin, els)
			nextPrices.set(
				coin,
				els.map((el) => el.querySelector<HTMLElement>('[data-price]')).filter((el): el is HTMLElement => el != null)
			)
		}
		priceEls.current = nextPrices
		itemEls.current = nextItems
	}, [coins])

	useHyperliquidWsChannels(ALL_MIDS_SUB, {
		allMids: (msg) => {
			const mids = msg.data?.mids
			if (!mids) return
			latestMidsRef.current = mids
		}
	})

	useEffect(() => {
		const track = trackRef.current
		if (!track) return

		offsetRef.current = 0
		lastTsRef.current = null
		track.style.transform = 'translate3d(0,0,0)'

		const measure = () => {
			const w = track.scrollWidth / 2
			if (w > 0) halfWidthRef.current = w
		}

		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(track)

		const tick = (ts: number) => {
			const mids = latestMidsRef.current
			if (mids) {
				latestMidsRef.current = null
				const prev = prevPrices.current
				for (const coin of coins) {
					if (!mids[coin]) continue
					const pEls = priceEls.current.get(coin)
					if (!pEls) continue

					const price = parseFloat(mids[coin])
					const formatted = formatUsd(price, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					}) as string
					for (const el of pEls) el.textContent = formatted

					if (!prev[coin] || mids[coin] === prev[coin]) continue
					const flashColor = price > parseFloat(prev[coin]) ? '#4ade80' : '#f87171'
					const iEls = itemEls.current.get(coin)
					if (!iEls) continue
					for (const el of iEls) el.style.color = flashColor
					clearTimeout(flashTimers.current[coin])
					flashTimers.current[coin] = setTimeout(() => {
						for (const el of iEls) el.style.color = ''
					}, 700)
				}
				prevPrices.current = mids
			}

			if (lastTsRef.current == null) lastTsRef.current = ts
			const dt = (ts - lastTsRef.current) / 1000
			lastTsRef.current = ts

			const hw = halfWidthRef.current
			if (hw > 0) {
				offsetRef.current = (offsetRef.current + dt * TICKER_SPEED_PX_PER_SEC) % hw
				track.style.transform = `translate3d(${-offsetRef.current}px,0,0)`
			}

			rafRef.current = requestAnimationFrame(tick)
		}

		rafRef.current = requestAnimationFrame(tick)

		return () => {
			ro.disconnect()
			cancelAnimationFrame(rafRef.current)
			for (const timer of Object.values(flashTimers.current)) clearTimeout(timer)
			flashTimers.current = {}
			lastTsRef.current = null
		}
	}, [coins])

	return (
		<div className="overflow-hidden rounded-lg border border-subtle bg-surface">
			<div className="relative h-10 overflow-hidden">
				<div
					ref={trackRef}
					className="absolute top-0 left-0 inline-flex h-10 transform-gpu items-center will-change-transform [backface-visibility:hidden]"
				>
					{coins.map((c, i) => renderItem(c, i))}
					{coins.map((c, i) => renderItem(c, coins.length + i))}
				</div>
			</div>
		</div>
	)
}

function FundingChart({ data }: { data: Array<{ name: string; value: number }> }) {
	if (data.length === 0) return null

	const sorted = data.toSorted((a, b) => b.value - a.value)
	const height = `${Math.max(300, data.length * 28)}px`

	return (
		<ChartPanel>
			<ChartPanelToolbar leading={<ChartPanelTitle>Funding Rates (Annualized) — Top 20 by OI</ChartPanelTitle>} />
			<Suspense fallback={<ChartPanelBodyLoading style={{ minHeight: height }} />}>
				<HBarChart
					categories={sorted.map((d) => d.name)}
					values={sorted.map((d) => d.value)}
					colors={sorted.map((d) => (d.value >= 0 ? FUNDING_UP_COLOR : FUNDING_DOWN_COLOR))}
					valueSymbol="%"
					height={height}
				/>
			</Suspense>
		</ChartPanel>
	)
}

function Pagination<Row>({ table }: { table: TableInstance<typeof tableFeaturesConfig, Row> }) {
	const { pageIndex, pageSize } = useSelector(table.atoms.pagination)
	const total = table.getFilteredRowModel().rows.length
	const from = total === 0 ? 0 : pageIndex * pageSize + 1
	const to = Math.min((pageIndex + 1) * pageSize, total)

	return (
		<TablePager
			pageIndex={pageIndex}
			pageCount={table.getPageCount()}
			onPageChange={(index) => table.setPageIndex(index)}
			range={{ from, to, total }}
			className="pt-3"
		/>
	)
}

const perpColumns: Array<ColumnDef<typeof tableFeaturesConfig, PerpMarket>> = [
	{
		header: 'Asset',
		accessorKey: 'name',
		cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
		size: 100
	},
	{
		header: 'Price',
		id: 'markPx',
		accessorFn: (row) => row.markPx ?? undefined,
		cell: ({ getValue }) =>
			formatUsd(getValue<number>(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' as const },
		size: 120
	},
	{
		header: 'Oracle',
		id: 'oraclePx',
		accessorFn: (row) => row.oraclePx ?? undefined,
		cell: ({ getValue }) => {
			const value = getValue<number | undefined>()
			return value
				? formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: '—'
		},
		meta: { align: 'end' as const },
		size: 120
	},
	{
		header: 'Basis',
		id: 'basis',
		accessorFn: (row) => {
			if (!row.oraclePx) return undefined
			return ((row.markPx - row.oraclePx) / row.oraclePx) * 100
		},
		cell: ({ getValue }) => {
			const v = getValue<number | null>()
			if (v == null) return '—'
			const color = v > 0 ? 'text-success' : v < 0 ? 'text-error' : ''
			return <span className={color}>{formatPct(v)}</span>
		},
		meta: { align: 'end' as const },
		size: 110
	},
	{
		header: 'Premium',
		id: 'premium',
		accessorFn: (row) => row.premium ?? undefined,
		cell: ({ getValue }) => {
			const v = getValue<number | null | undefined>()
			if (v == null) return '—'
			const pct = v * 100
			const color = pct > 0 ? 'text-success' : pct < 0 ? 'text-error' : ''
			return <span className={color}>{formatPct(pct)}</span>
		},
		meta: { align: 'end' as const },
		size: 110
	},
	{
		header: '24h Volume',
		id: 'dayNtlVlm',
		accessorFn: (row) => row.dayNtlVlm ?? undefined,
		cell: ({ getValue }) =>
			formatUsd(getValue<number>(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' as const },
		size: 140
	},
	{
		header: 'Open Interest',
		id: 'openInterest',
		accessorFn: (row) => row.openInterest ?? undefined,
		cell: ({ getValue }) =>
			formatUsd(getValue<number>(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' as const },
		size: 140
	},
	{
		header: 'Funding (ann.)',
		id: 'fundingAnnualized',
		accessorFn: (row) => row.fundingAnnualized ?? undefined,
		cell: ({ getValue }) => {
			const v = getValue<number>()
			const color = v > 0 ? 'text-success' : v < 0 ? 'text-error' : ''
			return <span className={color}>{formatPct(v)}</span>
		},
		meta: { align: 'end' as const },
		size: 130
	}
]

const spotColumns: Array<ColumnDef<typeof tableFeaturesConfig, SpotMarket>> = [
	{
		header: 'Pair',
		accessorKey: 'name',
		cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
		size: 140
	},
	{
		header: 'Price',
		id: 'markPx',
		accessorFn: (row) => row.markPx ?? undefined,
		cell: ({ getValue }) =>
			formatUsd(getValue<number>(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' as const },
		size: 120
	},
	{
		header: '24h Volume',
		id: 'dayNtlVlm',
		accessorFn: (row) => row.dayNtlVlm ?? undefined,
		cell: ({ getValue }) =>
			formatUsd(getValue<number>(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: { align: 'end' as const },
		size: 140
	},
	{
		header: '24h Change',
		id: 'change24hPct',
		accessorFn: (row) => row.change24hPct ?? undefined,
		cell: ({ getValue }) => {
			const v = getValue<number>()
			const color = v > 0 ? 'text-success' : v < 0 ? 'text-error' : ''
			return <span className={color}>{formatPct(v)}</span>
		},
		meta: { align: 'end' as const },
		size: 110
	}
]

const predictedFundingColumns: Array<ColumnDef<typeof tableFeaturesConfig, PredictedFunding>> = [
	{
		header: 'Coin',
		accessorKey: 'coin',
		cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
		size: 100
	},
	{
		header: 'HL Predicted',
		id: 'hlRate',
		accessorFn: (row) => row.hlRate ?? undefined,
		cell: ({ getValue }) => {
			const v = getValue<number | null>()
			if (v == null) return '—'
			const color = v > 0 ? 'text-success' : v < 0 ? 'text-error' : ''
			return <span className={color}>{formatPct(v)}</span>
		},
		meta: { align: 'end' as const },
		size: 120
	},
	{
		header: 'Spread (HL − Best CEX)',
		id: 'spreadToBestCex',
		accessorFn: (row) => row.spreadToBestCex ?? undefined,
		cell: ({ getValue }) => {
			const v = getValue<number | null>()
			if (v == null) return '—'
			const color = v > 0 ? 'text-success' : v < 0 ? 'text-error' : ''
			return <span className={color}>{formatPct(v)}</span>
		},
		meta: { align: 'end' as const },
		size: 170
	},
	{
		header: 'Binance',
		id: 'binanceRate',
		accessorFn: (row) => row.binanceRate ?? undefined,
		cell: ({ getValue }) => {
			const v = getValue<number | null>()
			if (v == null) return '—'
			const color = v > 0 ? 'text-success' : v < 0 ? 'text-error' : ''
			return <span className={color}>{formatPct(v)}</span>
		},
		meta: { align: 'end' as const },
		size: 110
	},
	{
		header: 'Bybit',
		id: 'bybitRate',
		accessorFn: (row) => row.bybitRate ?? undefined,
		cell: ({ getValue }) => {
			const v = getValue<number | null>()
			if (v == null) return '—'
			const color = v > 0 ? 'text-success' : v < 0 ? 'text-error' : ''
			return <span className={color}>{formatPct(v)}</span>
		},
		meta: { align: 'end' as const },
		size: 110
	},
	{
		header: 'Next Funding',
		id: 'nextFundingTime',
		accessorFn: (row) => row.nextFundingTime ?? undefined,
		cell: ({ getValue }) => formatTimestamp(getValue<number | null>()),
		size: 180
	}
]

function OIDistributionChart({ data }: { data: Array<{ name: string; value: number }> }) {
	if (data.length === 0) return null

	const stackColors: Record<string, string> = {}
	for (let index = 0; index < data.length; index++) stackColors[data[index].name] = OI_COLORS[index % OI_COLORS.length]

	return (
		<ChartPanel>
			<ChartPanelToolbar leading={<ChartPanelTitle>Open Interest Distribution</ChartPanelTitle>} />
			{/* A side tile beside the scatter, so the donut keeps its own height rather than the 360 body floor. */}
			<Suspense fallback={<ChartPanelBodyLoading className="min-h-[400px]" />}>
				<PieChart chartData={data} stackColors={stackColors} radius={['45%', '70%']} height="400px" />
			</Suspense>
		</ChartPanel>
	)
}

// Bubble size and colour both encode the market's annualized funding, so the funding rides
// along as the fourth value for the tooltip.
function VolumeOIScatter({ data }: { data: Array<PerpMarket> }) {
	const points: Array<ScatterChartPoint> = []
	for (const market of data) {
		if (!(market.dayNtlVlm > 0 && market.openInterest > 0)) continue
		const positive = market.fundingAnnualized >= 0
		points.push({
			value: [market.dayNtlVlm, market.openInterest, market.name, market.fundingAnnualized],
			seriesName: positive ? 'Positive funding' : 'Negative funding',
			groupColor: positive ? FUNDING_UP_COLOR : FUNDING_DOWN_COLOR,
			symbolSize: Math.max(6, Math.min(24, Math.abs(market.fundingAnnualized) * 2))
		})
	}
	if (points.length === 0) return null

	return (
		<ChartPanel>
			<ChartPanelToolbar
				leading={<ChartPanelTitle>Volume vs Open Interest (bubble size = funding magnitude)</ChartPanelTitle>}
			/>
			<ChartPanelBody>
				<Suspense fallback={<ChartPanelBodyLoading />}>
					<ScatterChart
						chartData={points}
						xAxisLabel="24h Volume ($)"
						yAxisLabel="Open Interest ($)"
						valueSymbol="$"
						logScale
						containerClassName={CHART_FILL}
						tooltipFormatter={({ value: [volume, openInterest, name, funding] }) =>
							`<b>${escapeHtml(String(name))}</b><br/>Volume: ${formatUsd(volume, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}<br/>OI: ${formatUsd(openInterest, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}<br/>Funding: ${formatPct(Number(funding))}`
						}
					/>
				</Suspense>
			</ChartPanelBody>
		</ChartPanel>
	)
}

function PredictedFundingTable({ data }: { data: Array<PredictedFunding> }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'spreadToBestCex', desc: true }])
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE })

	const instance = useTable({
		features: tableFeaturesConfig,
		defaultColumn: { sortUndefined: 'last' },
		data,
		columns: predictedFundingColumns,
		state: { sorting, pagination },
		onSortingChange: setSorting,
		onPaginationChange: setPagination
	})

	if (data.length === 0) return null

	return (
		<div className="rounded-lg border border-subtle bg-surface p-4">
			<h3 className="mb-3 label-md text-secondary">Predicted Funding Rates (Annualized) — HL vs CEXs</h3>
			<Table table={instance} />
			<Pagination table={instance} />
		</div>
	)
}

function PerpsTable({ data }: { data: Array<PerpMarket> }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'dayNtlVlm', desc: true }])
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE })

	const instance = useTable({
		features: tableFeaturesConfig,
		defaultColumn: { sortUndefined: 'last' },
		data,
		columns: perpColumns,
		state: { sorting, pagination },
		onSortingChange: setSorting,
		onPaginationChange: setPagination
	})

	return (
		<div className="rounded-lg border border-subtle bg-surface p-4">
			<h3 className="mb-3 label-md text-secondary">Perpetual Markets</h3>
			<Table table={instance} />
			<Pagination table={instance} />
		</div>
	)
}

function SpotTable({ data }: { data: Array<SpotMarket> }) {
	const [sorting, setSorting] = useState<SortingState>([{ id: 'dayNtlVlm', desc: true }])
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE })

	const instance = useTable({
		features: tableFeaturesConfig,
		defaultColumn: { sortUndefined: 'last' },
		data,
		columns: spotColumns,
		state: { sorting, pagination },
		onSortingChange: setSorting,
		onPaginationChange: setPagination
	})

	return (
		<div className="rounded-lg border border-subtle bg-surface p-4">
			<h3 className="mb-3 label-md text-secondary">Spot Markets</h3>
			<Table table={instance} />
			<Pagination table={instance} />
		</div>
	)
}

export default function Stats() {
	const perpsQuery = useHyperliquidPerps()
	const spotQuery = useHyperliquidSpot()
	const perps = perpsQuery.markets
	const spot = spotQuery.markets
	const { fundings, isLoading: fundingsLoading } = useHyperliquidPredictedFundings()

	const marketPresentation = useMemo(() => {
		const byOpenInterest = perps.toSorted((a, b) => b.openInterest - a.openInterest)
		const fundingChartData: Array<{ name: string; value: number }> = []
		const oiDistributionData: Array<{ name: string; value: number }> = []
		let totalVolume = 0
		let totalOI = 0
		let otherOI = 0
		for (let index = 0; index < byOpenInterest.length; index++) {
			const market = byOpenInterest[index]
			totalVolume += market.dayNtlVlm
			totalOI += market.openInterest
			if (index < 20) fundingChartData.push({ name: market.name, value: market.fundingAnnualized })
			if (index < 10) oiDistributionData.push({ name: market.name, value: market.openInterest })
			else otherOI += market.openInterest
		}
		if (otherOI > 0) oiDistributionData.push({ name: 'Other', value: otherOI })
		return {
			totalVolume: formatUsd(totalVolume, {
				compact: true,
				minimumCompactValue: 1_000_000,
				compactSuffix: 'lowercase'
			}),
			totalOI: formatUsd(totalOI, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
			fundingChartData,
			oiDistributionData
		}
	}, [perps])

	const topCoins = useMemo(
		() =>
			perps
				.toSorted((a, b) => b.dayNtlVlm - a.dayNtlVlm)
				.slice(0, 20)
				.map((market) => market.name),
		[perps]
	)

	// Without this, a failed read would draw its empty fallback as real zeros: $0 volume, 0 markets.
	const failedRead = mergeFailedReads([
		queryReadFailed(perpsQuery) ? perpsQuery : null,
		queryReadFailed(spotQuery) ? spotQuery : null
	])
	if (failedRead) {
		return (
			<PanelStatus variant="error" retry={failedRead}>
				Couldn&apos;t load Hyperliquid market stats.
			</PanelStatus>
		)
	}
	if (perpsQuery.isLoading || spotQuery.isLoading) return <PanelLoadingStatus label="Loading market stats" />

	return (
		<div className="flex flex-col gap-4">
			{topCoins.length > 0 ? <PriceTickerTape coins={topCoins} /> : null}

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<StatTile label="24h Perp Volume" value={marketPresentation.totalVolume} />
				<StatTile label="Total Open Interest" value={marketPresentation.totalOI} />
				<StatTile label="Perp Markets" value={perps.length} />
				<StatTile label="Spot Markets" value={spot.length} />
			</div>
			<FundingChart data={marketPresentation.fundingChartData} />
			{!fundingsLoading ? <PredictedFundingTable data={fundings} /> : null}

			<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
				<OIDistributionChart data={marketPresentation.oiDistributionData} />
				<VolumeOIScatter data={perps} />
			</div>

			<PerpsTable data={perps} />
			<SpotTable data={spot} />
		</div>
	)
}
