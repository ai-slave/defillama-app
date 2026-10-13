import * as Ariakit from '@ariakit/react'
import { BusyGlyph } from './Status'

/* ----------------------------------------------------------------------------
   ComboboxSelectTrigger — the trigger every picker renders, and its look,
   `selectTriggerStyles(variant, size)`.

   - Callers choose the trigger `variant` and `size`; product surfaces pin
     their own values instead of inheriting a default.
   - A picker's `className` is placement only (`ml-auto`, `w-full`,
     `flex-1`; policy: check-part-classes).
   - The trigger draws its own arrow, `DisclosureArrow`, after its
     children, so a caller never adds or restyles one. The arrow carries
     `ml-auto`, so in a trigger wider than its content the arrow sits at the
     end and everything before it (a logo, a label, a value) stays together
     at the start; never `justify-between`, which would also pull a logo away
     from its name. While the trigger is `aria-busy` a spinner takes the
     arrow's place. An icon-only trigger (the mobile Settings button) passes
     `arrow={false}`: it shows no value for an arrow to sit beside.
     `triggerProps` cannot carry a `className`, because replacing the
     trigger's classes would override its `variant` and `size`.
   - A picker's trigger is named `{label} dropdown` unless `triggerProps`
     gives it an `id`: inside a `Field` the visible label names it, so never
     also pass an `aria-label` there. With `labelType="none"`, an empty
     single pick shows its `label` as a tertiary placeholder.

   Both are exported for a list no picker can serve, built on Ariakit's
   combobox: one that loads its options when opened (an article's Trusted
   by field) or an icon-only trigger (the mobile Settings button). It
   renders this trigger, so Escape behaves as in the pickers. A short static
   list is a `Select`, even inside a `Field` (policy: hand-built-picker
   lists the allowed sites).

   PopoverSelectTrigger is the same trigger on a popover disclosure, for a
   picker-like panel no picker can be (a range, a date range, a row limit),
   so it matches the pickers beside it. A popover disclosure or menu button
   drawn as a `Button` that names a value or opens a list (a protocol
   switcher, a Filters button, an overflow menu of links) ends with
   `DisclosureArrow`; an action or icon button carries none. The
   hand-built-picker policy refuses Ariakit's arrows and
   `selectTriggerStyles` outside src/ui.
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

/** The arrow every trigger that opens a list or a picker-like panel ends with. Ariakit points it by the store's
    `placement`: down, or up for a `top-*` placement; a list that flips above for lack of room keeps it pointing down.
    It reads the combobox, popover or menu store from context, which each of those triggers has. */
export function DisclosureArrow() {
	return <Ariakit.PopoverDisclosureArrow className="ml-auto shrink-0 text-tertiary" />
}

/** Ariakit's ComboboxSelect, for every picker trigger. A list without a search field keeps focus on its trigger, inside
    any dialog around it; Ariakit's Escape closes that list alone and keeps the key from the dialog, so the dialog and
    its draft stay until a second Escape. */
export function ComboboxSelectTrigger({
	arrow = true,
	children,
	...props
}: Ariakit.ComboboxSelectProps & { arrow?: boolean }) {
	return (
		<Ariakit.ComboboxSelect {...props}>
			{children}
			{!arrow ? null : props['aria-busy'] ? (
				<span className="ml-auto text-tertiary">
					<BusyGlyph decorative size={14} />
				</span>
			) : (
				<DisclosureArrow />
			)}
		</Ariakit.ComboboxSelect>
	)
}

/** A popover disclosure dressed as a picker trigger, with its arrow. `className` is placement only. */
export function PopoverSelectTrigger({
	variant,
	size,
	className,
	children,
	...props
}: Omit<Ariakit.PopoverDisclosureProps, 'className' | 'render'> & {
	variant: SelectTriggerVariant
	size: SelectTriggerSize
	className?: string
}) {
	return (
		<Ariakit.PopoverDisclosure {...props} className={`${selectTriggerStyles(variant, size)} ${className ?? ''}`}>
			{children}
			<DisclosureArrow />
		</Ariakit.PopoverDisclosure>
	)
}
