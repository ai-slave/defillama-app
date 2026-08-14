import * as React from 'react'
import { formatNumber, formatPercent, formatUsd, roundNumber } from '~/utils/numberFormat'
import type { KpkRef } from './api'
import { KPK_BENCH_BG, KPK_MINT_BG, KPK_MINT_BORDER, KPK_MINT_TEXT } from './chartDefaults'
import { MILLION } from './transform'

/* ──────────────────────────── formatting ──────────────────────────── */

/** Compact USD, KPK's own house style: `$8.03bn`, `$47.27m`. */
export function usd(value: number | null | undefined): string {
	return formatUsd(value, { compact: true, compactSuffix: 'lowercase' }) ?? '—'
}

/** The same, for the upstream fields carried in $m. */
export function usdFromMillions(value: number | null | undefined): string {
	return value == null ? '—' : usd(value * MILLION)
}

export function pct(value: number | null | undefined, decimals = 2): string {
	return (
		formatPercent(value, {
			input: 'percent',
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals,
			useGrouping: false
		}) ?? '—'
	)
}

/** Signed percentage points, for an APY spread over its benchmark. */
export function signedPp(value: number | null | undefined): string {
	if (value == null || !Number.isFinite(value)) return '—'
	return `${value >= 0 ? '+' : '−'}${formatNumber(Math.abs(value), {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
		useGrouping: false
	})} pp`
}

export function signedBps(value: number | null | undefined): string {
	if (value == null || !Number.isFinite(value)) return '—'
	return `${signedInt(value)} bps`
}

/** Bare signed integer, for a column whose header already carries the unit. */
export function signedInt(value: number | null | undefined): string {
	if (value == null || !Number.isFinite(value)) return '—'
	return `${value >= 0 ? '+' : '−'}${formatNumber(Math.abs(value), { maximumFractionDigits: 0 })}`
}

/** A gain is KPK's own performance, so it wears mint rather than the generic success green. */
export const signClass = (value: number | null | undefined) =>
	value == null ? 'text-pro-text-secondary' : value >= 0 ? KPK_MINT_TEXT : 'text-error'

/* ──────────────────────────── layout ──────────────────────────── */

/**
 * The ledger strip: the tiles that open every tab, in one hairline-divided row —
 * the mockup's signature block. Columns are auto-flowed so three tiles and four
 * both fill the row; it only stacks below the mockup's own 900px breakpoint.
 * Numbers are the hero — large, monospaced, tabular.
 */
export function LedgerStrip({ children }: { children: React.ReactNode }) {
	return (
		<div className="grid grid-cols-1 overflow-hidden rounded-lg border border-pro-cards-border bg-pro-cards-bg sm:grid-cols-2 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none">
			{children}
		</div>
	)
}

export function LedgerTile({
	label,
	value,
	suffix,
	sub,
	metric,
	metricLabel,
	children
}: {
	label: string
	value?: string
	/** Rendered small and dim next to the headline, e.g. the `+` in `$8bn+`. */
	suffix?: string
	sub?: string
	metric?: string
	metricLabel?: string
	children?: React.ReactNode
}) {
	return (
		<div className="flex min-w-0 flex-col gap-2 border-t border-pro-cards-border p-5 first:border-t-0 lg:border-t-0 lg:border-l lg:first:border-l-0 sm:[&:nth-child(-n+2)]:border-t-0">
			<span className="label-sm tracking-wider text-pro-text-label uppercase">{label}</span>
			{value == null ? (
				<div className="h-8 w-28 animate-pulse rounded-sm bg-tertiary opacity-20" />
			) : (
				<span className="flex items-baseline gap-1 font-mono text-3xl font-medium tracking-tight text-pro-text-primary tabular-nums">
					{value}
					{suffix && <small className="text-sm font-normal text-pro-text-label">{suffix}</small>}
				</span>
			)}
			{sub && <span className="body-sm text-pro-text-secondary">{sub}</span>}
			{metric && (
				<span className="mt-auto flex items-baseline gap-1.5 border-t border-pro-cards-border pt-2.5 body-sm text-pro-text-secondary">
					<b className="font-mono text-sm font-medium text-pro-text-primary tabular-nums">{metric}</b>
					{metricLabel}
				</span>
			)}
			{children}
		</div>
	)
}

