import * as React from 'react'
import { NestedMenu } from '~/components/NestedMenu'
import { useIsClient } from '~/hooks/useIsClient'
import { useMedia } from '~/hooks/useMedia'

/* ----------------------------------------------------------------------------
   Page filters: a row of controls from `sm`, one "Filters" NestedMenu below
   it. `children(nestedMenu)` renders the same filters for either layout.

   In the phone filter menu every control is a full-width row at least 44px
   tall: selects and ranges are submenu rows, toggles are NestedMenuToggle
   check rows (arrow keys reach them), and actions are action rows. A
   segmented control there is `variant="responsive"` under a body-sm row
   label; the menu renders only below `sm`, where `responsive` stretches.

   The reset is ResetFiltersButton (./ResetFiltersButton.tsx): the menu's
   closing action row on phones, a toolbar Button on desktop. It always
   renders and is disabled while nothing is filtered, so the menu keeps its
   height when the first filter applies.
---------------------------------------------------------------------------- */

interface ResponsiveFilterLayoutProps {
	children: (nestedMenu: boolean) => React.ReactNode
	/** Additional className for the desktop wrapper div */
	desktopClassName?: string
}

export function ResponsiveFilterLayout({ children, desktopClassName }: ResponsiveFilterLayoutProps) {
	const isSmall = useMedia('(max-width: 639px)')
	const isClient = useIsClient()

	return (
		<>
			<div className="flex min-h-8 flex-wrap gap-2 *:flex-1 sm:hidden">
				{isSmall && isClient ? (
					<React.Suspense fallback={null}>
						<NestedMenu label="Filters" buttonVariant="filter" className="w-full">
							{children(true)}
						</NestedMenu>
					</React.Suspense>
				) : null}
			</div>
			<div className={desktopClassName ?? 'hidden min-h-8 flex-wrap gap-2 sm:flex'}>
				{!isSmall && isClient ? <React.Suspense fallback={null}>{children(false)}</React.Suspense> : null}
			</div>
		</>
	)
}
