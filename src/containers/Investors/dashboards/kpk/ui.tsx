import * as React from 'react'
import { Tooltip } from '~/ui/Tooltip'
import { formatDate } from '~/utils/dateFormat'
import { keyedOccurrences, type RowIdentity } from '~/utils/keyedOccurrences'
import { formatNumber, formatPercent, formatUsd, roundNumber } from '~/utils/numberFormat'
import type { KpkExcessWindow, KpkMandateScope, KpkRef } from './api'
import { KPK_BENCH_BG, KPK_MINT_BG, KPK_MINT_TEXT, KPK_USD_OPTIONS } from './chartDefaults'
import { MILLION } from './transform'

export const REBALANCING_REF: KpkRef = {
	label: 'KPK Vaults Operations — Dune',
	url: 'https://dune.com/kpk/kpk-vaults-operations'
}

/* ──────────────────────────── formatting ──────────────────────────── */

export const KPK_PERCENT_OPTIONS = {
	input: 'percent',
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
	useGrouping: false
} as const

/** Absolute USD, on the dashboard's one money format. See `KPK_USD_OPTIONS`. */
export function usdCompact(value: number | null | undefined): string {
	return value == null ? '—' : (formatUsd(value, KPK_USD_OPTIONS) ?? '—')
}

/** Upstream USD amounts are expressed in millions. */
export function usdFromMillions(value: number | null | undefined): string {
	return value == null ? '—' : usdCompact(value * MILLION)
}

