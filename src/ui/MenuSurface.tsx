import * as Ariakit from '@ariakit/react'
import { popoverMenuItemStyles, popoverTreeRowStyles } from './Popover'
import { type SurfaceOwnProps, surfaceDismiss, surfaceProps } from './PopoverSurface'

/* ----------------------------------------------------------------------------
   Menu surface — `Ariakit.Menu` with the popover surface contract wired in
   (see PopoverSurface.tsx for the variants). Menus anchor with `gutter={8}`;
   `nested` flyouts use `gutter={4}` and `portal={false}`-or-not as the parent
   requires — pass them explicitly.

   Rows are `MenuItem`. `row` picks the recipe: `menu` (default; px-3 py-2
   body-sm, hover wash, 44px touch target on phones), `tree` (the indented
   hierarchy row used by the protocol switcher), or `none` when the caller owns
   the whole row recipe (radio/checkbox rows, select rows). `className` is
   layout only, e.g. `border-b border-subtle` to group items or `text-data-down`
   for a destructive action.
---------------------------------------------------------------------------- */

type MenuSurfaceProps = SurfaceOwnProps & Omit<Ariakit.MenuProps, 'className' | 'wrapperProps'>

export function MenuSurface({
	variant,
	className,
	wrapperClassName,
	dismissLabel = 'Close menu',
	dismiss = 'auto',
	children,
	gutter = 8,
	portal = true,
	unmountOnHide = true,
	...props
}: MenuSurfaceProps) {
	return (
		<Ariakit.Menu
			{...props}
			gutter={gutter}
			portal={portal}
			unmountOnHide={unmountOnHide}
			{...surfaceProps({ variant, className, wrapperClassName })}
		>
			{surfaceDismiss(variant, dismissLabel, dismiss)}
			{children}
		</Ariakit.Menu>
	)
}

type MenuItemRow = 'menu' | 'tree' | 'none'

const ROW_STYLES: Record<MenuItemRow, string> = {
	menu: popoverMenuItemStyles,
	tree: popoverTreeRowStyles,
	none: ''
}

type MenuItemProps = Ariakit.MenuItemProps & { row?: MenuItemRow }

export function MenuItem({ row = 'menu', className, ...props }: MenuItemProps) {
	const recipe = ROW_STYLES[row]
	return <Ariakit.MenuItem {...props} className={className ? `${recipe} ${className}`.trim() : recipe} />
}

export function MenuSeparator(props: Omit<Ariakit.MenuSeparatorProps, 'className'>) {
	return <Ariakit.MenuSeparator {...props} className="border-t border-subtle" />
}
