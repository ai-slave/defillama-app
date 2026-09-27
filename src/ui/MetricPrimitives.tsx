import * as Ariakit from '@ariakit/react'
import type { ReactNode } from 'react'
import { Icon } from '~/ui/Icon'
import { tooltipSurfaceStyles } from '~/ui/Popover'
import { Tooltip } from '~/ui/Tooltip'

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
			{tooltip ? (
				<Tooltip
					content={tooltip}
					render={<button type="button" className="body-md text-secondary underline decoration-dotted" />}
				>
					<span data-metric-label>{label}</span>
				</Tooltip>
			) : (
				<span className="body-md text-secondary" data-metric-label>
					{label}
				</span>
			)}
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
	const summaryContent = (
		<>
			<span
				className={`body-md text-secondary ${tooltip ? 'underline decoration-dotted' : ''}`.trim()}
				data-metric-label
			>
				{label}
			</span>
			<Icon
				name="chevron-down"
				height={16}
				width={16}
				className="relative top-1 text-tertiary transition-transform duration-100 group-open/metric:rotate-180"
			/>
			{extra}
			{value != null ? (
				<span className="ml-auto mono-md-bold" data-metric-value>
					{value}
				</span>
			) : null}
		</>
	)

	return (
		<details className="group/metric" open={defaultOpen}>
			{tooltip ? (
				/* A <summary> must not contain interactive descendants, so the
				   summary itself is the tooltip anchor — hover or focus on the
				   row shows the definition; click still toggles the accordion. */
				<Ariakit.TooltipProvider placement="top-start">
					<Ariakit.TooltipAnchor render={<summary className={metricSummaryStyles} />}>
						{summaryContent}
					</Ariakit.TooltipAnchor>
					<Ariakit.Tooltip className={`${tooltipSurfaceStyles} max-w-56 whitespace-pre-wrap`} unmountOnHide portal>
						<div className="p-2">{tooltip}</div>
					</Ariakit.Tooltip>
				</Ariakit.TooltipProvider>
			) : (
				<summary className={metricSummaryStyles}>{summaryContent}</summary>
			)}
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
					height={16}
					width={16}
					className="relative top-1 text-tertiary transition-transform duration-100 group-open/sub:rotate-180"
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
