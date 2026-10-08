import type { ComponentPropsWithRef } from 'react'
import { tw } from './tw'

/* ----------------------------------------------------------------------------
   Input — every single-line text field.

   Field: 32px (the min-h-8 floor decides; py-0.5 keeps the 16px phone text
   under it, like Button md), bg-page on the surface it sits in,
   border-medium 1px, 8px radius, px-3. Inside a phone sheet's rows the floor
   is 44px (`sheet:`), matching the sheet's footer buttons. Entered text and
   placeholder are body-sm (text-primary / text-tertiary); focus swaps the
   border to brand, and `aria-invalid` keeps it border-error while focused
   too, so callers never add their own error border. Entered text stays
   body-lg (16px) below the sm breakpoint so iOS Safari does not zoom the page
   when the field focuses (it reads the typed size only), while the
   placeholder drops to 14px on the same 24px line, so the hint reads as a
   hint; sm:body-sm takes over from there. The recipe sizes the
   placeholder; callers never do.

   Date fields are `<Input type="date" className="cursor-pointer dark:scheme-dark">`.
   Multiline fields use `textareaStyles`, never `inputStyles`.

   Search fields: SearchField (./SearchField.tsx) for a search with a clear
   button. A hand-built one renders `<Input className={searchFieldInputPlacementStyles}>`
   inside a wrapper; only Ariakit hosts (Combobox, ComboboxInput) take
   `searchFieldInputStyles`. Table searches pick one wrapper:
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

   For Ariakit hosts that render their own input (Ariakit.Combobox), pass
   `className={inputStyles}` (plus layout classes) instead of the component.
---------------------------------------------------------------------------- */

const fieldSurfaceStyles = tw`rounded-lg border border-medium bg-page px-3 body-lg text-primary placeholder:text-tertiary focus:border-brand focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-error aria-invalid:focus:border-error`

export const inputStyles = `${fieldSurfaceStyles} min-h-8 py-0.5 max-sm:placeholder:text-sm/6 sm:body-sm sheet:min-h-11`

/** Multiline prose needs the body ramp; callers own rows, resizing, and height limits. */
export const textareaStyles = `${fieldSurfaceStyles} py-2 max-sm:placeholder:text-sm/6 sm:body-md`

export const searchFieldWrapperStyles = tw`relative mr-auto w-full min-w-0 sm:max-w-[280px]`

export const searchFieldInlineWrapperStyles = tw`relative w-full min-w-0 sm:w-[280px] sm:flex-none`

export const searchFieldFlexibleWrapperStyles = tw`relative w-full min-w-0 sm:max-w-[280px]`

export const searchFieldIconStyles = tw`pointer-events-none absolute top-0 bottom-0 left-3 my-auto text-tertiary`

export const searchFieldInputPlacementStyles = tw`w-full pl-8`

export const searchFieldInputStyles = `${inputStyles} ${searchFieldInputPlacementStyles}`

type InputProps = {
	/** Layout placement only (w-full, m-3, overlay-clearing pl-8/pr-*) — never colors or type. */
	className?: string
} & Omit<ComponentPropsWithRef<'input'>, 'className'>

export function Input({ className, ...props }: InputProps) {
	return <input className={`${inputStyles} ${className ?? ''}`.trim()} {...props} />
}