/**
 * Section headings are sentence case at 13px — the mockup reserves uppercase tracking
 * for the small tile and column labels, so a heading set that way reads as a label.
 */
export function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<h2 className="text-sm font-semibold text-pro-text-primary">{title}</h2>
			{children}
		</div>
	)
}

/**
 * `min-w-0` is load-bearing: a flex or grid item's automatic minimum width is its
 * min-content, so without it a card holding a wide `nowrap` table grows to the table's
 * full width, the layout overflows sideways, and the table's own scroll container never
 * engages. The mockup gets this for free — its tables sit in plain block containers.
 */
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
	return (
		<div className={`min-w-0 rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4 ${className}`}>
			{children}
		</div>
	)
}

export function ToggleGroup<T extends string>({
	label,
	options,
	value,
	onChange
}: {
	label: string
	options: ReadonlyArray<{ key: T; label: string }>
	value: T
	onChange: (key: T) => void
}) {
	return (
		// Two steps of neutral elevation, as the mockup has it. The selected chip stays
		// neutral on purpose: mint and periwinkle mean "KPK" and "benchmark" in the data,
		// and a control wearing either would read as a value.
		<div
			role="group"
			aria-label={label}
			className="flex flex-wrap gap-0.5 rounded-lg border border-pro-cards-border bg-surface-elevated-1 p-0.5"
		>
			{options.map((option) => {
				const isActive = option.key === value
				return (
					<button
						key={option.key}
						type="button"
						aria-pressed={isActive}
						onClick={() => onChange(option.key)}
						className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
							isActive
								? 'bg-surface-elevated-2 text-pro-text-primary'
								: 'text-pro-text-secondary hover:text-pro-text-primary'
						}`}
					>
						{option.label}
					</button>
				)
			})}
		</div>
	)
}

/**
 * The upstream `notice` string, verbatim. It names which figures on the tab are
 * not sourced yet, so it must never be paraphrased or suppressed.
 */
export function NoticeBanner({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex items-start gap-2.5 rounded-lg border border-l-[3px] border-pro-cards-border border-l-warning bg-pro-cards-bg p-3 pl-4 text-xs leading-relaxed text-pro-text-secondary">
			<span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
			{children}
		</div>
	)
}

export function RefLinks({ refs }: { refs: KpkRef[] | undefined }) {
	if (!refs?.length) return null
	return (
		<div className="flex flex-wrap gap-2">
			{refs.map((ref) => (
				<a
					key={ref.url + ref.label}
					href={ref.url}
					target="_blank"
					rel="noopener noreferrer"
					className="rounded-md border border-pro-cards-border px-2.5 py-1 label-sm text-pro-text-secondary transition-colors hover:border-sl-accent hover:text-pro-text-primary"
				>
					{ref.label} ↗
				</a>
			))}
		</div>
	)
}

export function Disclaimer({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="border-t border-pro-cards-border pt-4">
			<h3 className="mb-1.5 label-xs tracking-wider text-pro-text-label uppercase">{title}</h3>
			<p className="body-sm text-pro-text-tertiary">{children}</p>
		</div>
	)
}

export function QueryError({ label }: { label: string }) {
	return (
		<Card>
			<p className="text-sm text-pro-text-secondary">{label} data is unavailable right now. Please try again later.</p>
		</Card>
	)
}

/* ──────────────────────────── marks ──────────────────────────── */

/** A 30-point APY history, inline beside the number it belongs to. */
export function Spark({ values, label }: { values: number[] | undefined; label: string }) {
	const points = React.useMemo(() => {
		if (!values || values.length < 2) return ''
		const min = Math.min(...values)
		const max = Math.max(...values)
		const range = max - min
		return values
			.map((value, index) => {
				const x = (index / (values.length - 1)) * 64
				const y = range === 0 ? 9 : 16 - ((value - min) / range) * 14
				return `${roundNumber(x, 1)},${roundNumber(y, 1)}`
			})
			.join(' ')
	}, [values])

	if (!points) return null
	return (
		<svg
			viewBox="0 0 64 18"
			role="img"
			aria-label={label}
			className={`inline-block h-4 w-16 align-middle ${KPK_MINT_TEXT}`}
		>
			<polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.3" vectorEffect="non-scaling-stroke" />
		</svg>
	)
}

/**
 * A percentage against a target. `target` is drawn as a tick, so a bar short of
 * the mark reads as short of the mark rather than merely small.
 */
export function MeterBar({
	value,
	target,
	scale = 100,
	tone = 'accent'
}: {
	value: number | null | undefined
	target?: number
	/** Full-width value. Withdrawal liquidity uses 30 so a 15% target sits mid-bar. */
	scale?: number
	tone?: 'accent' | 'warning'
}) {
	if (value == null) return <span className="text-pro-text-tertiary">—</span>
	const width = Math.min(100, Math.max(0, (value / scale) * 100))
	return (
		<span className="relative inline-block h-1.5 w-20 shrink-0 overflow-hidden rounded-sm bg-pro-cards-border align-middle">
			<span
				className={`block h-full rounded-sm ${tone === 'warning' ? 'bg-warning' : KPK_MINT_BG}`}
				style={{ width: `${width}%` }}
			/>
			{target != null && target < scale && (
				<span
					aria-hidden
					className="absolute top-0 h-full w-px bg-pro-text-secondary"
					style={{ left: `${(target / scale) * 100}%` }}
				/>
			)}
		</span>
	)
}

/**
 * The mockup's two-tone comparison bar: KPK's figure in mint above the benchmark it is
 * measured against in periwinkle, both on one shared scale so the gap between them is
 * the point. Colour alone never carries the reading — the same two numbers sit in the
 * columns to the left.
 */
export function CompareBars({
	value,
	benchmark,
	scale,
	labels
}: {
	value: number | null | undefined
	benchmark: number | null | undefined
	/** Shared full-width value across every row, so bars are comparable down the column. */
	scale: number
	labels: { value: string; benchmark: string }
}) {
	if (value == null || benchmark == null || !(scale > 0)) return null
	const width = (n: number) => `${Math.max(2, Math.min(100, (n / scale) * 100))}%`
	return (
		<span className="flex w-full min-w-[110px] flex-col gap-1" role="img" aria-label={labels.value}>
			<span className={`block h-1.5 rounded-sm ${KPK_MINT_BG}`} style={{ width: width(value) }} />
			<span className={`block h-1.5 rounded-sm ${KPK_BENCH_BG}`} style={{ width: width(benchmark) }} />
			<span className="sr-only">{labels.benchmark}</span>
		</span>
	)
}

export function Chip({ tone, children }: { tone: 'ok' | 'watch' | 'muted'; children: React.ReactNode }) {
	const toneClass =
		tone === 'ok'
			? `${KPK_MINT_BORDER} ${KPK_MINT_TEXT}`
			: tone === 'watch'
				? 'border-warning/40 text-warning'
				: 'border-pro-cards-border text-pro-text-tertiary'
	return (
		<span className={`inline-flex rounded-full border px-2 py-0.5 label-xs whitespace-nowrap ${toneClass}`}>
			{children}
		</span>
	)
}

/** Arrow-out link. Renders nothing when a row has no destination. */
export function RowLink({ href, label }: { href: string | undefined; label: string }) {
	if (!href) return null
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			title={`Open ${label}`}
			aria-label={`Open ${label} in a new tab`}
			className="inline-flex size-6 items-center justify-center rounded-md border border-pro-cards-border text-pro-text-secondary transition-colors hover:border-sl-accent hover:text-sl-accent"
		>
			<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-3" aria-hidden>
				<path d="M3.6 8.4 8.4 3.6" />
				<path d="M4.4 3.6H8.4V7.6" />
			</svg>
		</a>
	)
}

/** Zero funds lost, drawn as one unbroken line with a tick per year. */
export function ContinuityRule({ years }: { years: number[] | undefined }) {
	if (!years?.length) return null
	return (
		<svg
			viewBox="0 0 300 22"
			preserveAspectRatio="none"
			role="img"
			aria-label={`Unbroken since ${years[0]}`}
			className={`h-5 w-full ${KPK_MINT_TEXT}`}
		>
			<line x1="1" x2="299" y1="7" y2="7" stroke="currentColor" strokeWidth="1.5" />
			{years.map((year, index) => (
				<line
					key={year}
					x1={1 + (298 * index) / Math.max(1, years.length - 1)}
					x2={1 + (298 * index) / Math.max(1, years.length - 1)}
					y1="3"
					y2="11"
					stroke="currentColor"
					strokeWidth="1.5"
					opacity="0.55"
				/>
			))}
			<g className="text-pro-text-tertiary">
				{years.map((year, index) => (
					<text
						key={year}
						x={Math.min(288, Math.max(12, 1 + (298 * index) / Math.max(1, years.length - 1)))}
						y="21"
						textAnchor="middle"
						fontSize="8.5"
						fill="currentColor"
					>
						{`'${String(year).slice(2)}`}
					</text>
				))}
			</g>
		</svg>
	)
}

