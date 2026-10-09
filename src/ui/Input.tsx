import { type ComponentPropsWithRef, type ReactNode, useId } from 'react'
import { tw } from './tw'

/* ----------------------------------------------------------------------------
   Input — every single-line text field.

   Field: 32px (the min-h-8 floor decides; py-0.5 keeps the 16px phone text
   under it, like Button md), bg-page on the surface it sits in,
   border-medium 1px like the controls beside it, darkening to border-strong
   on hover; bg-clip-padding keeps the darker field fill from showing through
   the translucent border, so the edge matches its neighbours exactly;
   8px radius, px-3. The outline is faint, so a field is identified
   by what it carries: a visible label above it, or a search icon with a
   placeholder; never ship a bare box. Inside a phone sheet's rows the floor
   is 44px (`sheet:`), matching the sheet's footer buttons. Entered text and
   placeholder are body-sm (text-primary / text-tertiary); focus swaps the
   border to brand, and `aria-invalid` keeps it border-error while focused
   too, so callers never add their own error border. Only `aria-invalid`
   turns it red, which Field (./Field.tsx) sets once a submit shows the
   error; the browser's own `:user-invalid` never does, because it fires on
   blur, before the reader has asked to submit. A field that locks but
   must keep focus is `readOnly` plus `aria-disabled` (a limit reached: the
   disabled look) or plus `aria-busy` (its own save running: it keeps its look
   with the progress cursor, like a pending Button). Entered text stays
   body-lg (16px) below the sm breakpoint so iOS Safari does not zoom the page
   when the field focuses (it reads the typed size only), while the
   placeholder drops to 14px on the same 24px line, so the hint reads as a
   hint; sm:body-sm takes over from there. The recipe sizes the
   placeholder; callers never do.

   Date fields are `<Input type="date" className="cursor-pointer dark:scheme-dark">`.
   Multiline fields are `Textarea`. Code, hex colors, addresses and formulas
   take `variant="code"` on either: the same field in the mono family at the
   same sizes, so phones still get 16px. A verification code is
   `<Input variant="oneTimeCode">`. Fixed text inside the box (a URL prefix,
   a unit) is `prefix` / `suffix`: the box then draws around the text and the
   value, with the recipe's hover, focus and error, because a wrapper's own
   :focus never fires. Variants are props, never recipe strings glued to a
   raw element, so a caller's class can never fight the recipe's.

   Every field renders with an id, its own when the caller (Field, an
   Ariakit host) passes one, else a generated one, so the browser never
   reports a field it cannot tell apart from the others.

   Search fields: SearchField (./SearchField.tsx) for a search with a clear
   button. A hand-built one renders `<Input className={searchFieldInputPlacementStyles}>`
   inside a wrapper; an Ariakit host (Combobox, ComboboxInput) renders the
   same Input through `render`. Table searches pick one wrapper:
   `searchFieldWrapperStyles` (standalone, left-anchored),
   `searchFieldInlineWrapperStyles` (fixed 280px beside other toolbar
   controls, never shrinks), or `searchFieldFlexibleWrapperStyles` (shares
   the remaining toolbar width). Never copy a page-local
   `sm:max-w-[280px]` wrapper.

   Leading icon (optional, per the recipe's 16px icon + gap-1): wrap the
   field in a `relative` label, absolutely position a 16px icon at left-3,
   and give the field `pl-8` (12px pad + 16px icon + 4px gap). That pl-8 —
   like a `pr-*` clearing a trailing overlay — is placement for the overlay,
   not a spacing restyle, so it is allowed in `className`.

   `className` is otherwise LAYOUT PLACEMENT ONLY (w-full, m-3, shrink-0…),
   same contract as Button/Card. Different colors or type are a new variant
   in this file, not a className override.

   An Ariakit host that renders its own input (Ariakit.Combobox) renders the
   component: `render={<Input />}`. A pick is a Select, never a native
   select element or a button drawn as a field.
---------------------------------------------------------------------------- */

const fieldSurfaceStyles = tw`rounded-lg border border-medium bg-page bg-clip-padding px-3 body-lg text-primary placeholder:text-tertiary not-focus:not-disabled:not-aria-disabled:not-aria-invalid:hover:border-strong focus:border-brand focus:outline-hidden disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled disabled:text-disabled aria-busy:cursor-progress aria-disabled:cursor-not-allowed aria-disabled:border-disabled aria-disabled:bg-disabled aria-disabled:text-disabled aria-invalid:border-error aria-invalid:focus:border-error`

const inputStyles = `${fieldSurfaceStyles} min-h-8 py-0.5 max-sm:placeholder:text-sm/6 sm:body-sm sheet:min-h-11`

/** Multiline prose needs the body ramp; callers own rows, resizing, and height limits. */
const textareaStyles = `${fieldSurfaceStyles} py-2 max-sm:placeholder:text-sm/6 sm:body-md`

// Built on the surface, not inputStyles: its sm:body-sm would set Inter back on desktop.
const codeInputStyles = `${fieldSurfaceStyles} min-h-8 py-0.5 max-sm:font-mono max-sm:placeholder:text-sm/6 sm:mono-md sheet:min-h-11`

const codeTextareaStyles = `${fieldSurfaceStyles} py-2 max-sm:font-mono max-sm:placeholder:text-sm/6 sm:mono-md`

/** A one-time code (email verification, account link): centred digits spaced apart, the hint at normal spacing. */
const oneTimeCodeInputStyles = `${inputStyles} text-center tracking-[0.4em] placeholder:tracking-normal`

/* A field with fixed text inside its box (a URL prefix, a unit): the frame draws the recipe's box, hover, focus and
   error around a borderless `fieldFrameInputStyles` input, because a wrapper's own :focus never fires. */
