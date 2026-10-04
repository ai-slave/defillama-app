import * as Ariakit from '@ariakit/react'
import { popoverDestructiveMenuItemStyles, popoverMenuItemStyles, popoverTreeRowStyles } from './Popover'
import { type SurfaceOwnProps, surfaceProps, surfaceTitleRow } from './PopoverSurface'

/* ----------------------------------------------------------------------------
   Menu surface — `Ariakit.Menu` with the popover surface contract wired in
   (see PopoverSurface.tsx for the variants). Menus anchor with `gutter={8}`;
   `nested` flyouts use `gutter={4}` and `portal={false}`-or-not as the parent
   requires — pass them explicitly.

   Rows are `MenuItem`. `row` picks the recipe: `menu` (default; px-3 py-2
   body-sm, hover wash, 44px touch target on phones), `tree` (the indented
   hierarchy row used by the protocol switcher), or `none` when the caller owns
   the whole row recipe (radio/checkbox rows, select rows). `className` is
   layout only, e.g. `border-b border-subtle` to group items; a destructive
   action passes `destructive`, because an appended color class loses to the
   recipe's `text-primary`.
---------------------------------------------------------------------------- */

type MenuSurfaceProps = SurfaceOwnProps & Omit<Ariakit.MenuProps, 'className' | 'wrapperProps' | 'title'>

export function MenuSurface({
	variant,
	className,
	heading,
	dismiss: _dismiss,
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
			{...surfaceProps(variant, { className })}
		>
			{surfaceTitleRow(heading)}
			{children}
		</Ariakit.Menu>
	)
}

type MenuItemRow = 'menu' | 'tree'

const ROW_STYLES: Record<MenuItemRow, string> = {
	menu: popoverMenuItemStyles,
	tree: popoverTreeRowStyles
}

type MenuItemProps = Ariakit.MenuItemProps & {
	row?: MenuItemRow
	/** Deletes or removes something: red text. */ destructive?: boolean
}

export function MenuItem({ row = 'menu', destructive = false, className, ...props }: MenuItemProps) {
	const recipe = destructive ? popoverDestructiveMenuItemStyles : ROW_STYLES[row]
	return <Ariakit.MenuItem {...props} className={className ? `${recipe} ${className}`.trim() : recipe} />
}
