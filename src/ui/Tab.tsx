import type { ComponentPropsWithRef, ElementType } from 'react'

/* ----------------------------------------------------------------------------
   Tab navigation — page-level underline tabs ([LD 1.0] Tab Navigation,
   nodes 6183:148781 / 6183:355440).

   Item: label-md (14 Medium), px-3 py-2, inactive text-tertiary (secondary
   on hover), active = text-primary + 2px bg-brand underline bar with
   rounded top corners, inset 4px from the item edges.

   Wrap items in a row that draws the track:
   <nav className={tabTrackStyles}> <TabLink … data-active={bool}> </nav>
---------------------------------------------------------------------------- */

export const tabTrackStyles = 'flex thin-scrollbar w-full flex-nowrap overflow-x-auto border-b border-subtle'

type TabLinkProps<T extends ElementType> = {
	as?: T
	/** Layout placement only — never colors or spacing. */
	className?: string
} & Omit<ComponentPropsWithRef<T>, 'as' | 'className'>

export function TabLink<T extends ElementType = 'a'>({ as, className, ...props }: TabLinkProps<T>) {
	const Component = (as ?? 'a') as ElementType
	return (
		<Component
			className={`relative shrink-0 cursor-pointer px-3 py-2 label-md whitespace-nowrap text-tertiary after:absolute after:right-1 after:bottom-0 after:left-1 after:h-0.5 after:rounded-t-xs after:bg-brand after:opacity-0 hover:text-secondary focus-visible:text-secondary data-[active=true]:text-primary data-[active=true]:after:opacity-100 ${className ?? ''}`.trim()}
			{...props}
		/>
	)
}