const fieldFrameStyles = tw`flex min-h-8 min-w-0 cursor-text items-center gap-1 rounded-lg border border-medium bg-page bg-clip-padding px-3 body-lg text-primary focus-within:border-brand not-focus-within:not-has-[:disabled,[aria-disabled=true],[aria-invalid=true]]:hover:border-strong has-[:disabled,[aria-disabled=true]]:cursor-not-allowed has-[:disabled,[aria-disabled=true]]:border-disabled has-[:disabled,[aria-disabled=true]]:bg-disabled has-[:disabled,[aria-disabled=true]]:text-disabled has-[[aria-busy=true]]:cursor-progress has-[[aria-invalid=true]]:border-error sm:body-sm sheet:min-h-11`

// [font:inherit] takes the frame's type: the base layer sets every input to text-sm, which would put 14px beside a
// 16px prefix on phones and let iOS zoom on focus.
const fieldFrameInputStyles = tw`min-w-0 flex-1 cursor-[inherit] bg-transparent py-0.5 text-inherit outline-hidden [font:inherit] placeholder:text-tertiary`

export const searchFieldWrapperStyles = tw`relative mr-auto w-full min-w-0 sm:max-w-[280px]`

export const searchFieldInlineWrapperStyles = tw`relative w-full min-w-0 sm:w-[280px] sm:flex-none`

export const searchFieldFlexibleWrapperStyles = tw`relative w-full min-w-0 sm:max-w-[280px]`

export const searchFieldIconStyles = tw`pointer-events-none absolute top-0 bottom-0 left-3 my-auto text-tertiary`

export const searchFieldInputPlacementStyles = tw`w-full pl-8`

/* A rename in place (a query tab, a saved row): the field takes the label's own type and stands where the label was,
   24px inside a 32px row, with a brand ring marking it as editing. A rename with room for a full field (a sidebar row
   at 36px or more) stays the text variant. */
const inlineInputStyles = tw`min-w-0 rounded-sm bg-page px-1 py-px text-primary ring-1 ring-brand outline-hidden [font:inherit]`
const INPUT_VARIANTS = {
	text: inputStyles,
	code: codeInputStyles,
	oneTimeCode: oneTimeCodeInputStyles,
	inline: inlineInputStyles
} as const

type InputProps = (
	| {
			/** text (default); code for addresses, hex colors and formulas (mono at the same sizes); oneTimeCode for a
			    verification code (centred, spaced digits); inline for a rename in place inside a tab or a dense row. */
			variant?: keyof typeof INPUT_VARIANTS
			prefix?: never
			suffix?: never
	  }
	| {
			variant?: 'text'
			/** Fixed text inside the box before or after the value: a URL prefix, a unit. The box then draws around both
			    and `className` lands on it. */
			prefix?: ReactNode
			suffix?: ReactNode
	  }
) & {
	/** Layout placement only (w-full, m-3, overlay-clearing pl-8/pr-*) — never colors or type. */
	className?: string
} & Omit<ComponentPropsWithRef<'input'>, 'className' | 'prefix'>

export function Input({ variant = 'text', prefix, suffix, className, id, ...props }: InputProps) {
	// Every field gets an id, so the browser can tell fields apart for autofill. Field and Ariakit hosts pass their own.
	// An id rather than a generated `name`, which would add a key to a form's submitted data.
	const fallbackId = useId()
	if (prefix == null && suffix == null)
		return <input id={id ?? fallbackId} className={`${INPUT_VARIANTS[variant]} ${className ?? ''}`.trim()} {...props} />
	// A div, not a label: the Field's own label names the input, and a second wrapping label would add the prefix to
	// that name. A press on the fixed text moves focus into the input, as a label would, with the caret on the side
	// that was pressed (Radix Themes' text field does the same); a link or button inside the text keeps its press.
	return (
		<div
			role="presentation"
			className={`${fieldFrameStyles} ${className ?? ''}`.trim()}
			onMouseDown={(event) => {
				const target = event.target as HTMLElement
				if (target.closest('input, button, a')) return
				event.preventDefault()
				const input = event.currentTarget.querySelector('input')!
				input.focus()
				// setSelectionRange throws on email and number inputs; their caret stays where focus puts it.
				if (!/^(text|search|url|tel|password)$/.test(input.type)) return
				const caret = target.closest('[data-slot="suffix"]') ? input.value.length : 0
				input.setSelectionRange(caret, caret)
			}}
		>
			{prefix != null ? (
				<span data-slot="prefix" className="shrink-0 text-tertiary">
					{prefix}
				</span>
			) : null}
			<input id={id ?? fallbackId} className={fieldFrameInputStyles} {...props} />
			{suffix != null ? (
				<span data-slot="suffix" className="shrink-0 text-tertiary">
					{suffix}
				</span>
			) : null}
		</div>
	)
}

const TEXTAREA_VARIANTS = {
	prose: textareaStyles,
	code: codeTextareaStyles
} as const

type TextareaProps = {
	/** prose (default) on the body ramp; code in the mono family (CSV, SQL, embed snippets). */
	variant?: keyof typeof TEXTAREA_VARIANTS
	/** Layout placement, rows' height limits and resizing (w-full, min-h-*, resize-none) — never colors or type. */
	className?: string
} & Omit<ComponentPropsWithRef<'textarea'>, 'className'>

/** Every multiline field. Callers own rows, resizing and height limits. */
export function Textarea({ variant = 'prose', className, id, ...props }: TextareaProps) {
	const fallbackId = useId()
	return (
		<textarea id={id ?? fallbackId} className={`${TEXTAREA_VARIANTS[variant]} ${className ?? ''}`.trim()} {...props} />
	)
}
