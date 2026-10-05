import type { ComponentPropsWithRef, ElementType } from 'react'
import { tw } from './tw'

/* ----------------------------------------------------------------------------
   Tab — the underline tab look, and which tab look goes where.

   Two looks, picked by where the tabs sit:
   - Underline (this file): tabs that head a page section. Route navigation
     between pages, and full-width panel tabs over a page section
     (`ViewTabs`, or `Tab` from ./Tabs with `render={<TabLink as="button" />}`).
   - Segmented (`SegmentedControl semantics="tabs"`): panel tabs that belong
     to a card, panel, dialog or toolbar header.
   A value picker is never drawn as tabs; it is a radio `SegmentedControl`.
   Underline panel tabs are `ViewTabs`; render `Tab` with `TabLink` by hand
   only when the items carry icons or counts.

   Item: label-md, px-3 py-2, inactive text-secondary (primary on hover),
   active = text-primary + 2px bg-brand underline bar with rounded top
   corners, inset 4px from the edges.

   Route navigation: a `<nav aria-label>` draws the track, and the current
   page's item carries `aria-current="page"`, which also draws it active:
   <nav className={tabTrackStyles} aria-label="…"> <TabLink href … aria-current={…}> </nav>
   Panel tabs get `data-active` from `Tab` instead.
---------------------------------------------------------------------------- */

export const tabTrackStyles = tw`flex w-full flex-nowrap overflow-x-auto border-b border-subtle`

type TabLinkProps<T extends ElementType> = {
	as?: T
	/** Layout placement only — never colors or spacing. */
	className?: string
} & Omit<ComponentPropsWithRef<T>, 'as' | 'className'>

export function TabLink<T extends ElementType = 'a'>({ as, className, ...props }: TabLinkProps<T>) {
	const Component = (as ?? 'a') as ElementType
	return (
		<Component
			className={`relative shrink-0 cursor-pointer px-3 py-2 label-md whitespace-nowrap text-secondary after:absolute after:right-1 after:bottom-0 after:left-1 after:h-0.5 after:rounded-t-xs after:bg-brand after:opacity-0 hover:text-primary focus-visible:text-primary aria-[current=page]:text-primary aria-[current=page]:after:opacity-100 data-[active=true]:text-primary data-[active=true]:after:opacity-100 ${className ?? ''}`.trim()}
			{...props}
		/>
	)
}
