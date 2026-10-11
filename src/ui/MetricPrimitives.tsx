import type { ReactNode } from 'react'
import { Icon } from '~/ui/Icon'
import { Definition, Tooltip } from '~/ui/Tooltip'

/* ----------------------------------------------------------------------------
   Metric rows for summary cards (./SummaryStats.tsx variants 1 and 2) and
   KeyMetricsPanel.

   - Stack rows in a NO-GAP flex column. Each row's py-1 spaces its border-b
     divider evenly; a gapped parent puts the whole gap below every divider.
   - Labels are body-md text-secondary, always: never body-sm, a bare
     unsized span, or text-base. text-tertiary is for de-emphasized sub-data
     (raise dates, 24h/30d suffixes, counts) and utility icons.
   - Values are mono-md-bold by default (`valueClassName` for mono-md or
     placement). Never promote a row to the headline size.
---------------------------------------------------------------------------- */

export const METRIC_LABEL_SELECTOR = '[data-metric-label]'
export const METRIC_VALUE_SELECTOR = '[data-metric-value]'

interface MetricRowProps {
	label: ReactNode
	tooltip?: ReactNode
	value: ReactNode
	extra?: ReactNode
	className?: string
	valueClassName?: string
	dashed?: boolean
}

export function MetricRow({
	label,
	tooltip,
	value,
	extra,
	className = '',
	valueClassName = 'mono-md-bold ml-auto',
	dashed = false
}: MetricRowProps) {
	return (
		<p
			className={`group flex min-h-6 flex-wrap items-baseline justify-start gap-1 border-b ${dashed ? 'border-dashed' : ''} border-subtle py-1 last:border-none ${className}`.trim()}
		>
			<Definition as="span" content={tooltip} className="body-md text-secondary">
				<span data-metric-label>{label}</span>
			</Definition>
			{extra}
			<span className={valueClassName} data-metric-value>
				{value}
			</span>
		</p>
	)
}

type SubMetricRowProps = Omit<MetricRowProps, 'dashed'>

export function SubMetricRow({
	label,
	tooltip,
	value,
	extra,
	className = '',
	valueClassName = 'mono-md ml-auto'
}: SubMetricRowProps) {
	return (
		<MetricRow
			label={label}
			tooltip={tooltip}
			value={value}
			extra={extra}
			className={className}
			valueClassName={valueClassName}
			dashed
		/>
	)
}

interface MetricSectionProps {
	label: ReactNode
	tooltip?: string | null
	value?: ReactNode
	extra?: ReactNode
	children?: ReactNode
	defaultOpen?: boolean
}

const metricSummaryStyles =
	'flex min-h-6 flex-wrap items-baseline justify-start gap-1 border-b border-subtle py-1 group-last/metric:border-none group-open/metric:border-none group-open/metric:font-semibold'

export function MetricSection({ label, tooltip, value, extra, children, defaultOpen = false }: MetricSectionProps) {
	return (
		<details className="group/metric" open={defaultOpen}>
			{/* A <summary> must not contain interactive descendants, so the summary itself is the tooltip anchor: hover
			    or focus on the row shows the definition, and a click or tap still toggles the accordion. */}
			<Tooltip content={tooltip} render={<summary className={metricSummaryStyles} />}>
				<span
					className={`body-md text-secondary ${tooltip ? 'underline decoration-dotted' : ''}`.trim()}
					data-metric-label
				>
					{label}
				</span>
				<Icon
					name="chevron-down"
					className="relative top-1 size-4 text-tertiary transition-transform duration-100 group-open/metric:rotate-180"
				/>
				{extra}
				{value != null ? (
					<span className="ml-auto mono-md-bold" data-metric-value>
						{value}
					</span>
				) : null}
			</Tooltip>
			{children ? <div className="mb-3 flex flex-col">{children}</div> : null}
		</details>
	)
}

export function SubMetricSection({
	label,
	value,
	children
}: {
	label: ReactNode
	value?: ReactNode
	children?: ReactNode
}) {
	return (
		<details className="group/sub">
			<summary className="flex min-h-6 flex-wrap items-baseline justify-start gap-1 border-b border-dashed border-subtle py-1 group-last/sub:border-none group-open/sub:border-none group-open/sub:font-semibold">
				<span className="body-md text-secondary" data-metric-label>
					{label}
				</span>
				<Icon
					name="chevron-down"
					className="relative top-1 size-4 text-tertiary transition-transform duration-100 group-open/sub:rotate-180"
				/>
				{value != null ? (
					<span className="ml-auto mono-md" data-metric-value>
						{value}
					</span>
				) : null}
			</summary>
			{children ? <div className="mb-3 flex flex-col">{children}</div> : null}
		</details>
	)
}
