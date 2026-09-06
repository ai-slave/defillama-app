import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { formatPercent } from '~/utils/numberFormat' // Design language (see design.md): numbers are the hero — large, monospaced and
// tabular; labels are tiny, uppercase and dim. Flat, hairline-bordered, no shadows.
export function KpiCard({
	label,
	value,
	sub,
	change,
	def
}: {
	label: string
	value: string
	sub?: string
	change?: { value: number; formatted: string }
	/** Explainer for a non-obvious metric, read on hover over the "?" next to the label. */
	def?: string
}) {
	return (
		<div className="flex flex-col gap-1.5 rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<span className="flex items-center gap-1 text-[11px] font-medium tracking-wider text-pro-text-label uppercase">
				{label}
				{def && (
					<Tooltip content={def} className="-my-2 -mr-2 cursor-help p-2" aria-label={def}>
						<Icon name="help-circle" height={12} width={12} />
					</Tooltip>
				)}
			</span>
			<div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
				<span className="font-mono text-2xl font-semibold tracking-tight text-pro-text-primary tabular-nums">
					{value}
				</span>
				{change && (
					<span
						className={`flex items-center gap-0.5 font-mono text-xs font-medium tabular-nums ${
							change.value >= 0 ? 'text-success' : 'text-error'
						}`}
					>
						<span aria-hidden>{change.value >= 0 ? '▲' : '▼'}</span>
						{change.formatted}
					</span>
				)}
			</div>
			{sub && <span className="font-mono text-[11px] text-pro-text-label tabular-nums">{sub}</span>}
		</div>
	)
}

// A chart card frames its viz with a prominent title, an optional one-line
// plain-English thesis (subtitle) and an optional headline KPI on the right.
// `titleTooltip` is for a longer explainer that would clutter the subtitle —
// it surfaces as a "?" next to the title, read on hover.
export function ChartCard({
	title,
	subtitle,
	titleTooltip,
	value,
	children
}: {
	title: string
	subtitle?: string
	titleTooltip?: string
	value?: string
	children: React.ReactNode
}) {
	return (
		<div className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4">
			<div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
				<div className="min-w-0">
					<h3 className="flex items-center gap-1 text-sm font-semibold text-pro-text-primary">
						{title}
						{titleTooltip && (
							<Tooltip content={titleTooltip} className="-my-2 -mr-2 cursor-help p-2" aria-label={titleTooltip}>
								<Icon name="help-circle" height={13} width={13} />
							</Tooltip>
						)}
					</h3>
					{subtitle && <p className="mt-0.5 text-xs leading-relaxed text-pro-text-label">{subtitle}</p>}
				</div>
				{value && (
					<p className="font-mono text-2xl font-semibold tracking-tight text-pro-text-primary tabular-nums">{value}</p>
				)}
			</div>
			{children}
		</div>
	)
}

export function SectionHeader({ children }: { children: React.ReactNode }) {
	return <h2 className="text-xs font-semibold tracking-wider text-pro-text-label uppercase">{children}</h2>
}

export function ToggleButton({
	active,
	onClick,
	children
}: {
	active: boolean
	onClick: () => void
	children: React.ReactNode
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`rounded-md px-3 py-1 text-xs font-semibold tracking-wide transition-colors ${
				active
					? 'bg-sl-accent-muted text-sl-accent'
					: 'text-pro-text-secondary hover:bg-sl-hover-bg hover:text-pro-text-primary'
			}`}
		>
			{children}
		</button>
	)
}

export function NarrativeCallout({ children }: { children: React.ReactNode }) {
	return (
		<div
			className="rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4 pl-5 text-sm leading-relaxed text-pro-text-secondary"
			style={{ borderLeft: '3px solid #FF7A1A' }}
		>
			{children}
		</div>
	)
}

export function formatPct(n: number, decimals = 2): string {
	if (!Number.isFinite(n)) return '-'
	return `${formatPercent(n, { input: 'percent', minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: false })}`
}
