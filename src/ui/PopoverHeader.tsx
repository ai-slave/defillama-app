import type { ReactNode } from 'react'

/* ----------------------------------------------------------------------------
   Popover header — the block above a popover list (design.md → Popover
   surface): a search field, then optional full-bleed rows such as a toggle
   that qualifies the selection. It owns every gap inside it, and one divider
   separates it from the list, so a surface reads as two groups: title and
   search, then the list. Selection actions (Select all) are list rows, not
   header controls.

   Below `sm` the header always sits under a drawer title row, which already
   leaves room above the field, so the field's top gap shrinks to 4px there.
   `inset="nested"` matches the phone nested-menu rows (16px sides, not 12px).
---------------------------------------------------------------------------- */

type PopoverHeaderInset = 'popover' | 'nested'

const SIDE_PADDING: Record<PopoverHeaderInset, string> = { popover: 'px-3', nested: 'px-4' }

export function PopoverHeader({
	search,
	children,
	inset = 'popover'
}: {
	search: ReactNode
	/** Full-bleed rows under the search field, e.g. a toggle. */
	children?: ReactNode
	inset?: PopoverHeaderInset
}) {
	return (
		<div className="flex shrink-0 flex-col overflow-hidden border-b border-subtle bg-overlay">
			{/* 12px frames the field unless a row follows; that row brings its own padding. */}
			<div className={`relative pt-3 max-sm:pt-1 ${SIDE_PADDING[inset]} ${children ? 'pb-1' : 'pb-3'}`}>{search}</div>
			{children}
		</div>
	)
}
