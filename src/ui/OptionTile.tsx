import type { ComponentPropsWithRef } from 'react'

/* ----------------------------------------------------------------------------
   OptionTile — a selectable tile with more than one line: a title plus a
   description, an icon or a preview (table presets, grouping options,
   comparison metrics, newsletter choices).

   Rest: border-medium, transparent, the neutral wash on hover and the pressed
   wash while held. Selected (`selected`): border-brand on bg-brand-muted, the
   one selected look the app uses everywhere, and no wash. Disabled: the
   disabled border and fill.

   `selected` only draws the tile. The caller keeps the semantics of its job:
   `aria-pressed` for a toggle, `role="checkbox"` with `aria-checked` for a
   multi-pick, `role="radio"` with `aria-checked` inside a radiogroup.

   `layout`: stack (title over description, left aligned), row (a leading
   indicator or icon beside the text), center (an icon over a centered label).
   A one-line choice is a SegmentedControl or a toggle Button, not a tile.
   `className` is for layout placement only (grid cell, width, height).
---------------------------------------------------------------------------- */

const LAYOUT = {
	stack: 'flex-col items-start gap-1 p-3 text-left',
	row: 'items-center gap-2.5 px-3 py-2 text-left',
	center: 'flex-col items-center gap-3 p-5 text-center'
} as const

type OptionTileProps = {
	selected: boolean
	layout: keyof typeof LAYOUT
	/** Layout placement only — never colors or spacing. */
	className?: string
} & Omit<ComponentPropsWithRef<'button'>, 'className' | 'type'>

export function OptionTile({ selected, layout, className, ...props }: OptionTileProps) {
	return (
		<button
			// A tile picks an option; it never submits the form around it.
			type="button"
			data-active={selected}
			className={`flex cursor-pointer rounded-lg border text-primary not-data-[active=true]:border-medium not-data-[active=true]:not-disabled:hover:bg-hover-row not-data-[active=true]:focus-visible:bg-hover-row not-data-[active=true]:not-disabled:active:bg-pressed-row disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled disabled:text-disabled data-[active=true]:border-brand data-[active=true]:bg-brand-muted ${LAYOUT[layout]} ${className ?? ''}`.trim()}
			{...props}
		/>
	)
}
