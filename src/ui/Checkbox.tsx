import * as Ariakit from '@ariakit/react'
import type { ComponentProps, ReactNode } from 'react'

const CHECKBOX_WRAPPER_VARIANTS = {
	default:
		'group flex cursor-pointer flex-nowrap items-center gap-3 rounded-md px-3 py-2 body-sm text-primary hover:bg-hover-row has-focus-visible:bg-hover-row has-focus-visible:focus-ring',
	// Unpadded labels inline with other text: the ring sits outside the label instead of over its box and words.
	inline:
		'group flex cursor-pointer flex-nowrap items-center gap-2 rounded-sm label-md text-secondary has-focus-visible:focus-ring has-focus-visible:outline-offset-2',
	// Sentence-long agreements in a form: dialog copy size, and the box stays on the first line when the label wraps.
	consent:
		'group flex cursor-pointer flex-nowrap items-start gap-2 rounded-sm body-sm text-secondary has-focus-visible:focus-ring has-focus-visible:outline-offset-2',
	filter:
		'group relative flex min-h-8 cursor-pointer flex-nowrap items-center justify-between gap-2 rounded-lg border border-medium px-3 py-1.5 label-sm text-primary hover:bg-hover-row has-focus-visible:bg-hover-row has-focus-visible:focus-ring',
	'filter-borderless':
		'group relative flex cursor-pointer flex-row-reverse flex-nowrap items-center justify-between gap-4 rounded-md px-3 py-2 body-sm text-primary hover:bg-hover-row has-focus-visible:bg-hover-row has-focus-visible:focus-ring'
} as const

const CHECKBOX_INDICATOR_STYLES =
	'grid size-3.5 shrink-0 place-items-center rounded-[4px] border border-strong bg-transparent text-transparent group-hover:border-medium data-[checked=true]:border-brand data-[checked=true]:bg-brand data-[checked=true]:text-on-brand'

/** Controlled only: the caller owns `checked` and updates it in onChange. The hidden input's own keyboard focus draws
    the ring on the label (has-focus-visible). */
interface CheckboxProps extends Omit<ComponentProps<'input'>, 'checked' | 'defaultChecked'> {
	checked: boolean
	children?: ReactNode
	variant: keyof typeof CHECKBOX_WRAPPER_VARIANTS
}

export function Checkbox({ ref, children, variant, ...props }: CheckboxProps) {
	return (
		<label
			// A disabled box reads as disabled the way a disabled Button does.
			className={`${CHECKBOX_WRAPPER_VARIANTS[variant]} has-disabled:cursor-not-allowed has-disabled:opacity-60`}
		>
			<Ariakit.VisuallyHidden>
				<Ariakit.Checkbox {...props} ref={ref} clickOnEnter />
			</Ariakit.VisuallyHidden>
			{/* mt-px centres the 14px box on body-sm's 16px first line. */}
			<CheckboxIndicator checked={props.checked} className={variant === 'consent' ? 'mt-px' : undefined} />
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
