import type * as echarts from 'echarts/core'
import { lazy, Suspense, useRef, useState } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { ChartGroupingSelector, type ChartGroupingOption } from '~/components/ECharts/shared/ChartGroupingSelector'
import { formatTooltipChartDate } from '~/components/ECharts/shared/formatters'
import {
	getPointedSeriesName,
	getTooltipAxisValue,
	TOOLTIP_POINTED_ROW_STYLE
} from '~/components/ECharts/shared/tooltip'
import { Select } from '~/components/Select/Select'
import {
	TokenPageTable,
	TokenPageTableBodyCell,
	TokenPageTableHeaderCell,
	TokenPageTableScroller
} from '~/components/Table/helpers'
import { SortIcon } from '~/components/Table/SortIcon'
import { OTHERS_COLOR } from '~/constants/colors'
import { useDarkModeManager } from '~/contexts/LocalStorage'
import { Change } from '~/ui/Change'
import {
	CHART_FILL,
	ChartPanel,
	ChartPanelBody,
	ChartPanelBodyError,
	ChartPanelBodyFallback,
	ChartPanelBodyLoading,
	ChartPanelToolbar
} from '~/ui/ChartPanel'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { TableToolbar } from '~/ui/Toolbar'
import {
	formatCompactNumber,
	formatPercent,
	formatUsd,
	roundNumber,
	USD_LOWERCASE_MILLIONS_OPTIONS
} from '~/utils/numberFormat'
import type { QueryRetry } from '~/utils/query'
import { InstantTooltip } from '../InstantTooltip'
import { YIELD_PERCENT_OPTIONS } from '../poolDetail/format'
import { ProtocolIcon } from '../poolDetail/Icons'
import { getChartTooltipItems, getChartTooltipValue } from '../poolDetail/tooltip'
import { useWidestHistory } from '../poolDetail/useWidestHistory'
import { YieldsTabs } from '../YieldsTabs'
import {
	fetchStablecoinRatesHistory,
	type RateRange,
	type RefRateAssetSet,
	type RefRateProtocol,
	type RefRatePoint,
	type RefRateSet,
	type StablecoinRatesCurrent,
	type StablecoinRatesHistory
} from './fetch'
import { buildRatesChart } from './ratesChart'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart')) as React.FC<IMultiSeriesChartProps>

type SortDir = 'asc' | 'desc'
type SortKey = 'supply' | 'borrow' | 'spread' | 'markets'
type CompSortKey = 'sup_apy' | 'sup_wt' | 'bor_apy' | 'bor_wt'

interface CompRow {
	slug: string
	name: string
	supply: RefRateProtocol | null
	borrow: RefRateProtocol | null
}

function spreadPct(value: number | null): { text: string; neg: boolean } {
	if (value == null) return { text: '—', neg: false }
	return { text: `${value < 0 ? '−' : '+'}${formatPercent(Math.abs(value), YIELD_PERCENT_OPTIONS)}`, neg: value < 0 }
}
function weightPct(fraction: number | null): string {
	if (fraction == null) return '—'
	const p = fraction * 100
	if (p <= 0) return '0%'
	if (p < 0.1) return '<0.1%'
	if (p < 1)
		return `${formatPercent(p, { input: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false })}`
	return formatPercent(p, { input: 'percent', maximumFractionDigits: 0 })
}

function ratesForAsset(current: StablecoinRatesCurrent, asset: string): RefRateSet {
	if (asset === 'all') return current.rates
	return current.by_asset.find((b) => b.asset.toLowerCase() === asset)?.rates ?? current.rates
}
function seriesForAsset(history: StablecoinRatesHistory, asset: string): Array<RefRatePoint> {
	if (asset === 'all') return history.series
	return history.by_asset.find((b) => b.asset.toLowerCase() === asset)?.series ?? history.series
}
function compositionForAsset(current: StablecoinRatesCurrent, asset: string) {
	if (asset === 'all') return current.composition.by_protocol
	return (
		current.composition.by_asset.find((b) => b.asset.toLowerCase() === asset)?.by_protocol ??
		current.composition.by_protocol
	)
}

const RATES_ORDER: Record<string, number> = { Supply: 0, Borrow: 1, Spread: 2 }

