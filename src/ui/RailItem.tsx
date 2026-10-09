import type { ComponentPropsWithRef, ElementType } from 'react'

/* ----------------------------------------------------------------------------
   RailItem — one row of a vertical rail: a side nav, a table of contents or a
   criteria list. It is the vertical twin of TabLink.

   Item: label-sm, px-3 py-1.5, rounded-md, full width. Rest text-secondary;
   hover and focus take the neutral wash and text-primary; the selected row
   (`active`) sits on bg-brand-muted with text-link and takes no wash, like
   every other selected control.

   `active` only draws the row. The caller keeps the semantics that fit its
   job: `aria-current="page"` on route links, `aria-current="location"` on a
   table of contents, `aria-expanded` on a row that opens a group.

   Rows sit 2-4px apart, so on phones each row is 44px tall itself rather
   than carrying a touch-target overlay that would reach into its neighbours.

   Renders an `a` by default; pass `as={BasicLink}` for routes and
   `as="button" type="button"` for rows that act in place.
   `className` is for layout placement only.
---------------------------------------------------------------------------- */

type RailItemProps<T extends ElementType> = {
	as?: T
	active?: boolean
	/** Layout placement only — never colors or spacing. */
	className?: string
} & Omit<ComponentPropsWithRef<T>, 'as' | 'className'>

export function RailItem<T extends ElementType = 'a'>({ as, active = false, className, ...props }: RailItemProps<T>) {
	const Component = (as ?? 'a') as ElementType
	return (
		<Component
			data-active={active}
			className={`flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-left label-sm text-secondary not-data-[active=true]:hover:bg-hover-row not-data-[active=true]:hover:text-primary not-data-[active=true]:focus-visible:bg-hover-row not-data-[active=true]:focus-visible:text-primary not-data-[active=true]:active:bg-pressed-row data-[active=true]:bg-brand-muted data-[active=true]:text-link max-sm:min-h-11 ${className ?? ''}`.trim()}
			{...props}
		/>
	)
}
