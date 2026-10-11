import clsx from 'clsx'
import type { ComponentProps, ReactNode } from 'react'
import { focusNeighborOnLeave } from './focus'
import { Icon } from './Icon'
import { LoadingSpinner } from './internal/Loaders'
import { tw } from './tw'
/* ----------------------------------------------------------------------------
   MetricChip — a metric plotted on a chart, beside its Add Metrics button.

   rounded-full, 32px tall (md row height), label-sm in text-primary (white —
   NOT link-blue), a 2px gap to a 14px trailing ×, px-2. The border is the
   metric's series color, so the chip doubles as the chart's legend:

     <MetricChip label="TVL" color={seriesColor} onRemove={() => …} />

   It is a button named "Remove TVL": pressing it removes the metric. When the
   chip leaves while focused, focus moves to the next chip, else the previous
   one; the first chip's previous neighbor is the Add Metrics button before
   it. `loading` swaps the × for a spinner and adds "loading" to the name;
   `prefix` is a glyph before the label (a verified seal).
---------------------------------------------------------------------------- */

const metricChipStyles = tw`flex min-h-8 shrink-0 cursor-pointer items-center justify-center gap-0.5 rounded-full border px-2 py-1.5 label-sm whitespace-nowrap text-primary hover:bg-hover-row focus-visible:bg-hover-row`

// One ref for every chip: a new callback each render would rerun its cleanup while the chip has focus.
const focusNeighborChipOnLeave = focusNeighborOnLeave()

export function MetricChip({
	label,
	color,
	onRemove,
	loading = false,
	prefix
}: {
	label: string
	color: string
	onRemove: () => void
	loading?: boolean
	prefix?: ReactNode
}) {
	return (
		<button
			type="button"
			data-row
			ref={focusNeighborChipOnLeave}
			onClick={onRemove}
			aria-label={loading ? `Remove ${label}, loading` : `Remove ${label}`}
			className={metricChipStyles}
			style={{ borderColor: color }}
		>
			{prefix}
			<span>{label}</span>
			{loading ? (
				// A button's name overrides its content, so the loading state travels in the name, not a status inside.
				<span aria-hidden="true">
					<LoadingSpinner size={14} />
				</span>
			) : (
				<Icon name="x" aria-hidden="true" className="size-3.5" />
			)}
		</button>
	)
}

const metricOptionChipStyles = tw`hover-wash group flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full border border-medium label-sm whitespace-nowrap text-primary transition-[background-color,border-color,color] duration-150 ease-out hover:border-brand focus-visible:border-brand data-[active=true]:border-brand data-[active=true]:bg-brand-muted data-[active=true]:text-link`

const METRIC_OPTION_CHIP_SIZES = {
	// In a phone sheet's rows the sm chip grows to the md chip's 32px, a tap target the wrapped rows can afford.
	sm: tw`min-h-6 px-2 py-0.5 sheet:min-h-8 sheet:px-3 sheet:py-1.5`,
	md: tw`min-h-8 px-3 py-1.5`
} as const

/** A chip that adds, picks or applies an option (a chart metric, a filter, a quick value, a preset): full radius,
    neutral border, brand when the caller sets `data-active`. The caller keeps `aria-pressed` and the content. sm is
    24px, for chip rows in dialogs and filter panels; md is 32px, beside md controls. `className` is placement only
    (a Hovercard or Tooltip anchor adds its own). */
export function MetricOptionChip({
	size,
	className,
	...props
}: { size: keyof typeof METRIC_OPTION_CHIP_SIZES } & ComponentProps<'button'>) {
	return (
		<button
			type="button"
			{...props}
			className={clsx(metricOptionChipStyles, METRIC_OPTION_CHIP_SIZES[size], className)}
		/>
	)
}

const metricSeriesToggleStyles = tw`flex min-h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full border border-medium px-2 py-1.5 label-sm whitespace-nowrap text-secondary transition-[background-color,border-color,color] duration-150 ease-out hover:bg-hover-row hover:text-primary focus-visible:bg-hover-row focus-visible:text-primary data-[active=true]:border-secondary data-[active=true]:text-primary`

/** On/off chart-series control, on when the caller sets `data-active`. Unlike a removable MetricChip it has no ×
    icon; unlike an option chip it keeps the 32px chart-toolbar height. `className` is placement only. */
export function MetricSeriesToggle({ className, ...props }: ComponentProps<'button'>) {
	return <button type="button" {...props} className={clsx(metricSeriesToggleStyles, className)} />
}