function ratesTooltipFormatter(params: unknown): string {
	const items = getChartTooltipItems(params)
	if (items.length === 0) return ''
	const first = items[0]!
	const ts = getTooltipAxisValue(first)
	const date = Number.isFinite(ts) ? formatTooltipChartDate(ts, 'daily') : ''
	const sorted = [...items].sort((a, b) => (RATES_ORDER[a.seriesName] ?? 9) - (RATES_ORDER[b.seriesName] ?? 9))
	const pointedName = getPointedSeriesName(items)
	let pointedRow = ''
	let rows = ''
	for (const p of sorted) {
		const raw = getChartTooltipValue(p)
		const v = typeof raw === 'number' ? raw : raw == null ? null : Number(raw)
		if (v == null || !Number.isFinite(v)) continue
		const row = `${p.marker} ${p.seriesName}: ${formatPercent(v, YIELD_PERCENT_OPTIONS) ?? '—'}`
		if (p.seriesName === pointedName) pointedRow = `<li style="${TOOLTIP_POINTED_ROW_STYLE}">${row}</li>`
		else rows += `<li style="list-style:none;">${row}</li>`
	}
	return date + pointedRow + rows
}

const RATES_CHART_OPTIONS = { tooltip: { formatter: ratesTooltipFormatter } }

function RatesChart({
	points,
	onReady
}: {
	points: Array<RefRatePoint>
	onReady?: (inst: echarts.ECharts | null) => void
}) {
	const [isDark] = useDarkModeManager()
	const spec = buildRatesChart(points, isDark)
	if (!spec) {
		return (
			<ChartPanelBodyFallback role="status" className="body-sm text-tertiary">
				No rate history is available.
			</ChartPanelBodyFallback>
		)
	}
	return (
		<Suspense fallback={<ChartPanelBodyLoading label="Loading rates chart" />}>
			<MultiSeriesChart
				dataset={spec.dataset}
				charts={spec.charts}
				chartOptions={RATES_CHART_OPTIONS}
				valueSymbol="%"
				containerClassName={CHART_FILL}
				showLegend
				exportButtons="hidden"
				{...(onReady ? { onReady } : {})}
			/>
		</Suspense>
	)
}

function SortTh({ label, active, dir, onSort }: { label: string; active: boolean; dir: SortDir; onSort: () => void }) {
	return (
		<TokenPageTableHeaderCell
			textAlign="end"
			aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
		>
			<button type="button" className="ml-auto flex items-center gap-1 whitespace-nowrap" onClick={onSort}>
				<span className="whitespace-nowrap">{label}</span>
				<SortIcon dir={active ? dir : false} />
			</button>
		</TokenPageTableHeaderCell>
	)
}

function BenchmarkMetric({
	label,
	value,
	delta,
	markerColor
}: {
	label: string
	value: number | null
	delta: number | null
	markerColor: string
}) {
	return (
		<div className="flex items-center gap-1.5 whitespace-nowrap">
			<dt className="flex items-center gap-1 body-sm text-secondary">
				<span className="size-1.5 rounded-full" style={{ backgroundColor: markerColor }} aria-hidden />
				{label}
			</dt>
			<dd className="-translate-y-px mono-md-bold text-primary">
				{formatPercent(value, YIELD_PERCENT_OPTIONS) ?? '—'}
			</dd>
			{delta != null ? (
				<dd className="flex items-center gap-1 body-sm text-secondary tabular-nums">
					{/* Rounded to the shown precision, so a move under 0.005pp reads flat instead of a coloured 0.00pp. */}
					<Change value={roundNumber(delta, 2)} unit="pp" />
					<span className="text-tertiary">vs 7d ago</span>
				</dd>
			) : null}
		</div>
	)
}

const RANGE_OPTIONS = [
	{ value: '30d', label: '', shortLabel: '30d' },
	{ value: '90d', label: '', shortLabel: '90d' },
	{ value: 'max', label: '', shortLabel: 'Max' }
] as const satisfies ReadonlyArray<ChartGroupingOption<RateRange>>