/* ──────────────────────────── table ──────────────────────────── */

export interface Col<Row> {
	key: string
	label: string
	right?: boolean
	/**
	 * Allow the cell to wrap, for prose-ish columns like collateral exposure. Carries a
	 * min-width so the column takes its share of the row instead of collapsing to a
	 * word per line once the rest of the table claims its `nowrap` width.
	 */
	wrap?: boolean
	/** CSS width for the column, e.g. `'30%'` for the comparison-bar column. */
	width?: string
	render?: (row: Row) => React.ReactNode
}

function cellValue(value: unknown): React.ReactNode {
	if (value == null || value === '') return '—'
	if (React.isValidElement(value) || typeof value === 'string' || typeof value === 'number') return value
	return String(value)
}

export function DataTable<Row extends object>({
	rows,
	cols,
	footer,
	empty = 'No data'
}: {
	rows: Row[] | undefined
	cols: Array<Col<Row>>
	/** Totals row, keyed by column key. Columns without an entry render blank. */
	footer?: Record<string, React.ReactNode>
	empty?: string
}) {
	if (!rows) return <div className="h-24 animate-pulse rounded-sm bg-tertiary opacity-10" />
	if (rows.length === 0) return <div className="px-2 py-4 text-xs text-pro-text-secondary">{empty}</div>

	return (
		<div className="overflow-x-auto">
			{/* Content-sized so `nowrap` columns keep their width and scroll, but never
			    narrower than the card when there is room to spare. */}
			<table className="w-max min-w-full text-xs">
				<thead>
					<tr className="border-b border-pro-cards-border">
						{cols.map((col) => (
							<th
								key={col.key}
								style={col.width ? { width: col.width } : undefined}
								className={`px-3 py-2.5 label-xs tracking-wider whitespace-nowrap text-pro-text-label uppercase first:pl-0 last:pr-0 ${
									col.right ? 'text-right' : 'text-left'
								}`}
							>
								{col.label}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, rowIndex) => (
						<tr key={rowIndex} className="border-b border-pro-cards-border/60 last:border-0 hover:bg-sl-hover-bg">
							{cols.map((col) => (
								<td
									key={col.key}
									className={`px-3 py-2.5 first:pl-0 last:pr-0 ${col.wrap ? 'min-w-[170px]' : 'whitespace-nowrap'} ${
										col.right ? 'text-right font-mono text-pro-text-primary tabular-nums' : 'text-pro-text-secondary'
									}`}
								>
									{cellValue(col.render ? col.render(row) : Reflect.get(row, col.key))}
								</td>
							))}
						</tr>
					))}
				</tbody>
				{footer && (
					<tfoot>
						<tr className="border-t border-pro-cards-border">
							{cols.map((col) => (
								<td
									key={col.key}
									className={`px-3 pt-3 font-medium text-pro-text-primary first:pl-0 last:pr-0 ${
										col.right ? 'text-right font-mono tabular-nums' : ''
									}`}
								>
									{footer[col.key] ?? ''}
								</td>
							))}
						</tr>
					</tfoot>
				)}
			</table>
		</div>
	)
}
