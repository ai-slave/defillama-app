import * as Ariakit from '@ariakit/react'
import type { ComponentPropsWithRef } from 'react'
import { Check } from './internal/Check'

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
   multi-pick.

   A multi-pick tile passes `check="box"`: the 14px box trails the row,
   checked from `selected` (a tile's fill and its box never disagree), and
   dims with the tile when it is disabled.

   One pick from a set (a form field: an alert type, a banner's scope) passes
   `radio` with the option's value, inside an Ariakit RadioProvider and
   RadioGroup that hold the value. The tile is then a label over a native
   radio spread across it, as SegmentedControl's segments are, so arrow keys
   move and pick, the group is one tab stop, and the label's text names the
   radio. Every other prop (autoFocus, disabled, aria-description) goes to
   the radio, and keyboard focus on it draws the ring and wash on the tile.
   A button with `role="radio"` would only move focus on arrows. The radio's
   checked state draws the selected look (`has-checked`), so it takes no
   `selected`: the tile and the group's value never disagree. Content that
   follows the pick styles itself with `group-has-checked:`.

   `layout`: stack (title over description, left aligned), row (a leading
   indicator or icon beside the text), center (an icon over a centered
   label), compact (a small icon over a short label, four to a row in a
   narrow column: a chart type).
   A one-line choice is a SegmentedControl or a toggle Button, not a tile,
   unless each option is a sentence too long for a segment (a popover's
   "Bind cards": 3 cards that use Ethereum): then it is a `row` tile.
   `className` is for layout placement only (grid cell, width, height).
---------------------------------------------------------------------------- */

const LAYOUT = {
	stack: 'flex-col items-start gap-1 p-3 text-left',
	row: 'items-center gap-2.5 px-3 py-2 text-left',
	center: 'flex-col items-center gap-3 p-5 text-center',
	compact: 'flex-col items-center gap-0.5 p-1.5 text-center'
} as const

const TILE = 'group flex cursor-pointer rounded-lg text-primary'

type OptionTileProps = {
	layout: keyof typeof LAYOUT
	/** Layout placement only — never colors or spacing. */
	className?: string
} & (
	| ({ selected: boolean; check?: 'box' } & Omit<ComponentPropsWithRef<'button'>, 'className' | 'type'>)
	| ({ radio: string } & Omit<Ariakit.RadioProps, 'className' | 'value' | 'render'>)
)

export function OptionTile(props: OptionTileProps) {
	if ('radio' in props) {
		const { layout, className, radio, children, ...radioProps } = props
		return (
			<label
				className={`${TILE} relative border not-has-checked:border-medium not-has-checked:not-has-disabled:hover:bg-hover-row not-has-checked:not-has-disabled:active:bg-pressed-row has-checked:border-brand has-checked:bg-brand-muted has-focus-visible:focus-ring not-has-checked:has-focus-visible:bg-hover-row has-disabled:cursor-not-allowed has-disabled:border-disabled has-disabled:bg-disabled has-disabled:text-disabled ${LAYOUT[layout]} ${className ?? ''}`.trim()}
			>
				<Ariakit.Radio value={radio} className="absolute inset-0 cursor-[inherit] opacity-[0.00001]" {...radioProps} />
				{children}
			</label>
		)
	}
	const { selected, layout, check, className, children, ...buttonProps } = props
	return (
		<button
			// A tile picks an option; it never submits the form around it.
			type="button"
			data-active={selected}
			className={`${TILE} border not-data-[active=true]:border-medium not-data-[active=true]:not-disabled:hover:bg-hover-row not-data-[active=true]:focus-visible:bg-hover-row not-data-[active=true]:not-disabled:active:bg-pressed-row disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled disabled:text-disabled data-[active=true]:border-brand data-[active=true]:bg-brand-muted ${LAYOUT[layout]} ${className ?? ''}`.trim()}
			{...buttonProps}
		>
			{children}
			{check ? <Check kind="box" checked={selected} className="ml-auto" /> : null}
		</button>
	)
}