function ReferenceRatesSummary({
	rates,
	delta,
	asset,
	assetOptions,
	onAssetChange,
	range,
	onRangeChange,
	loading,
	failedRead,
	points
}: {
	rates: RefRateSet
	delta: { supply: number; borrow: number | null; spread: number | null } | null
	asset: string
	assetOptions: Array<ChartGroupingOption<string>>
	onAssetChange: (asset: string) => void
	range: RateRange
	onRangeChange: (range: RateRange) => void
	loading: boolean
	failedRead: QueryRetry | null
	points: Array<RefRatePoint>
}) {
	const chartRef = useRef<echarts.ECharts | null>(null)
	return (
		<ChartPanel role="region" aria-labelledby="reference-rates-title">
			<PanelHeader className="items-start">
				<div className="mr-auto flex min-w-0 flex-col gap-0.5">
					<PanelTitle as="h1" id="reference-rates-title">
						Stablecoin Reference Rates
					</PanelTitle>
					<p className="max-w-3xl body-sm text-secondary">
						Market-size weighted base rates for major stablecoins across the largest EVM lending markets. Rewards APY is
						excluded.
					</p>
				</div>
			</PanelHeader>
			<TableToolbar className="border-b border-subtle">
				<dl className="grid flex-1 grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
					<BenchmarkMetric
						label="Supply APY"
						value={rates.supply.apy}
						delta={delta?.supply ?? null}
						markerColor="var(--apy-mid)"
					/>
					<BenchmarkMetric
						label="Borrow APY"
						value={rates.borrow.apy}
						delta={delta?.borrow ?? null}
						markerColor="var(--apy-very)"
					/>
					<BenchmarkMetric
						label="Spread"
						value={rates.spread.apy}
						delta={delta?.spread ?? null}
						markerColor={OTHERS_COLOR}
					/>
				</dl>
			</TableToolbar>
			<ChartPanelToolbar
				leading={<ChartGroupingSelector value={asset} options={assetOptions} onValueChange={onAssetChange} />}
			>
				<ChartGroupingSelector value={range} options={RANGE_OPTIONS} onValueChange={onRangeChange} />
				<ChartExportButtons
					chartInstance={() => chartRef.current}
					filename={`stablecoin-rates-${asset}`}
					csvSource="rendered-chart"
				/>
			</ChartPanelToolbar>
			<ChartPanelBody>
				{failedRead ? (
					<ChartPanelBodyError retry={failedRead}>Couldn&apos;t load {range} history.</ChartPanelBodyError>
				) : loading ? (
					<ChartPanelBodyLoading label={`Loading ${range} history`} />
				) : (
					<RatesChart
						points={points}
						onReady={(instance) => {
							chartRef.current = instance
						}}
					/>
				)}
			</ChartPanelBody>
		</ChartPanel>
	)
}

function RatesByAssetPanel({
	rows,
	sortKey,
	sortDir,
	onSort
}: {
	rows: StablecoinRatesCurrent['by_asset']
	sortKey: SortKey
	sortDir: SortDir
	onSort: (key: SortKey) => void
}) {
	return (
		<Panel padding="none" role="region" aria-labelledby="rates-by-asset">
			<TableToolbar className="min-h-10 border-b border-subtle">
				<h2 id="rates-by-asset" className="mr-auto label-md text-primary">
					By asset
				</h2>
			</TableToolbar>
			<TokenPageTableScroller>
				<TokenPageTable className="min-w-[640px]">
					<thead>
						<tr className="border-b border-subtle bg-surface">
							<TokenPageTableHeaderCell>Asset</TokenPageTableHeaderCell>
							<SortTh label="Supply APY" active={sortKey === 'supply'} dir={sortDir} onSort={() => onSort('supply')} />
							<SortTh label="Borrow APY" active={sortKey === 'borrow'} dir={sortDir} onSort={() => onSort('borrow')} />
							<SortTh label="Spread" active={sortKey === 'spread'} dir={sortDir} onSort={() => onSort('spread')} />
							<SortTh label="Markets" active={sortKey === 'markets'} dir={sortDir} onSort={() => onSort('markets')} />
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<AssetRow key={row.asset} name={row.asset} rates={row.rates} />
						))}
					</tbody>
				</TokenPageTable>
			</TokenPageTableScroller>
		</Panel>
	)
}

