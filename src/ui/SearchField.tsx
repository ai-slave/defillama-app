import * as Ariakit from '@ariakit/react'
import type { ComponentPropsWithRef } from 'react'
import { Button } from './Button'
import { Icon } from './Icon'
import { Input } from './Input'
import { tw } from './tw'

/* ----------------------------------------------------------------------------
   SearchField — every search input: a 16px search icon, the Input recipe, an
   accessible `label`, and a small ghost × once there is text. Never hand-roll
   the icon, the field or a clear button beside a search input.

   Two modes:
   - Plain (the default): the caller holds the text in state and passes
     `value` / `onChange`.
   - `combobox`: the field is the Ariakit Combobox of the nearest
     ComboboxProvider (a popover search, an on-page search with results). The
     store owns the text, so the field reads it from the store, and the × sets
     it back to empty. Pass Combobox props (`autoSelect`, `placeholder`, `ref`,
     `disabled`) as on Ariakit.Combobox. A × that clears a pick, rather than the
     text, is the picker's own control beside the pick it clears.

   Clearing moves focus back to the field, because the button that had it
   disappears. `autoFocus` goes through Ariakit, so a dialog starts on the
   field instead of its ×; pickers pass `autoFocus={!isSmallScreen}`. A search
   in the page flow never autofocuses: it would skip keyboard and screen-reader
   users past the page above it and open a phone keyboard over the content.
   Escape is the host's: a combobox closes its list, and a field that closes
   itself (a collapsible toolbar search) handles it in `onKeyDown`.

   `width` places the field among toolbar controls; `className` is placement
   only (margins, flex), never colors, type or padding.
   - fill (default): the wrapper's own width, so the field stretches across a
     dialog, a panel or a column.
   - standalone: alone at the start of a table toolbar, up to 280px, pushing
     the rest to the end.
   - inline: a fixed 280px beside other toolbar controls, never shrinking; on
     a phone it takes the row's free width beside its neighbors.
   - flexible: shares the toolbar's free width, up to 280px.
---------------------------------------------------------------------------- */

const WIDTH_STYLES = {
	fill: '',
	standalone: tw`mr-auto w-full min-w-0 sm:max-w-[280px]`,
	inline: tw`w-full min-w-0 sm:w-[280px] sm:flex-none`,
	flexible: tw`w-full min-w-0 sm:max-w-[280px]`
} as const

type SharedProps = {
	/** The accessible name; the search icon and placeholder stand in for a visible label. */
	label: string
	width?: keyof typeof WIDTH_STYLES
	/** Layout placement only, on the wrapper (margins, flex). */
	className?: string
}

type SearchFieldProps =
	| (SharedProps & {
			combobox?: false
			value: string
			onChange: (value: string) => void
	  } & Omit<ComponentPropsWithRef<'input'>, 'className' | 'value' | 'onChange' | 'type' | 'aria-label' | 'width'>)
	| (SharedProps & { combobox: true } & Omit<
				Ariakit.ComboboxProps,
				'className' | 'render' | 'aria-label' | 'store' | 'width'
			>)

export function SearchField({ label, width = 'fill', className, ...props }: SearchFieldProps) {
	const store = Ariakit.useComboboxContext()
	const storeText = Ariakit.useStoreState(store, 'inputValue')
	// `=== true`: with strictNullChecks off, a truthiness test does not narrow the props union.
	const text = props.combobox === true ? storeText : props.value
	// 32px clears the icon (12px pad + 16px icon + 4px gap); pr-9 clears the ×.
	const inputClassName = `w-full pl-8 ${text ? 'pr-9' : ''}`
	let field
	if (props.combobox === true) {
		const { combobox: _, ...comboboxProps } = props
		field = <Ariakit.Combobox aria-label={label} render={<Input className={inputClassName} />} {...comboboxProps} />
	} else {
		const { combobox: _, value, onChange, autoFocus, ...inputProps } = props
		field = (
			<Ariakit.Focusable
				// On the Focusable, not the input: Ariakit's dialog picks its first focus from the Focusable's flag.
				autoFocus={autoFocus}
				render={
					<Input
						type="text"
						inputMode="search"
						enterKeyHint="search"
						aria-label={label}
						value={value}
						onChange={(event) => onChange(event.currentTarget.value)}
						className={inputClassName}
						{...inputProps}
					/>
				}
			/>
		)
	}
	return (
		<div className={`relative ${WIDTH_STYLES[width]} ${className ?? ''}`.trim()}>
			<Icon
				name="search"
				className="pointer-events-none absolute top-0 bottom-0 left-3 my-auto size-4 text-tertiary"
				aria-hidden="true"
			/>
			{field}
			{text ? (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					square
					aria-label="Clear search"
					className="absolute top-1/2 right-1.5 -translate-y-1/2"
					onClick={(event) => {
						if (props.combobox === true) store!.setInputValue('')
						else props.onChange('')
						event.currentTarget.parentElement?.querySelector('input')?.focus()
					}}
				>
					<Icon name="x" className="size-4" aria-hidden="true" />
				</Button>
			) : null}
		</div>
	)
}
