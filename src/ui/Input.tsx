import type { ComponentPropsWithRef } from 'react'

/* ----------------------------------------------------------------------------
   Input — the design.md text-input recipe.

   Field: 32px (min-h-8, padding-driven like Button md), bg-page on the
   surface it sits in, border-medium 1px, 8px radius, px-3 py-1.5. Entered
   text and placeholder are body-sm (text-primary / text-tertiary); focus
   swaps the border to brand. Mobile stays text-base below the sm breakpoint
   so iOS Safari does not zoom the page when the field focuses — sm:body-sm
   takes over from there (variant utilities sort after base ones, verified).

   Leading icon (optional, per the recipe's 16px icon + gap-1): wrap the
   field in a `relative` label, absolutely position a 16px icon at left-3,
   and give the field `pl-8` (12px pad + 16px icon + 4px gap). That pl-8 —
   like a `pr-*` clearing a trailing overlay — is placement for the overlay,
   not a spacing restyle, so it is allowed in `className`.

   `className` is otherwise LAYOUT PLACEMENT ONLY (w-full, m-3, shrink-0…),
   same contract as Button/Card. Different colors/type = a new variant to
   agree on in design.md, not a className override.

   For Ariakit hosts that render their own input (Ariakit.Combobox), pass
   `className={inputStyles}` (plus layout classes) instead of the component.
---------------------------------------------------------------------------- */

export const inputStyles =
	'min-h-8 rounded-lg border border-medium bg-page px-3 py-1.5 text-base text-primary placeholder:text-tertiary focus:border-brand focus:outline-hidden sm:body-sm'

export const searchFieldWrapperStyles = 'relative mr-auto w-full min-w-0 sm:max-w-[280px]'

export const searchFieldInlineWrapperStyles = 'relative w-full min-w-0 sm:w-[280px] sm:flex-none'

export const searchFieldFlexibleWrapperStyles = 'relative w-full min-w-0 sm:max-w-[280px]'

export const searchFieldIconStyles = 'pointer-events-none absolute top-0 bottom-0 left-3 my-auto text-tertiary'

export const searchFieldInputPlacementStyles = 'w-full pl-8'

export const searchFieldInputStyles = `${inputStyles} ${searchFieldInputPlacementStyles}`

type InputProps = {
	/** Layout placement only (w-full, m-3, overlay-clearing pl-8/pr-*) — never colors or type. */
	className?: string
} & Omit<ComponentPropsWithRef<'input'>, 'className'>

export function Input({ className, ...props }: InputProps) {
	return <input className={`${inputStyles} ${className ?? ''}`.trim()} {...props} />
}