function RatesByProtocolPanel({
	assetValues,
	asset,
	onAssetChange,
	rows,
	sortKey,
	sortDir,
	onSort
}: {
	assetValues: Array<string>
	asset: string
	onAssetChange: (asset: string) => void
	rows: Array<CompRow>
	sortKey: CompSortKey
	sortDir: SortDir
	onSort: (key: CompSortKey) => void
}) {
	return (
		<Panel padding="none" role="region" aria-labelledby="rates-by-protocol">
			<TableToolbar className="min-h-10 border-b border-subtle">
				<h2 id="rates-by-protocol" className="mr-auto label-md text-primary">
					By protocol
				</h2>
				<Select
					size="sm"
					allValues={assetValues}
					selectedValues={asset}
					setSelectedValues={onAssetChange}
					label="Asset"
					labelType="regular"
					variant="filter"
				/>
			</TableToolbar>
			<TokenPageTableScroller>
				<TokenPageTable className="min-w-[640px]">
					<thead>
						<tr className="border-b border-subtle bg-surface">
							<TokenPageTableHeaderCell>Protocol</TokenPageTableHeaderCell>
							<SortTh
								label="Supply APY"
								active={sortKey === 'sup_apy'}
								dir={sortDir}
								onSort={() => onSort('sup_apy')}
							/>
							<SortTh
								label="Supply weight"
								active={sortKey === 'sup_wt'}
								dir={sortDir}
								onSort={() => onSort('sup_wt')}
							/>
							<SortTh
								label="Borrow APY"
								active={sortKey === 'bor_apy'}
								dir={sortDir}
								onSort={() => onSort('bor_apy')}
							/>
							<SortTh
								label="Borrow weight"
								active={sortKey === 'bor_wt'}
								dir={sortDir}
								onSort={() => onSort('bor_wt')}
							/>
						</tr>
					</thead>
					<tbody>
						{rows.map((protocol) => (
							<tr key={protocol.slug} className="border-b border-subtle last:border-b-0">
								<TokenPageTableBodyCell>
									<span className="flex items-center gap-2 text-primary">
										<ProtocolIcon slug={protocol.slug} name={protocol.name} size={22} />
										{protocol.name}
									</span>
								</TokenPageTableBodyCell>
								<TokenPageTableBodyCell textAlign="end" className="text-primary">
									{protocol.supply ? (formatPercent(protocol.supply.apy, YIELD_PERCENT_OPTIONS) ?? '—') : '—'}
								</TokenPageTableBodyCell>
								<TokenPageTableBodyCell textAlign="end" className="text-primary">
									{protocol.supply ? (
										<InstantTooltip
											content={`${formatUsd(protocol.supply.weight_usd, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '—'} weighted`}
											className="justify-end"
										>
											{weightPct(protocol.supply.weight_pct)}
										</InstantTooltip>
									) : (
										'—'
									)}
								</TokenPageTableBodyCell>
								<TokenPageTableBodyCell textAlign="end" className="text-primary">
									{protocol.borrow ? (formatPercent(protocol.borrow.apy, YIELD_PERCENT_OPTIONS) ?? '—') : '—'}
								</TokenPageTableBodyCell>
								<TokenPageTableBodyCell textAlign="end" className="text-primary">
									{protocol.borrow ? (
										<InstantTooltip
											content={`${formatUsd(protocol.borrow.weight_usd, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '—'} weighted`}
											className="justify-end"
										>
											{weightPct(protocol.borrow.weight_pct)}
										</InstantTooltip>
									) : (
										'—'
									)}
								</TokenPageTableBodyCell>
							</tr>
						))}
					</tbody>
				</TokenPageTable>
			</TokenPageTableScroller>
		</Panel>
	)
}