export function usdSignedFromMillions(value: number | null | undefined): string {
	if (value == null || !Number.isFinite(value)) return '—'
	return `${value < 0 ? '−' : ''}${usdFromMillions(Math.abs(value))}`
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

export const PROSE_DUST_M = 0.0005

export function andList(names: ReadonlyArray<string>): string {
	if (names.length < 2) return names[0] ?? ''
	return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function asOfLabel(asOf: Record<string, string | null> | null | undefined): string {
	const legs = Object.entries(asOf ?? {})
		.filter((leg): leg is [string, string] => !!leg[1])
		.map(([leg, date]) => [leg, formatDate(date) ?? date] as const)
	if (legs.length === 0) return ''
	const dates = [...new Set(legs.map(([, date]) => date))]
	return dates.length === 1 ? `as of ${dates[0]}` : legs.map(([leg, date]) => `${leg} as of ${date}`).join(', ')
}

const OPS_BUCKET_LABELS: Record<string, string> = {
	'ops:idle': 'idle',
	'ops:market-making': 'market making',
	'ops:stream': 'streams',
	'ops:strategic': 'strategic'
}

const opsBucketLabel = (name: string): string => OPS_BUCKET_LABELS[name] ?? name.replace(/^ops:/, '').replace(/-/g, ' ')

export function scopeLine(denom: string, scope: KpkMandateScope | undefined): string {
	if (!scope) return ''
	const ops =
		scope.opsUsd > PROSE_DUST_M
			? `${usdFromMillions(scope.opsUsd)} of ${denom} sits in ops positions or idle — ` +
				`${andList(scope.opsBuckets.map((bucket) => `${opsBucketLabel(bucket.name)} ${usdFromMillions(bucket.usd)}`))} — ` +
				`held for a purpose other than yield, so no benchmark applies. Excluded from the comparison above.`
			: `No ${denom} is held in ops positions or idle.`

	return `Rates cover ${usdFromMillions(scope.defiUsd)} of ${denom} defi positions. ${ops}`
}

export function earnedWindowLine(window: KpkExcessWindow | null | undefined): string {
	if (!window) return 'No per-position history available, so no earned figure is shown.'
	const span = window.days === 365 ? 'trailing 365 days' : `${window.days} days`
	const missing = window.missingDays
	const missingNote =
		missing > 0 ? ` ${missing} day${missing === 1 ? '' : 's'} had no snapshot and accrued nothing.` : ''
	return `Sum of balance × (rate − benchmark) for every defi position, day by day, over the ${span}.${missingNote}`
}

export function earnedTitle(window: KpkExcessWindow | null | undefined): string | undefined {
	if (!window) return undefined
	const from = formatDate(window.from) ?? window.from
	const to = formatDate(window.to) ?? window.to
	const parts = [
		`Window ${from} – ${to} (${window.days} days, ${window.snapshotDays} with a snapshot` +
			`${window.carriedDays ? `, ${window.carriedDays} carried forward` : ''}` +
			`${window.missingDays ? `, ${window.missingDays} missing` : ''})`,
		`Earned ${usdFromMillions(window.earned)} against ${usdFromMillions(
			window.benchEarned
		)} at benchmark, on a mean balance of ${usdFromMillions(window.avgBalance)}`,
		`Rates found for ${
			formatPercent(window.coveragePct, {
				input: 'percent',
				minimumFractionDigits: 1,
				maximumFractionDigits: 1,
				useGrouping: false
			}) ?? '—'
		} of balance-days`
	]
	if (window.stacked.length > 0) {
		parts.push(
			`Staking + lending both counted for ${andList(
				window.stacked.map((entry) => `${entry.name} (${usdFromMillions(entry.usd)}/day)`)
			)}`
		)
	}
	if (window.fallback.length > 0) {
		const total = window.fallback.reduce((sum, entry) => sum + entry.usd, 0)
		parts.push(
			`${window.fallback[0].label} stands in for ${window.fallback.length} position${
				window.fallback.length === 1 ? '' : 's'
			} with no series of their own (${usdFromMillions(total)}/day)`
		)
	}
	if (window.unpriced.length > 0) {
		parts.push(
			`No rate for ${andList(
				window.unpriced.map((entry) => `${entry.name} (${usdFromMillions(entry.usd)}/day)`)
			)} — excluded, never counted as 0%`
		)
	}
	parts.push("Balances are the 00:00 UTC onchain replay; the rates table above is on today's snapshot")
	return `${parts.join('. ')}.`
}

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

export interface LedgerMetric {
	value: string
	label?: string
	title?: string
	/** The query behind this figure, linked from the end of the pair. */
	ref?: KpkRef
}

export function LedgerTile({
	label,
	value,
	valueClass,
	suffix,
	suffixBelow,
	sub,
	subTitle,
	subRef,
	metric,
	metricLabel,
	metricTitle,
	metricRef,
	metrics,
	children
}: {
	label: string
	value?: string
	/** Colours a headline that carries a sign, e.g. an excess return that can be negative. */
	valueClass?: string
	/** Rendered small and dim next to the headline, e.g. the `+` in `$8bn+`. */
	suffix?: string
	/**
	 * Stack the suffix under the number instead of beside it. For a suffix that
	 * qualifies the figure rather than completing it — "0 since inception" reads as
	 * one phrase inline, when the fact is the zero and the span is its scope.
	 */
	suffixBelow?: boolean
	sub?: string
	/** How the headline was measured, where the caption can only summarise it. */
	subTitle?: string
	/** The query behind the headline, linked inline from the caption. */
	subRef?: KpkRef
	metric?: string
	metricLabel?: string
	metricTitle?: string
	/** The query behind the single `metric`, linked from the end of the pair. */
	metricRef?: KpkRef
	/** Several pairs on the divided row. Wins over the single `metric` triple. */
	metrics?: Array<LedgerMetric>
	children?: React.ReactNode
}) {
	const pairs = metrics ?? (metric ? [{ value: metric, label: metricLabel, title: metricTitle, ref: metricRef }] : [])
	return (
		<div className="flex min-w-0 flex-col gap-2 border-t border-pro-cards-border p-5 text-center first:border-t-0 lg:border-t-0 lg:border-l lg:first:border-l-0 sm:[&:nth-child(-n+2)]:border-t-0">
			<span className="label-sm tracking-wider text-pro-text-label uppercase">{label}</span>
			{value == null ? (
				<div className="mx-auto h-8 w-28 animate-pulse rounded-sm bg-tertiary opacity-20" />
			) : (
				<span
					className={`flex font-mono text-3xl tracking-tight tabular-nums ${suffixBelow ? 'flex-col items-center gap-1.5' : 'items-baseline justify-center gap-1'} ${valueClass ?? 'text-pro-text-primary'} font-bold`}
				>
					{value}
					{suffix && <small className="text-sm font-normal text-pro-text-label">{suffix}</small>}
				</span>
			)}
			{sub && (
				<span className="body-sm text-pro-text-secondary">
					{sub}
					<InfoTip text={subTitle} className="ml-1" />
					{subRef && (
						<>
							{' '}
							<RowLink href={subRef.url} label={subRef.label} size="sm" />
						</>
					)}
				</span>
			)}
			{pairs.length > 0 && (
				<span className="mt-auto flex flex-wrap items-baseline justify-center gap-x-4 gap-y-1 border-t border-pro-cards-border pt-2.5 body-sm text-pro-text-secondary">
					{pairs.map((pair) => (
						<span key={`${pair.value}${pair.label ?? ''}`}>
							<b className="font-mono text-sm text-pro-text-primary tabular-nums">{pair.value}</b>
							{pair.label ? ` ${pair.label}` : null}
							<InfoTip text={pair.title} className="ml-1" />
							{pair.ref && (
								<>
									{' '}
									<RowLink href={pair.ref.url} label={pair.ref.label} size="sm" />
								</>
							)}
						</span>
					))}
				</span>
			)}
			{/* Centred as its own column: the extras are a fixed-width meter, a note and a
			    full-width rule, and only the note is text that `text-center` could move. */}
			{children && <div className="flex flex-col items-center gap-2">{children}</div>}
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

export function RefLinks({ refs }: { refs: Array<KpkRef> | undefined }) {
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
export function Spark({ values, label }: { values: Array<number> | undefined; label: string }) {
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
	/** Full-width value. Instant liquidity uses 30 so a 15% target sits mid-bar. */
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

/**
 * The circled "i" beside anything with more to say on hover. The shared Tooltip rather
 * than a `title` attribute: `title` never opens on touch and gives no sign it is there.
 * The padding buys a tap target; the negative margins keep the line height unchanged.
 * The text rides on `aria-label` too, since the tooltip only mounts while open.
 */
export function InfoTip({ text, className = '' }: { text: string | undefined; className?: string }) {
	if (!text) return null
	return (
		<span className={`inline-flex align-middle ${className}`}>
			<Tooltip
				content={text}
				aria-label={text}
				className="-m-1.5 cursor-help p-1.5 text-pro-text-tertiary transition-colors hover:text-pro-text-primary"
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="size-3"
					aria-hidden
				>
					<circle cx="12" cy="12" r="10" />
					<path d="M12 16v-4" />
					<path d="M12 8h.01" />
				</svg>
			</Tooltip>
		</span>
	)
}

export function DashSwatch({ className = '' }: { className?: string }) {
	return (
		<span
			aria-hidden
			className={`inline-block w-3 shrink-0 border-t border-dashed border-pro-text-primary align-middle ${className}`}
		/>
	)
}

export function ChartFootnote({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="mt-3 flex items-start gap-2 border-t border-pro-cards-border pt-2.5 body-sm text-pro-text-tertiary">
			<DashSwatch className="mt-2" />
			<span>
				<b className="font-medium text-pro-text-secondary">{title}</b> — {children}
			</span>
		</div>
	)
}

/**
 * Arrow-out link. Renders nothing when a row has no destination. The `sm` size is
 * for the same affordance sitting inline in a caption, scaled to its line.
 */
export function RowLink({ href, label, size = 'md' }: { href: string | undefined; label: string; size?: 'sm' | 'md' }) {
	if (!href) return null
	const isSmall = size === 'sm'
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			title={`Open ${label}`}
			aria-label={`Open ${label} in a new tab`}
			className={`inline-flex shrink-0 items-center justify-center rounded-md border border-pro-cards-border text-pro-text-secondary transition-colors hover:border-sl-accent hover:text-sl-accent ${
				isSmall ? 'size-[18px] align-text-bottom' : 'size-6'
			}`}
		>
			<svg
				viewBox="0 0 12 12"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.6"
				className={isSmall ? 'size-2.5' : 'size-3'}
				aria-hidden
			>
				<path d="M3.6 8.4 8.4 3.6" />
				<path d="M4.4 3.6H8.4V7.6" />
			</svg>
		</a>
	)
}

/** Zero funds lost, drawn as one unbroken line with a tick per year. */
export function ContinuityRule({ years }: { years: Array<number> | undefined }) {
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
	title?: string
	right?: boolean
	/**
	 * Allow the cell to wrap, for prose-ish columns like collateral exposure. Carries a
	 * min-width so the column takes its share of the row instead of collapsing to a
	 * word per line once the rest of the table claims its `nowrap` width. A `fit` table
	 * drops it: the card caps the row, so the floor could only push the table out.
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

export type FooterCells = Record<string, React.ReactNode>

export interface FooterRow {
	cells: FooterCells
	muted?: boolean
	title?: string
}

export function DataTable<Row extends object>({
	getRowKey,
	getOccurrenceKey,
	rows,
	cols,
	footer,
	fit = false,
	freeze,
	empty = 'No data'
}: {
	rows: Array<Row> | undefined
	cols: Array<Col<Row>>
	/**
	 * Totals row, keyed by column key; columns without an entry render blank. Pass an
	 * array where a total needs a second reading underneath it.
	 */
	footer?: FooterCells | Array<FooterRow>
	/**
	 * Size the table to its card, wrapping the `wrap` columns, and never scroll. It
	 * gets no scroll container at all: an info icon's tap target overhangs the last
	 * row, and inside one that overhang alone raised a scrollbar on both axes.
	 */
	fit?: boolean
	/**
	 * Pin the first column while the rest scrolls sideways under it. `panes` also pins
	 * the header row, capping the table's height so there is something to scroll
	 * beneath it; `column` leaves the height alone and lets the page scroll.
	 */
	freeze?: 'column' | 'panes'
	empty?: string
} & RowIdentity<Row>) {
	if (!rows) return <div className="h-24 animate-pulse rounded-sm bg-tertiary opacity-10" />
	if (rows.length === 0) return <div className="px-2 py-4 text-xs text-pro-text-secondary">{empty}</div>

	const footerRows: Array<FooterRow> = footer == null ? [] : Array.isArray(footer) ? footer : [{ cells: footer }]
	const keyedRows = getRowKey
		? rows.map((item) => ({ item, key: getRowKey(item) }))
		: keyedOccurrences(rows, getOccurrenceKey)

	const pinnedCol = 'sticky left-0 border-r border-pro-cards-border bg-(--pro-frozen-bg)'
	const rowTint = 'group-hover/row:bg-[linear-gradient(var(--sl-hover-bg),var(--sl-hover-bg))]'
	const headCell = (first: boolean) =>
		freeze === 'panes'
			? `sticky top-0 border-b border-pro-cards-border bg-(--pro-frozen-bg) ${first ? `${pinnedCol} z-30` : 'z-20'}`
			: freeze
				? `border-b border-pro-cards-border ${first ? `${pinnedCol} z-10` : ''}`
				: ''
	const bodyCell = (first: boolean, last: boolean) =>
		freeze ? `${last ? '' : 'border-b border-pro-cards-border/60'} ${first ? `${pinnedCol} ${rowTint} z-10` : ''}` : ''
	const footCell = (first: boolean, muted: boolean) =>
		freeze ? `${muted ? '' : 'border-t border-pro-cards-border'} ${first ? `${pinnedCol} z-10` : ''}` : ''
	const footContent = (row: FooterRow, key: string, first: boolean) => {
		// A row's note sits on its name, the one cell every footer row fills. When the
		// name wraps, the flex row squeezes its items, so the icon is kept at full size.
		const content =
			first && row.title ? (
				<span className="inline-flex items-center gap-1">
					{row.cells[key] ?? ''}
					<InfoTip text={row.title} className="shrink-0" />
				</span>
			) : (
				(row.cells[key] ?? '')
			)
		// Pinned, a long footer name wraps on a narrow screen rather than widening the
		// column that stays put over the ones scrolling past it.
		return first && freeze ? <span className="block max-w-40 md:max-w-none">{content}</span> : content
	}

	return (
		<div className={freeze === 'panes' ? 'max-h-[70vh] overflow-auto' : fit ? '' : 'overflow-x-auto'}>
			{/* Content-sized so `nowrap` columns keep their width and scroll, but never
			    narrower than the card when there is room to spare. `fit` trades that for
			    a table that never outgrows its card. */}
			<table
				className={`text-xs ${fit ? 'w-full' : 'w-max min-w-full'} ${freeze ? 'border-separate border-spacing-0' : ''}`}
			>
				<thead>
					<tr className={freeze ? '' : 'border-b border-pro-cards-border'}>
						{cols.map((col, index) => (
							<th
								key={col.key}
								style={col.width ? { width: col.width } : undefined}
								className={`px-3 py-2.5 label-xs tracking-wider whitespace-nowrap text-pro-text-label uppercase first:pl-0 last:pr-0 ${
									col.right ? 'text-right' : 'text-left'
								} ${headCell(index === 0)}`}
							>
								{col.label}
								<InfoTip text={col.title} className="ml-1" />
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{keyedRows.map(({ item: row, key }, rowIndex) => (
						<tr
							key={key}
							className={`hover:bg-sl-hover-bg ${
								freeze ? 'group/row' : 'border-b border-pro-cards-border/60 last:border-0'
							}`}
						>
							{cols.map((col, index) => (
								<td
									key={col.key}
									className={`px-3 py-2.5 first:pl-0 last:pr-0 ${col.wrap ? (fit ? '' : 'min-w-[170px]') : 'whitespace-nowrap'} ${
										col.right ? 'text-right text-pro-text-primary tabular-nums' : 'text-pro-text-secondary'
									} ${bodyCell(index === 0, rowIndex === keyedRows.length - 1)}`}
								>
									{cellValue(col.render ? col.render(row) : Reflect.get(row, col.key))}
								</td>
							))}
						</tr>
					))}
				</tbody>
				{footerRows.length > 0 && (
					<tfoot>
						{footerRows.map((row, rowIndex) => (
							<tr
								// oxlint-disable-next-line react/no-array-index-key -- Footer positions identify total and secondary-reading slots.
								key={rowIndex}
								className={row.muted ? 'text-pro-text-secondary' : freeze ? '' : 'border-t border-pro-cards-border'}
							>
								{cols.map((col, index) => (
									<td
										key={col.key}
										className={`px-3 first:pl-0 last:pr-0 ${row.muted ? 'pt-1.5' : 'pt-3 text-pro-text-primary'} ${
											// A total's figures take the title weight so they read above the rows; its label keeps medium.
											col.right
												? `text-right tabular-nums ${row.muted ? '' : 'font-semibold'}`
												: row.muted
													? ''
													: 'font-medium'
										} ${footCell(index === 0, !!row.muted)}`}
									>
										{footContent(row, col.key, index === 0)}
									</td>
								))}
							</tr>
						))}
					</tfoot>
				)}
			</table>
		</div>
	)
}
