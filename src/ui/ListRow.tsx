import type { ComponentPropsWithRef, ElementType } from 'react'
import { Check } from './internal/Check'

/* ----------------------------------------------------------------------------
   ListRow — one full-width row in a list inside a dialog or panel that picks
   or opens one item: a dashboard to add to, a search match, a token, a chart
   to insert, an alert run. Rows inside a popover or menu are MenuItem and
   PopoverRow (./PopoverSurface.tsx) instead; those bleed to its edges.

   Row: rounded-md, px-3 py-2, body-sm text-primary, the neutral wash on hover,
   focus and keyboard highlight (Ariakit's data-active-item), the pressed wash
   while held. The picked row (`selected`) sits on bg-brand-muted and takes no
   wash. A row that marks its pick with a check passes `check`: `box` (a
   multi pick) leads the row, `tick` (a single pick) trails it in a slot that
   stays in place when empty, so labels never shift. A disabled row dims its
   box. The mark follows `selected`; a row that takes the check alone, because
   the fill would mark the keyboard highlight too, passes `checked` instead.
   `nested` indents a child row under its parent (a protocol under its
   parent protocol) by 20px more.

   `selected` only draws the row. The caller keeps the semantics of its job:
   `aria-pressed` on a toggle row, `aria-selected` on a listbox option,
   `aria-current` on the open item. Busy and disabled rows keep the
   aria-busy / aria-disabled model of Button.

   Renders a `button` by default (type="button"); pass `as` for a link or an
   Ariakit item. `className` is for layout placement and inner layout (grid
   columns, gap, min-h for a thumbnail row), never colors or padding.
---------------------------------------------------------------------------- */

type ListRowProps<T extends ElementType> = {
	as?: T
	selected?: boolean
	nested?: boolean
	check?: 'box' | 'tick'
	checked?: boolean
	className?: string
} & Omit<ComponentPropsWithRef<T>, 'as' | 'className'>

export function ListRow<T extends ElementType = 'button'>({
	as,
	selected = false,
	nested = false,
	check,
	checked = selected,
	className,
	children,
	...props
}: ListRowProps<T>) {
	const Component = (as ?? 'button') as ElementType
	return (
		<Component
			{...(as ? {} : { type: 'button' })}
			data-active={selected}
			className={`${check ? 'group ' : ''}flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md py-2 pr-3 ${nested ? 'pl-8' : 'pl-3'} text-left body-sm text-primary not-data-[active=true]:not-aria-disabled:hover:bg-hover-row not-data-[active=true]:focus-visible:bg-hover-row not-data-[active=true]:not-aria-disabled:active:bg-pressed-row aria-busy:cursor-progress aria-disabled:not-aria-busy:cursor-not-allowed aria-disabled:not-aria-busy:text-disabled not-data-[active=true]:data-active-item:bg-hover-row data-focus-visible:focus-ring data-[active=true]:bg-brand-muted ${className ?? ''}`.trim()}
			{...props}
		>
			{check === 'box' ? <Check kind="box" checked={checked} /> : null}
			{children}
			{check === 'tick' ? <Check kind="tick" checked={checked} className="ml-auto" /> : null}
		</Component>
	)
}
