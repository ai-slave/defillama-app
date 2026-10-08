import type { ChangeEventHandler } from 'react'
import { LoadingSpinner } from '~/ui/Loaders'
import { QuestionHelper } from '~/ui/QuestionHelper'

/* ----------------------------------------------------------------------------
   Switch — an on/off toggle with a visible or screen-reader label.
   40x24 rounded-full track, 16px bg-knob knob; on = bg-brand, off = elevated-2.
   Label is label-sm at gap-2. `hideLabel` keeps the label for assistive tech
   only, for rows whose visible text sits outside the control; `describedBy`
   points the input at that row's description. `disabled` is announced with
   aria-disabled and keeps focus, so a control that is pending or gated does
   not drop the keyboard user; `isLoading` adds a spinner and the same activation guard.
   Enter toggles like Space, so a switch inside a form never submits it.
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
	return (
		<label
			className={`relative isolate flex flex-nowrap items-center gap-2 label-sm ${disabled ? 'cursor-not-allowed text-disabled' : isLoading ? 'cursor-progress' : 'cursor-pointer'} ${className ?? ''}`}
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
				className={`relative h-6 w-10 shrink-0 rounded-full p-1 ${disabled ? 'bg-disabled' : checked ? 'bg-brand peer-focus-visible:focus-ring-on-brand' : 'bg-surface-elevated-2 peer-focus-visible:focus-ring'}`}
			>
				<span
					className={`block size-4 rounded-full shadow-xs motion-safe:transition-transform motion-safe:duration-150 ${disabled ? 'bg-current text-disabled' : 'bg-knob'} ${checked ? 'translate-x-4' : ''} ${isLoading ? 'invisible' : ''}`}
				/>
				{isLoading ? (
					<span
						className={`absolute inset-0 flex items-center justify-center ${checked ? 'text-on-brand' : 'text-primary'}`}
					>
						<LoadingSpinner size={14} />
					</span>
				) : null}
			</span>
			{help ? (
				<span className="flex items-center gap-1">
					<span>{label}</span>
					<QuestionHelper text={help} />
				</span>
			) : (
				<span className={hideLabel ? 'sr-only' : undefined}>{label}</span>
			)}
		</label>
	)
}
