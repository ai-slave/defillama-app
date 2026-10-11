import * as Ariakit from '@ariakit/react'
import type { ComponentProps, ReactNode } from 'react'
import { Check } from './internal/Check'

/* ----------------------------------------------------------------------------
   Checkbox — the 14px box of ./internal/Check.tsx, the same mark every
   multi-pick row draws (ListRow, OptionTile, popover and menu rows take it
   through their `check` slot). Callers choose the wrapper
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
			<Check kind="box" checked={props.checked} className={variant === 'consent' ? 'mt-px' : undefined} />
			{children}
		</label>
	)
}
