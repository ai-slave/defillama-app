import * as Ariakit from '@ariakit/react'
import type { ComponentProps, ReactNode } from 'react'
import { useState } from 'react'

const CHECKBOX_WRAPPER_VARIANTS = {
	default:
		'group flex cursor-pointer flex-nowrap items-center gap-3 rounded-md px-3 py-2 body-sm text-primary hover:bg-hover-row data-focus-visible:bg-hover-row data-focus-visible:focus-ring',
	inline: 'group flex cursor-pointer flex-nowrap items-center gap-2 label-md text-secondary',
	// Sentence-long agreements in a form: dialog copy size, and the box stays on the first line when the label wraps.
	consent: 'group flex cursor-pointer flex-nowrap items-start gap-2 body-sm text-secondary',
	filter:
		'group relative flex min-h-8 cursor-pointer flex-nowrap items-center justify-between gap-2 rounded-lg border border-medium px-3 py-1.5 label-sm text-primary hover:bg-hover-row data-focus-visible:bg-hover-row data-focus-visible:focus-ring',
	'filter-borderless':
		'group relative flex cursor-pointer flex-row-reverse flex-nowrap items-center justify-between gap-4 rounded-md px-3 py-2 body-sm text-primary hover:bg-hover-row data-focus-visible:bg-hover-row data-focus-visible:focus-ring'
} as const

const CHECKBOX_INDICATOR_STYLES =
	'grid size-3.5 shrink-0 place-items-center rounded-[4px] border border-strong bg-transparent text-transparent group-hover:border-medium data-[checked=true]:border-brand data-[checked=true]:bg-brand data-[checked=true]:text-on-brand'

interface CheckboxProps extends ComponentProps<'input'> {
	children?: ReactNode
	variant: keyof typeof CHECKBOX_WRAPPER_VARIANTS
}

export function Checkbox({ ref, children, variant, ...props }: CheckboxProps) {
	const [checked, setChecked] = useState(props.checked ?? props.defaultChecked ?? false)
	const [focusVisible, setFocusVisible] = useState(false)
	const isChecked = props.checked ?? checked

	return (
		<label
			// A disabled box reads as disabled the way a disabled Button does.
			className={`${CHECKBOX_WRAPPER_VARIANTS[variant]} has-disabled:cursor-not-allowed has-disabled:opacity-60`}
			data-checked={isChecked}
			data-focus-visible={focusVisible || undefined}
		>
			<Ariakit.VisuallyHidden>
				<Ariakit.Checkbox
					{...props}
					ref={ref}
					clickOnEnter
					onFocusVisible={() => setFocusVisible(true)}
					onBlur={() => setFocusVisible(false)}
					onChange={(event) => {
						setChecked(event.target.checked)
						props.onChange?.(event)
					}}
				/>
			</Ariakit.VisuallyHidden>
			{/* mt-px centres the 14px box on body-sm's 16px first line. */}
			<CheckboxIndicator checked={isChecked} className={variant === 'consent' ? 'mt-px' : undefined} />
			{children}
		</label>
	)
}

/** The box alone, for a control that is itself the checkbox (a card or list row with role="checkbox"), where a
    label around a hidden input would nest one control inside another. `className` is placement only. */
export function CheckboxIndicator({ checked, className }: { checked: boolean; className?: string }) {
	return (
		<span aria-hidden className={`${CHECKBOX_INDICATOR_STYLES} ${className ?? ''}`.trim()} data-checked={checked}>
			{checked ? (
				<svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 14 14" height="0.875rem" width="0.875rem">
					<polyline points="3,7 5.75,9.75 11,4.5" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			) : null}
		</span>
	)
}