export function ReferenceRates({
	current,
	initialHistory,
	initialRange = '90d'
}: {
	current: StablecoinRatesCurrent
	initialHistory: StablecoinRatesHistory
	initialRange?: RateRange
}) {
	const [asset, setAsset] = useState('all')
	const [sortKey, setSortKey] = useState<SortKey>('spread')
	const [sortDir, setSortDir] = useState<SortDir>('desc')
	const [compAsset, setCompAsset] = useState('All')
	const [compSort, setCompSort] = useState<CompSortKey>('sup_wt')
	const [compDir, setCompDir] = useState<SortDir>('desc')
	const [range, setRange] = useState<RateRange>(initialRange)
	const {
		model: history,
		loading,
		failedRead
	} = useWidestHistory(initialRange, initialHistory, range, fetchStablecoinRatesHistory)

	function changeRange(next: RateRange) {
		setRange(next)
		if (typeof window !== 'undefined') {
			const url = new URL(window.location.href)
			if (next === 'max') url.searchParams.delete('range')
			else url.searchParams.set('range', next)
			window.history.replaceState(null, '', `${url.pathname}${url.search}`)
		}
	}

	const assetOptions: Array<ChartGroupingOption<string>> = [
		{ value: 'all', label: '', shortLabel: 'All' },
		...current.assets.map((a) => ({ value: a.toLowerCase(), label: '', shortLabel: a }))
	]
	const compAssetValues = ['All', ...current.assets]

	const rates = ratesForAsset(current, asset)
	const fullPoints = seriesForAsset(history, asset)
	const points = range === 'max' ? fullPoints : fullPoints.slice(range === '30d' ? -30 : -90)

	const delta = (() => {
		const s = seriesForAsset(history, asset)
		const n = s.length
		if (n < 8) return null
		const a = s[n - 1]!.rates
		const b = s[n - 8]!.rates
		if (a.supply.apy == null || b.supply.apy == null) return null
		return {
			supply: a.supply.apy - b.supply.apy,
			borrow: a.borrow.apy != null && b.borrow.apy != null ? a.borrow.apy - b.borrow.apy : null,
			spread: a.spread.apy != null && b.spread.apy != null ? a.spread.apy - b.spread.apy : null
		}
	})()

	function sortBy(key: SortKey) {
		if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
		else {
			setSortKey(key)
			setSortDir('desc')
		}
	}

	const sortedAssets = (() => {
		const rows = [...current.by_asset]
		const dir = sortDir === 'asc' ? 1 : -1
		const val = (r: (typeof rows)[number]) =>
			sortKey === 'markets' ? (r.rates.supply.market_count ?? -Infinity) : (r.rates[sortKey].apy ?? -Infinity)
		rows.sort((a, b) => (val(a) - val(b)) * dir)
		return rows
	})()

	const compRows = (() => {
		const sides = compositionForAsset(current, compAsset.toLowerCase())
		const map = new Map<string, CompRow>()
		for (const r of sides.supply) {
			const { slug, name } = r.protocol
			map.set(slug, { slug, name, supply: r, borrow: null })
		}
		for (const r of sides.borrow) {
			const { slug, name } = r.protocol
			const e = map.get(slug)
			if (e) e.borrow = r
			else map.set(slug, { slug, name, supply: null, borrow: r })
		}
		const pick = (row: CompRow): number | null => {
			switch (compSort) {
				case 'sup_apy':
					return row.supply?.apy ?? null
				case 'sup_wt':
					return row.supply?.weight_pct ?? null
				case 'bor_apy':
					return row.borrow?.apy ?? null
				case 'bor_wt':
					return row.borrow?.weight_pct ?? null
			}
		}
		const dir = compDir === 'asc' ? 1 : -1
		return [...map.values()].sort((a, b) => {
			const av = pick(a)
			const bv = pick(b)
			if (av == null && bv == null) return 0
			if (av == null) return 1
			if (bv == null) return -1
			return (av - bv) * dir
		})
	})()

	function compSortBy(key: CompSortKey) {
		if (key === compSort) setCompDir((d) => (d === 'asc' ? 'desc' : 'asc'))
		else {
			setCompSort(key)
			setCompDir('desc')
		}
	}

	return (
		<>
			<YieldsTabs active="rates" />

			<ReferenceRatesSummary
				rates={rates}
				delta={delta}
				asset={asset}
				assetOptions={assetOptions}
				onAssetChange={setAsset}
				range={range}
				onRangeChange={changeRange}
				loading={loading}
				failedRead={failedRead}
				points={points}
			/>

			<div className="grid grid-cols-1 gap-2 min-[1340px]:grid-cols-2">
				<RatesByAssetPanel rows={sortedAssets} sortKey={sortKey} sortDir={sortDir} onSort={sortBy} />
				<RatesByProtocolPanel
					assetValues={compAssetValues}
					asset={compAsset}
					onAssetChange={setCompAsset}
					rows={compRows}
					sortKey={compSort}
					sortDir={compDir}
					onSort={compSortBy}
				/>
			</div>
		</>
	)
}

function AssetRow({ name, rates }: { name: string; rates: RefRateAssetSet }) {
	const sp = spreadPct(rates.spread.apy)
	return (
		<tr className="border-b border-subtle last:border-b-0">
			<TokenPageTableBodyCell>
				<span className="text-primary">{name}</span>
			</TokenPageTableBodyCell>
			<TokenPageTableBodyCell textAlign="end" className="text-primary">
				{formatPercent(rates.supply.apy, YIELD_PERCENT_OPTIONS) ?? '—'}
			</TokenPageTableBodyCell>
			<TokenPageTableBodyCell textAlign="end" className="text-primary">
				{formatPercent(rates.borrow.apy, YIELD_PERCENT_OPTIONS) ?? '—'}
			</TokenPageTableBodyCell>
			<TokenPageTableBodyCell textAlign="end" className="text-primary">
				{sp.text}
			</TokenPageTableBodyCell>
			<TokenPageTableBodyCell textAlign="end" className="text-primary">
				{formatCompactNumber(rates.supply.market_count, {
					compactSuffix: 'lowercase',
					...(rates.supply.market_count >= 1e3 ? { minimumFractionDigits: 1, maximumFractionDigits: 1 } : {})
				})}
			</TokenPageTableBodyCell>
		</tr>
	)
}
