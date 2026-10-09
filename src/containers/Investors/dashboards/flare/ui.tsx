import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { formatPercent } from '~/utils/numberFormat'

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
		<div className="rounded-lg border border-subtle bg-surface p-4">
			<div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
				<div className="min-w-0">
					<h3 className="flex items-center gap-1 title-md text-primary">
						{title}
						{titleTooltip && (
							<Tooltip content={titleTooltip} className="-my-2 -mr-2 cursor-help p-2" aria-label={titleTooltip}>
								<Icon name="help-circle" height={13} width={13} />
							</Tooltip>
						)}
					</h3>
					{subtitle && <p className="mt-0.5 body-sm text-secondary">{subtitle}</p>}
				</div>
				{value && <p className="mono-xl tracking-tight text-primary tabular-nums">{value}</p>}
			</div>
			{children}
		</div>
	)
}

export function SectionHeader({ children }: { children: React.ReactNode }) {
	return <h2 className="title-sm tracking-wider text-secondary uppercase">{children}</h2>
}

export function NarrativeCallout({ children }: { children: React.ReactNode }) {
	return (
		<div
			className="rounded-lg border border-subtle bg-surface p-4 pl-5 body-md text-secondary"
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
