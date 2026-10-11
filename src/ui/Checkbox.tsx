import * as Ariakit from '@ariakit/react'
import type { ComponentProps, ReactNode } from 'react'

/* ----------------------------------------------------------------------------
   Checkbox — a 14px rounded box: checked is bg-brand with a white check,
   unchecked an empty border-strong box. Callers choose the wrapper
   `variant`:
   - default / filter / filter-borderless: rows in lists, menus and filters.
   - inline:  label-md, centered, for short one-line toggles.
   - inline-sm: inline at label-sm, for a toggle inside a 12px panel
              (a chart builder's options).
   - consent: body-sm text-secondary like the form copy around it, for a
              sentence-long agreement (claim consents, terms); the box stays
              on the label's first line when it wraps. Links to the
              documents it agrees to are the one control a label holds:
              their names belong in the box's name, and a click on a link
              opens the document without toggling the box. Never a button
              or a QuestionHelper (policy: check-focus-handoff).
   It toggles on Space, as a native checkbox does; Enter never toggles it
   (it submits the form around it). Never pass Ariakit's `clickOnEnter`.
   Keyboard focus on the hidden input draws the ring and row wash on the
   label (`has-focus-visible:`), so callers never track focus. A disabled
   checkbox takes the disabled colors with the not-allowed cursor, like
   Button; its reason stays in visible text. `isLoading` is the pending state
   of a toggle that saves: the box keeps its look and its keyboard focus
   (aria-disabled, not a native disabled that would drop focus), shows the
   progress cursor and ignores clicks, like a pending Button.
---------------------------------------------------------------------------- */

const CHECKBOX_WRAPPER_VARIANTS = {
	default:
		'group flex cursor-pointer flex-nowrap items-center gap-3 rounded-md px-3 py-2 body-sm text-primary hover:bg-hover-row has-focus-visible:bg-hover-row has-focus-visible:focus-ring',
	// Unpadded labels inline with other text: the ring sits outside the label instead of over its box and words.
	inline:
		'group flex cursor-pointer flex-nowrap items-center gap-2 rounded-sm label-md text-secondary has-focus-visible:focus-ring has-focus-visible:outline-offset-2',
	'inline-sm':
		'group flex cursor-pointer flex-nowrap items-center gap-2 rounded-sm label-sm text-secondary has-focus-visible:focus-ring has-focus-visible:outline-offset-2',
	// Sentence-long agreements in a form: dialog copy size, and the box stays on the first line when the label wraps.
	consent:
		'group flex cursor-pointer flex-nowrap items-start gap-2 rounded-sm body-sm text-secondary has-focus-visible:focus-ring has-focus-visible:outline-offset-2',
	filter:
		'group relative flex min-h-8 cursor-pointer flex-nowrap items-center justify-between gap-2 rounded-lg border border-medium px-3 py-1.5 label-sm text-primary hover:bg-hover-row has-focus-visible:bg-hover-row has-focus-visible:focus-ring',
	'filter-borderless':
		'group relative flex cursor-pointer flex-row-reverse flex-nowrap items-center justify-between gap-4 rounded-md px-3 py-2 body-sm text-primary hover:bg-hover-row has-focus-visible:bg-hover-row has-focus-visible:focus-ring'
} as const

const CHECKBOX_INDICATOR_STYLES =
	'grid size-3.5 shrink-0 place-items-center rounded-[4px] border border-strong bg-transparent text-transparent data-[checked=true]:border-brand data-[checked=true]:bg-brand data-[checked=true]:text-on-brand group-has-disabled:border-disabled group-has-disabled:data-[checked=true]:border-disabled group-has-disabled:data-[checked=true]:bg-disabled group-has-disabled:data-[checked=true]:text-disabled'

/** Controlled only: the caller owns `checked` and updates it in onChange. The hidden input's own keyboard focus draws
    the ring on the label (has-focus-visible). */
interface CheckboxProps extends Omit<ComponentProps<'input'>, 'checked' | 'defaultChecked'> {
	checked: boolean
	children?: ReactNode
	variant: keyof typeof CHECKBOX_WRAPPER_VARIANTS
	isLoading?: boolean
}

export function Checkbox({ ref, children, variant, isLoading, ...props }: CheckboxProps) {
	return (
		<label
			// A disabled box reads as disabled the way a disabled Button does.
			className={`${CHECKBOX_WRAPPER_VARIANTS[variant]} has-disabled:cursor-not-allowed has-disabled:text-disabled has-aria-busy:cursor-progress`}
		>
			<Ariakit.VisuallyHidden>
				<Ariakit.Checkbox
					{...props}
					ref={ref}
					disabled={props.disabled || isLoading}
					accessibleWhenDisabled={isLoading}
					aria-busy={isLoading || undefined}
				/>
			</Ariakit.VisuallyHidden>
			{/* mt-px centers the 14px box on body-sm's 16px first line. */}
			<CheckboxIndicator checked={props.checked} className={variant === 'consent' ? 'mt-px' : undefined} />
			{children}
		</label>
	)
}

/** The box alone, for a control that is itself the checkbox (a card or list row with role="checkbox", an Ariakit
    Checkbox rendered as a row button), where a label around a hidden input would nest one control inside another.
    It stays exported for those rows: `Checkbox` cannot be the row, and the row owns its own look. `className` is
    placement only. */
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
