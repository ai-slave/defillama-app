import * as Ariakit from '@ariakit/react'
import { popoverDestructiveMenuItemStyles, popoverMenuItemStyles, popoverTreeRowStyles } from './Popover'
import { type SurfaceOwnProps, surfaceProps, surfaceTitleRow } from './PopoverSurface'

/* ----------------------------------------------------------------------------
   Menu surface — `Ariakit.Menu` with the popover surface contract wired in
   (see PopoverSurface.tsx for the variants). Menus anchor with `gutter={8}`
   (the default); `nested` flyouts pass `gutter={4}` and `portal` as the
   parent requires.

   A disclosure whose rows are actions (a chart's .png export, a table's
   Export menu) is a menu: MenuSurface with MenuItem rows, so arrow keys move
   between them. A preference toggle inside one is an
   `Ariakit.MenuItemCheckbox`.

   Rows are `MenuItem`. `row` picks the recipe: `menu` (default; px-3 py-2
   body-sm full-bleed, hover-row wash, 44px tall on phones) or `tree` (the
   indented hierarchy row used by the protocol switcher). Radio, checkbox
   and select rows use the Ariakit item with a recipe from ./Popover.ts.
   `className` is layout only, e.g. `border-b border-subtle` to group items.
   A destructive row passes `destructive`, its own red recipe, because an
   appended color class loses to the recipe's `text-primary`.
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
