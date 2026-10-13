import type { ChangeEventHandler } from 'react'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { LoadingSpinner } from './internal/Loaders'

/* ----------------------------------------------------------------------------
   Switch — an on/off toggle with a visible or screen-reader label.
   40x24 rounded-full track, 16px bg-knob knob; on = bg-brand, off = elevated-2.
   Label is label-sm at gap-2. `hideLabel` keeps the label for assistive tech
   only, for rows whose visible text sits outside the control; `describedBy`
   points the input at that row's description. `help` adds a QuestionHelper
   after the label, outside it, and `className` then places the pair.
   `disabled` is announced with
   aria-disabled and keeps focus, so a control that is pending or gated does
   not drop the keyboard user; `isLoading` adds a spinner and the same activation guard.
   Enter toggles like Space, so a switch inside a form never submits it.
   Forced colors (Windows High Contrast) drop every fill, so the track and knob
   draw themselves in system colors there: an outlined track with a CanvasText
   knob when off, a Highlight track when on, GrayText when disabled. The edge is
   an outline, so the knob does not move; a focused switch's ring replaces it.
---------------------------------------------------------------------------- */

export function Switch({
	label,
	checked,
	onChange,
	value,
	className,
	help,
	isLoading,
	hideLabel,
	disabled,
	describedBy
}: {
	label: string
	checked: boolean
	onChange: ChangeEventHandler<HTMLInputElement>
	value: string
	className?: string
	help?: string
	isLoading?: boolean
	hideLabel?: boolean
	disabled?: boolean
	describedBy?: string
}) {
	const control = (
		<label
			className={`relative isolate flex flex-nowrap items-center gap-2 label-sm ${disabled ? 'cursor-not-allowed text-disabled' : isLoading ? 'cursor-progress' : 'cursor-pointer'} ${help ? '' : (className ?? '')}`}
		>
			<input
				type="checkbox"
				role="switch"
				aria-checked={checked}
				aria-label={hideLabel ? label : undefined}
				aria-disabled={disabled || isLoading || undefined}
				value={value}
				checked={checked}
				onChange={disabled || isLoading ? (event) => event.preventDefault() : onChange}
				// Enter flips a switch, as Space does; on a native checkbox it would submit the form around it.
				onKeyDown={(event) => {
					if (event.key !== 'Enter') return
					event.preventDefault()
					if (!disabled && !isLoading) event.currentTarget.click()
				}}
				aria-busy={isLoading}
				aria-describedby={describedBy}
				className="peer absolute size-[1em] opacity-[0.00001]"
			/>
			<span
				className={`relative h-6 w-10 shrink-0 rounded-full p-1 forced-colors:outline ${disabled ? 'bg-disabled forced-colors:bg-[Canvas] forced-colors:outline-[GrayText]' : checked ? 'bg-brand peer-focus-visible:focus-ring-on-brand forced-colors:bg-[Highlight] forced-colors:outline-[Highlight]' : 'bg-surface-elevated-2 peer-focus-visible:focus-ring forced-colors:bg-[Canvas] forced-colors:outline-[CanvasText]'} forced-colors:forced-color-adjust-none`}
			>
				<span
					className={`block size-4 rounded-full shadow-raised motion-safe:transition-transform motion-safe:duration-150 ${disabled ? 'bg-current text-disabled forced-colors:bg-[GrayText]' : checked ? 'bg-knob forced-colors:bg-[HighlightText]' : 'bg-knob forced-colors:bg-[CanvasText]'} ${checked ? 'translate-x-4' : ''} ${isLoading ? 'invisible' : ''}`}
				/>
				{isLoading ? (
					<span
						className={`absolute inset-0 flex items-center justify-center ${checked ? 'text-on-brand forced-colors:text-[HighlightText]' : 'text-primary forced-colors:text-[CanvasText]'}`}
					>
						<LoadingSpinner size={14} />
					</span>
				) : null}
			</span>
			<span className={hideLabel ? 'sr-only' : undefined}>{label}</span>
		</label>
	)
	if (!help) return control

	// Beside the label, not in it: inside, a tap on the "?" flips the switch and the definition joins the switch's name.
	return (
		<span className={`flex items-center gap-1 ${className ?? ''}`.trim()}>
			{control}
			<QuestionHelper text={help} />
		</span>
	)
}
