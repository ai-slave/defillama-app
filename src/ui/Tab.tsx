import type { ComponentPropsWithRef, ElementType } from 'react'
import { tw } from './tw'

/* ----------------------------------------------------------------------------
   Tab navigation — page-level underline tabs between routes. Content panels
   on one page use SegmentedControl `semantics="tabs"` instead.

   Item: label-md, px-3 py-2, inactive text-secondary (primary on hover),
   active = text-primary + 2px bg-brand underline bar with rounded top
   corners, inset 4px from the edges.

   Wrap items in a row that draws the track:
   <nav className={tabTrackStyles}> <TabLink … data-active={bool}> </nav>
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
			className={`relative shrink-0 cursor-pointer px-3 py-2 label-md whitespace-nowrap text-secondary after:absolute after:right-1 after:bottom-0 after:left-1 after:h-0.5 after:rounded-t-xs after:bg-brand after:opacity-0 hover:text-primary focus-visible:text-primary data-[active=true]:text-primary data-[active=true]:after:opacity-100 ${className ?? ''}`.trim()}
			{...props}
		/>
	)
}
