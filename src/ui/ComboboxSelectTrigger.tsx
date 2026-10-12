import * as Ariakit from '@ariakit/react'

/* ----------------------------------------------------------------------------
   ComboboxSelectTrigger — the trigger every picker renders, and its look,
   `selectTriggerStyles(variant, size)`.

   - Callers choose the trigger `variant` and `size`; product surfaces pin
     their own values instead of inheriting a default.
   - A picker's `className` is placement only (`ml-auto`, `w-full`,
     `flex-1`; policy: check-part-classes). The arrow carries `ml-auto`, so in
     a trigger wider than its content the arrow sits at the end and everything
     before it (a logo, a label, a value) stays together at the start; never
     `justify-between`, which would also pull a logo away from its name.
     `triggerProps` cannot carry a `className`, because replacing the
     trigger's classes would override its `variant` and `size`.
   - A picker's trigger is named `{label} dropdown` unless `triggerProps`
     gives it an `id`: inside a `Field` the visible label names it, so never
     also pass an `aria-label` there. With `labelType="none"`, an empty
     single pick shows its `label` as a tertiary placeholder.

   Both are exported for a product list built on Ariakit's combobox (a
   settings row, an article field): it renders this trigger, so Escape
   behaves as in the pickers. `selectTriggerStyles` also dresses a popover
   disclosure that opens a picker-like panel (a date range, a row limit),
   which no picker can be.
---------------------------------------------------------------------------- */

const SELECT_TRIGGER_VARIANTS = {
	default:
		'touch-target label-sm flex cursor-pointer flex-nowrap items-center gap-2 rounded-lg bg-surface-elevated-1 px-3 py-2 text-primary hover:bg-surface-elevated-2 focus-visible:bg-surface-elevated-2 press-wash',
	filter:
		'touch-target label-sm relative flex min-h-6 cursor-pointer flex-nowrap items-center gap-2 rounded-md border border-medium px-2 py-0.5 text-primary hover:bg-hover-row focus-visible:bg-hover-row not-disabled:not-aria-disabled:active:bg-pressed-row aria-invalid:border-error',
	/* Input-style trigger for form-like filter panels: a bg-page field with the
	   field's outline (border-medium, border-strong on hover) and a
	   focus:border-brand indicator (outline-hidden is valid per the focus
	   rule — the border is the indicator). */
	input:
		'touch-target label-sm flex min-h-8 min-w-0 cursor-pointer items-center gap-1.5 hover-wash rounded-lg border border-medium bg-page bg-clip-padding px-3 py-1.5 text-primary outline-hidden not-focus:not-disabled:not-aria-disabled:not-aria-invalid:hover:border-strong focus:border-brand disabled:not-aria-busy:cursor-not-allowed disabled:not-aria-busy:border-disabled disabled:not-aria-busy:bg-disabled disabled:not-aria-busy:text-disabled aria-busy:cursor-progress aria-invalid:border-error aria-invalid:focus:border-error sheet:min-h-11 sheet:label-md'
} as const

export type SelectTriggerVariant = keyof typeof SELECT_TRIGGER_VARIANTS

/* Panel headers use 32px (md) controls everywhere. The
   md filter trigger mirrors Button md so selects line up with .csv/.png, and
   in a phone sheet's rows it is 44px like Button md. */
const SELECT_TRIGGER_MD_VARIANTS: Partial<Record<SelectTriggerVariant, string>> = {
	filter:
		'touch-target label-sm relative flex min-h-8 cursor-pointer flex-nowrap items-center gap-2 rounded-lg border border-medium px-3 py-1.5 text-primary hover:bg-hover-row focus-visible:bg-hover-row not-disabled:not-aria-disabled:active:bg-pressed-row disabled:not-aria-busy:cursor-not-allowed disabled:not-aria-busy:border-disabled disabled:not-aria-busy:text-disabled aria-busy:cursor-progress aria-invalid:border-error sheet:min-h-11 sheet:label-md'
}

export type SelectTriggerSize = 'sm' | 'md'

export function selectTriggerStyles(variant: SelectTriggerVariant, size: SelectTriggerSize): string {
	if (size === 'md') {
		return SELECT_TRIGGER_MD_VARIANTS[variant] ?? SELECT_TRIGGER_VARIANTS[variant]
	}
	return SELECT_TRIGGER_VARIANTS[variant]
}

/** Ariakit's ComboboxSelect, for every picker trigger. A list without a search field keeps focus on its trigger, inside
    any dialog around it. Ariakit closes the list on Escape and lets the key go on to that dialog, which closes too and
    drops its draft. While the list is open, the trigger takes Escape for the list alone, before Ariakit's own handler. */
export function ComboboxSelectTrigger(props: Ariakit.ComboboxSelectProps) {
	const store = Ariakit.useComboboxContext()!
	return (
		<Ariakit.ComboboxSelect
			{...props}
			onKeyDownCapture={(event) => {
				props.onKeyDownCapture?.(event)
				if (event.key !== 'Escape' || !store.getState().open) return
				event.stopPropagation()
				store.hide()
			}}
		/>
	)
}
