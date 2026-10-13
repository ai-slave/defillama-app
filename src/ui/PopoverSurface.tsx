import * as Ariakit from '@ariakit/react'
import { type ReactNode, useCallback } from 'react'
import { useMedia } from '~/hooks/useMedia'
import { Button } from './Button'
import { catchLostFocus } from './focus'
import { Icon } from './Icon'
import { Check } from './internal/Check'
import {
	menuItemRowStyles,
	popoverScrollAreaStyles,
	SURFACE_WIDTH_LADDER,
	surfaceMotionStyles
} from './internal/Popover'
import { Tooltip } from './Tooltip'
import { tw } from './tw'

/* ----------------------------------------------------------------------------
   Anchored popover surfaces: PopoverSurface, ComboboxSurface, and
   MenuSurface. New surfaces use them, never a raw
   `Ariakit.Menu`, `Ariakit.Popover` or `Ariakit.ComboboxPopover`; the
   `raw-popover-surface` rule in check-design-tokens.mjs counts direct
   renders outside src/ui. A raw surface stays only where no variant can
   anchor or theme it: popovers that follow a text caret or a selection, and
   menus on the always-dark subscription surfaces.

   A surface is three things wired together: the surface recipe, the mobile
   drawer wrapper (bottom sheet + scrim below `sm`), and the drawer's close
   button. These components own all three so a call site only chooses a
   `variant`:

     actions — a short, fixed set of actions. Fits its content on phones
               (capped at the drawer height), no close button: the scrim tap
               and Escape close it. Export menus, row overflow menus.
     panel   — content-sized like `actions`, with a title row. Small
               forms and controls where a user may be mid-task: date pickers,
               save-view forms, annotation editors.
     list    — the tall drawer (reserved height on phones, 400px on desktop)
               with a title row. Selects, comboboxes, searchable lists.

   On phones a `panel` or `list` drawer opens with a title row: its required
   `heading` beside the close button, so the sheet says what it is. From `sm`
   the popover sits under its trigger, which already names it, so the row is
   hidden; the heading still labels the surface. `dismiss="own"` is for a
   surface that renders its own header row with `<DrawerDismiss>` inside it.
     nested  — a submenu flyout opened from inside another surface. Slides in
               from the right on phones over the parent sheet, so it has no
               scrim of its own and no close button: the caller renders the
               back/title/close header (see NestedMenu).

   Every phone drawer uses the dialogs' sheet height, `--sheet-height` in
   src/tailwind.css: `list` and `nested` fill it, `actions` and `panel` cap
   at it, so a picker opened over a dialog sheet lines up with it. The
   drawer shape applies only below `sm`; from `sm` every surface stays
   anchored to its trigger. A phone drawer is modal: the page under it
   neither scrolls nor takes focus. Search results and anchored popovers
   from `sm` stay non-modal. A call site passes `modal` only to keep one
   behavior at every width. A drawer's close or back button is the 32px
   ghost Button with a 44px hit area, placed so its icon lands on the
   content edge (12px, 16px in nested menus). Drawer animations own their
   transform: never add `transform-none` to an animated drawer surface.

   ComboboxSurface also supports `search-results`: input-anchored results at
   every breakpoint, with no drawer, scrim, or dismiss button. A combobox
   whose input sits on the page (site search, lookups, chip-based
   multi-selects) uses `search-results`, never `list` or `panel`, because a
   phone drawer would cover the field being typed into. That field stays
   the only search input; never add a second one inside the results.
   Chip-based multi-selects anchor the results to the whole chip-and-input
   container, so adding chips never narrows the list. Results that are
   always visible use an inline `Ariakit.ComboboxList` in the page flow.

   Surface: bg-overlay, border-medium, rounded-xl, the `shadow-overlay`
   token, no padding. The surface owns background, border, radius and
   overflow; search blocks (PopoverHeader), rows, action rows and footers own
   their spacing. Action and footer rows stay inside the popover width with
   row-owned padding and `min-w-0` flex or grid sizing.

   Every surface sits on the dialogs' layer, z-50, and the one opened last is
   added to the page last, so it paints on top: a picker over the dialog that
   hosts it, a flyout over its parent menu. Width is `width`, never a
   class; `className` is placement only. Never override the surface
   stacking, shadow, padding, colors or radius. Results that match their
   input's width pass `sameWidth`: surfaces portal to body by default
   (`portal={false}` opts out), so a width on the wrapper would size them to
   the viewport.

   Gutters: PopoverSurface and ComboboxSurface default to `gutter={6}`,
   MenuSurface to 8, nested flyouts pass 4; Tooltip keeps Ariakit's default.

   A PopoverSurface carries the dialogs' lost-focus net (catchLostFocus in
   ./focus.ts): a control removed or disabled inside it hands focus to the
   surface's first control, never to the page. The net is the floor; a row
   that leaves still hands focus to its neighbor (focusNeighborOnLeave).

   MenuSurface is `Ariakit.Menu` with the surface contract wired in. Menus
   anchor with `gutter={8}` (the default); `nested` flyouts pass `gutter={4}`
   and `portal` as the parent requires.

   Keyboard: a menu opens on its first row. A PopoverSurface opens on its
   first control (on phones the drawer's close button); a definition or a
   control with a tooltip there stays closed, since Tooltip ignores focus
   that code moved. A ComboboxSurface keeps focus in its field. Each
   Escape closes the innermost open layer and hands focus to what opened
   it: a `nested` flyout closes alone, back to its row, where Ariakit
   would close the whole menu.

   A disclosure whose rows are actions (a chart's .png export, a table's
   Export menu) is a menu: MenuSurface with MenuItem rows, so arrow keys move
   between them. A preference toggle inside one is a
   `MenuItem kind="checkbox"`.

   Rows are parts, never class strings. In a menu, `MenuItem`: `kind`
   picks the job. `action` (default) runs a command; `row` picks its recipe:
   `menu` (px-3 py-2 body-sm full-bleed, hover-row wash, 44px tall on
   phones), or the hierarchy rows of the protocol switcher, `tree` for the
   top row and `tree-child` for a row under it, indented and drawn with its
   connector line. `radio` picks one of a group (Ariakit's MenuItemRadio,
   announced as a checked or unchecked menuitemradio, with a trailing link
   check) and `checkbox` toggles a preference (MenuItemCheckbox, a trailing
   box); both follow `checked` or the menu store's `values`. `submenu`
   opens a nested menu (an `Ariakit.MenuButton` by default, or the `render`
   given, such as a PopoverDisclosure) and draws the trailing chevron. Outside a menu, a row
   is `PopoverRow`: a combobox option through
   `render={<Ariakit.ComboboxItem value={…} />}`, a button, a dismiss. It
   takes `check` (`box` for a multi pick, `tick` for a single pick) with
   `checked`, and `variant="action"` for a link-colored row that acts on
   the list (See more…). Every row has the same focus ring, active-item
   wash, disabled colors and 44px phone height. A row takes no className:
   its children lay out on the row's 8px gap, and a trailing hint or icon
   takes `ml-auto` to sit on the right edge. A destructive menu row passes
   `destructive`, its own red recipe. Groups of rows in a menu are split by
   `MenuSeparator`, never a border on a row.

   The rows sit in `PopoverList`, the scrolling slot under the title row
   and PopoverHeader (render an `Ariakit.ComboboxList` through it);
   `divided` rules a hairline between its rows. The closing action under a
   list is `PopoverFooterAction`, `inset` matching the rows above it.

   `width` sizes a surface on desktop: `fit` (default, content from 180px),
   `sm` 240px, `md` 320px, `lg` 384px (the ladder Hovercard shares),
   `xl` 600px, `trigger` as wide as the field that opens it (at least
   256px). `xl` takes effect only on `list` surfaces and search results:
   `actions`, `panel` and `nested` cap at 448px (`sm:max-w-md`). Phone
   drawers are full width whatever it says. Search results cap their height with
   `maxHeight` (`sm` 160px, `md` 288px, `lg` 400px, `screen` 60vh for the
   site search).

   Every surface unmounts its content on hide, like the dialogs and tooltips
   in this repo and the shared Select. Pass `unmountOnHide={false}` only with
   a comment saying why: a nav menu that must open instantly on a phone, or
   state that has to survive a close. Note that a closed ComboboxSelect only
   does type-ahead over mounted options; the shared Select never had that, so
   it is not a reason on its own. A kept surface renders its content only once
   `useDeferredValue(true, false) || open` holds (OtherLinks): built in a
   background render after hydration, never inside it, and at once when a tap
   comes first. Content of hundreds of nodes sits behind a second
   `useDeferredValue` of that value (the phone nav Menu), so an early tap
   paints the surface and its header first and the rest fills in during the
   open animation.
---------------------------------------------------------------------------- */

/* The surface recipes and the drawer wrapper live here, unexported, so
   nothing outside src/ui can wire a drawer by hand: the only way to get the
   surface + wrapper + close button triple is one of the components below. */

/* Phone drawers share the dialog sheets' height (--sheet-height in tailwind.css) and stay pinned to the bottom with the
   iOS keyboard open: they pad by --keyboard-inset, which useKeyboardInset (mounted in _app) publishes because iOS
   Safari does not take the keyboard off the page, so their fill covers the strip behind it. */
const selectSurfaceHeightStyles =
	'max-sm:h-(--sheet-height) max-sm:w-full! max-sm:max-w-none! max-sm:drawer max-sm:rounded-b-none max-sm:pb-[max(env(safe-area-inset-bottom),var(--keyboard-inset,0px))] sm:max-h-[min(400px,var(--popover-available-height))]'

const menuSurfaceHeightStyles =
	'max-sm:max-h-(--sheet-height) max-sm:w-full! max-sm:max-w-none! max-sm:drawer max-sm:rounded-b-none max-sm:pb-[max(env(safe-area-inset-bottom),var(--keyboard-inset,0px))] sm:max-h-[min(60dvh,var(--popover-available-height))]'

const nestedMenuSurfaceHeightStyles =
	'max-sm:h-(--sheet-height) max-sm:w-full! max-sm:max-w-none! max-sm:rounded-b-none max-sm:pb-(--keyboard-inset,0px) sm:max-h-[min(60dvh,var(--popover-available-height))]'

const popoverSurfaceStyles = `z-50 flex min-w-[180px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay px-0 py-0 shadow-overlay ${selectSurfaceHeightStyles} ${surfaceMotionStyles}`

const menuSurfaceStyles = `z-50 flex min-w-[180px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay px-0 py-0 sm:max-w-md shadow-overlay ${menuSurfaceHeightStyles} ${surfaceMotionStyles}`

const nestedMenuSurfaceStyles = `z-50 flex min-w-[180px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay px-0 py-0 sm:max-w-md shadow-overlay ${nestedMenuSurfaceHeightStyles} ${surfaceMotionStyles}`

/* Below sm the positioning wrapper pins every surface to the bottom as a drawer. */
const drawerWrapperClassName = tw`max-sm:fixed! max-sm:top-auto! max-sm:right-0! max-sm:bottom-0! max-sm:left-0! max-sm:w-full! max-sm:transform-none!`

// The row's 4px plus the close button's 8px inset puts the x on the 12px content edge.
const drawerTitleRowStyles = tw`flex min-h-12 shrink-0 items-center gap-2 pt-2 pr-1 pl-3 sm:hidden`

type PopoverSurfaceVariant = 'actions' | 'panel' | 'list' | 'nested'

const VARIANT_SURFACE_STYLES: Record<PopoverSurfaceVariant, string> = {
	actions: menuSurfaceStyles,
	panel: menuSurfaceStyles,
	list: popoverSurfaceStyles,
	nested: `${nestedMenuSurfaceStyles} max-sm:drawer-to-left`
}

function join(recipe: string, layout?: string) {
	return layout ? `${recipe} ${layout}` : recipe
}

/** Mobile-only close button for drawer surfaces. Works inside Menu, Popover
    and ComboboxPopover alike: they all share the popover store. */
export function DrawerDismiss({ label = 'Close' }: { label?: string }) {
	return (
		<Ariakit.PopoverDismiss
			render={<Button type="button" variant="ghost" size="md" square className="ml-auto shrink-0 sm:hidden" />}
			aria-label={label}
		>
			<Icon name="x" className="size-4" aria-hidden="true" />
		</Ariakit.PopoverDismiss>
	)
}

/** Header of a `nested` flyout, which slides over its parent sheet on phones: back, title, close. The
    2rem columns in 8px padding put both icons on the 16px nested-row edge. */
export function NestedDrawerHeader({
	title,
	backLabel,
	onBack,
	closeLabel,
	onClose,
	visibleFromSm = false
}: {
	title: ReactNode
	backLabel: string
	onBack: () => void
	closeLabel: string
	onClose: () => void
	/** For a flyout that can open from `sm` too, e.g. inside a narrow container. */
	visibleFromSm?: boolean
}) {
	return (
		<div
			className={`grid min-h-12 shrink-0 grid-cols-[2rem_1fr_2rem] items-center gap-2 px-2 pt-2 ${visibleFromSm ? '' : 'sm:hidden'}`}
		>
			<Tooltip
				content={backLabel}
				render={
					<Button variant="ghost" size="md" square aria-label={backLabel} onClick={onBack} className="shrink-0" />
				}
			>
				<Icon name="chevron-left" className="size-4" aria-hidden="true" />
			</Tooltip>
			<Ariakit.PopoverHeading className="min-w-0 truncate text-center label-md text-primary">
				{title}
			</Ariakit.PopoverHeading>
			<Tooltip
				content={closeLabel}
				render={
					<Button variant="ghost" size="md" square aria-label={closeLabel} onClick={onClose} className="shrink-0" />
				}
			>
				<Icon name="x" className="size-4" aria-hidden="true" />
			</Tooltip>
		</div>
	)
}

/* Desktop widths; every drawer is full width on phones. `fit` hugs the content from the surface's 180px floor. */
const SURFACE_WIDTHS = {
	fit: '',
	...SURFACE_WIDTH_LADDER,
	// A field's list: as wide as the field, and never narrower than 256px under a short one.
	trigger: 'w-[max(16rem,var(--popover-anchor-width))]'
} as const

export type SurfaceWidth = keyof typeof SURFACE_WIDTHS

type SurfaceLayout = {
	width?: SurfaceWidth
	/** Layout placement only, never width, height, colors or padding. */
	className?: string
}

type DrawerChrome =
	| {
			/** Names the phone drawer beside its close button. */
			heading: string
			dismiss?: 'auto'
	  }
	| {
			/** The surface renders its own header row with `<DrawerDismiss>` inside it. */
			dismiss: 'own'
			heading?: never
	  }

type SurfaceChrome =
	| { variant: 'actions' | 'nested'; heading?: never; dismiss?: never }
	| ({ variant: 'panel' | 'list' } & DrawerChrome)

type SurfaceOwnProps = SurfaceLayout & SurfaceChrome

/* A phone drawer covers the page with its scrim, so it is modal there: the page under it does not scroll (a drag on
   the scrim used to scroll it, collapsing Safari's toolbar and moving the drawer), and Tab and screen-reader swipes
   stay inside. From `sm` a surface is an anchored popover and stays non-modal, so the page scrolls under it as before.
   The scrim is Ariakit's backdrop, dimmed by the global `[data-backdrop]` rule like a dialog's: a real fixed element,
   so iOS Safari tints the status bar from it rather than from the locked page. A `nested` flyout slides over its
   parent sheet and adds no scrim. A submenu ignores `modal` (Ariakit), and a caller's own `modal` wins. */
const PHONE_QUERY = '(max-width: 639px)'

/** The three wired pieces, for the surface components in this file. */
function surfaceProps(variant: PopoverSurfaceVariant, { width = 'fit', className }: SurfaceLayout) {
	return {
		className: join(`${VARIANT_SURFACE_STYLES[variant]} ${SURFACE_WIDTHS[width]}`, className),
		wrapperProps: { className: drawerWrapperClassName }
	}
}

function surfaceTitleRow(heading: string | undefined) {
	if (heading === undefined) return null
	return (
		<div className={drawerTitleRowStyles}>
			<Ariakit.PopoverHeading className="min-w-0 flex-1 truncate label-md text-primary">
				{heading}
			</Ariakit.PopoverHeading>
			<DrawerDismiss label={`Close ${heading}`} />
		</div>
	)
}

type PopoverSurfaceProps = SurfaceOwnProps & Omit<Ariakit.PopoverProps, 'className' | 'wrapperProps' | 'title'>

export function PopoverSurface({
	variant,
	width,
	className,
	heading,
	dismiss: _dismiss,
	children,
	gutter = 6,
	portal = true,
	unmountOnHide = true,
	ref,
	...props
}: PopoverSurfaceProps) {
	const phone = useMedia(PHONE_QUERY)
	// Stable, so a render never resets the net in the commit that removes the focused control.
	const surfaceRef = useCallback(
		(node: HTMLDivElement | null) => {
			const release = catchLostFocus(node)
			if (typeof ref === 'function') ref(node)
			else if (ref) ref.current = node
			return () => {
				release?.()
				if (typeof ref === 'function') ref(null)
				else if (ref) ref.current = null
			}
		},
		[ref]
	)
	return (
		<Ariakit.Popover
			modal={phone}
			backdrop={phone && variant !== 'nested'}
			{...props}
			ref={surfaceRef}
			gutter={gutter}
			portal={portal}
			unmountOnHide={unmountOnHide}
			{...surfaceProps(variant, { width, className })}
		>
			{surfaceTitleRow(heading)}
			{children}
		</Ariakit.Popover>
	)
}

/* Search results have no drawer, so they cap their own height: a few suggestions under a field (sm), a lookup's
   results (md), a long search (lg), or the site search, which grows with the screen (screen). Without one they grow to
   the space Ariakit gives them. */
const RESULTS_MAX_HEIGHTS = {
	sm: 'max-h-[min(160px,var(--popover-available-height))]',
	md: 'max-h-[min(288px,var(--popover-available-height))]',
	lg: 'max-h-[min(400px,var(--popover-available-height))]',
	screen: 'max-h-[min(60vh,var(--popover-available-height))]'
} as const

type ComboboxSurfaceProps = SurfaceLayout &
	(
		| { variant: 'search-results'; maxHeight?: keyof typeof RESULTS_MAX_HEIGHTS; heading?: never; dismiss?: never }
		| { variant: 'actions' | 'nested'; maxHeight?: never; heading?: never; dismiss?: never }
		| ({ variant?: 'panel' | 'list'; maxHeight?: never } & DrawerChrome)
	) &
	Omit<Ariakit.ComboboxPopoverProps, 'className' | 'wrapperProps' | 'title'>

/** Combobox results are a list by nature, so `variant` defaults to `list`. */
export function ComboboxSurface({
	variant = 'list',
	width,
	maxHeight,
	className,
	heading,
	dismiss: _dismiss,
	children,
	gutter = 6,
	portal = true,
	unmountOnHide = true,
	...props
}: ComboboxSurfaceProps) {
	// Search results sit under a field on the page, never in a drawer, so they stay non-modal at every width.
	const phone = useMedia(PHONE_QUERY, variant !== 'search-results')
	return (
		<Ariakit.ComboboxPopover
			modal={phone}
			backdrop={phone && variant !== 'nested'}
			{...props}
			gutter={gutter}
			portal={portal}
			unmountOnHide={unmountOnHide}
			{...(variant === 'search-results'
				? {
						className: join(
							`z-50 flex min-w-[180px] flex-col overflow-auto overscroll-contain rounded-xl border border-medium bg-overlay px-0 py-0 shadow-overlay ${SURFACE_WIDTHS[width ?? 'fit']} ${maxHeight ? RESULTS_MAX_HEIGHTS[maxHeight] : ''}`,
							className
						),
						// Results match their field's edges. The default 8px viewport padding is wider than the 4px
						// phone page gutter, so it pushed full-width results 4px right of their field.
						overflowPadding: 0
					}
				: surfaceProps(variant, { width, className }))}
		>
			{surfaceTitleRow(heading)}
			{children}
		</Ariakit.ComboboxPopover>
	)
}

type MenuSurfaceProps = SurfaceOwnProps & Omit<Ariakit.MenuProps, 'className' | 'wrapperProps' | 'title'>

export function MenuSurface({
	variant,
	width,
	className,
	heading,
	dismiss: _dismiss,
	children,
	gutter = 8,
	portal = true,
	unmountOnHide = true,
	...props
}: MenuSurfaceProps) {
	const menu = Ariakit.useMenuContext()!
	const phone = useMedia(PHONE_QUERY)
	return (
		<Ariakit.Menu
			modal={phone}
			backdrop={phone && variant !== 'nested'}
			// Ariakit's Escape closes every open menu. A flyout closes alone and hands focus to its row, as ArrowLeft and
			// the phone sheet's back button do, so a reader backs out one level at a time.
			hideOnEscape={
				variant === 'nested'
					? () => {
							menu.hide()
							return false
						}
					: undefined
			}
			{...props}
			gutter={gutter}
			portal={portal}
			unmountOnHide={unmountOnHide}
			{...surfaceProps(variant, { width, className })}
		>
			{surfaceTitleRow(heading)}
			{children}
		</Ariakit.Menu>
	)
}

/* The row every popover list and menu shares. `group` lets a row's trailing hint react to the row's hover and focus,
   and dims a check box with a disabled row. */
const rowStyles = `group ${menuItemRowStyles} text-primary not-aria-disabled:hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row`

/* A row that acts on the list instead of picking from it (See more…, a manual entry): link-colored. */
const popoverActionRowStyles = `group ${menuItemRowStyles} text-link not-aria-disabled:hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row`

/* Its own recipe, not `text-error` appended to the row: Tailwind emits `.text-primary` after `.text-error`, so an
   appended color class never wins. A destructive row highlights in its own red, like the destructive button. */
const popoverDestructiveMenuItemStyles = `${menuItemRowStyles} text-error not-aria-disabled:hover:bg-error-tint focus-visible:bg-error-tint data-active-item:bg-error-tint`

/* The current row (`data-active`) is a selection: brand tint and link text, and it takes no hover wash. */
const popoverTreeRowStyles = tw`group relative flex shrink-0 cursor-pointer items-center gap-2 truncate py-2 pr-3 body-sm text-primary not-data-[active=true]:hover:bg-hover-row not-data-[active=true]:focus-visible:bg-hover-row not-data-[active=true]:data-active-item:bg-hover-row data-focus-visible:focus-ring data-[active=true]:bg-brand-muted data-[active=true]:text-link max-sm:min-h-11`

type MenuItemRow = 'menu' | 'tree' | 'tree-child'

const ROW_STYLES: Record<MenuItemRow, string> = {
	menu: rowStyles,
	tree: `${popoverTreeRowStyles} pl-3`,
	'tree-child': `${popoverTreeRowStyles} pl-8`
}

type MenuItemProps =
	| (Omit<Ariakit.MenuItemProps, 'className'> & {
			kind?: 'action'
			row?: MenuItemRow
			/** Deletes or removes something: red text. */ destructive?: boolean
	  })
	| (Omit<Ariakit.MenuItemProps, 'className'> & { kind: 'submenu' })
	| (Omit<Ariakit.MenuItemRadioProps, 'className'> & { kind: 'radio' })
	| (Omit<Ariakit.MenuItemCheckboxProps, 'className'> & { kind: 'checkbox' })

/* The mark reads the item's checked state from Ariakit, so it follows `checked` or the menu store's `values` alike.
   MenuItemCheck hands its render function a checkmark child only while the item is checked. */
function MenuItemMark({ kind }: { kind: 'box' | 'tick' }) {
	return (
		<Ariakit.MenuItemCheck
			render={(props) => <Check kind={kind} checked={props.children != null} className="ml-auto" />}
		/>
	)
}

export function MenuItem(props: MenuItemProps) {
	switch (props.kind) {
		case 'radio': {
			const { kind: _kind, children, ...rest } = props
			return (
				<Ariakit.MenuItemRadio {...rest} className={rowStyles}>
					{children}
					<MenuItemMark kind="tick" />
				</Ariakit.MenuItemRadio>
			)
		}
		case 'checkbox': {
			const { kind: _kind, children, ...rest } = props
			return (
				<Ariakit.MenuItemCheckbox {...rest} className={rowStyles}>
					{children}
					<MenuItemMark kind="box" />
				</Ariakit.MenuItemCheckbox>
			)
		}
		case 'submenu': {
			const { kind: _kind, render, children, ...rest } = props
			return (
				<Ariakit.MenuItem {...rest} render={render ?? <Ariakit.MenuButton />} className={rowStyles}>
					{children}
					<Icon name="chevron-right" aria-hidden className="ml-auto size-3.5 shrink-0 text-tertiary" />
				</Ariakit.MenuItem>
			)
		}
		default: {
			const { kind: _kind, row = 'menu', destructive = false, children, ...rest } = props
			return (
				<Ariakit.MenuItem {...rest} className={destructive ? popoverDestructiveMenuItemStyles : ROW_STYLES[row]}>
					{row === 'tree-child' ? (
						// The connector: a rail down the indent that stops at the middle of the last row, and a stub into this row.
						<>
							<span className="absolute top-0 bottom-0 left-3 block h-full w-0.5 bg-border-medium group-last:h-[50%]" />
							<span className="absolute top-1/2 left-3 h-0.5 w-5 -translate-y-1/2 bg-border-medium" />
						</>
					) : null}
					{children}
				</Ariakit.MenuItem>
			)
		}
	}
}

type PopoverRowProps = Omit<Ariakit.RoleProps<'button'>, 'className'> & {
	/** `action` acts on the list instead of picking from it (See more…, a manual entry): link-colored. */
	variant?: 'option' | 'action'
	check?: 'box' | 'tick'
	checked?: boolean
}

/** A row of a popover list that is not a menu: a combobox option (`render={<Ariakit.ComboboxItem value={…} />}`), or a
    button, a dismiss or a static option. Renders a `button` (type="button") by default. */
export function PopoverRow({
	variant = 'option',
	check,
	checked = false,
	render,
	children,
	...props
}: PopoverRowProps) {
	return (
		<Ariakit.Role.button
			{...props}
			{...(render ? { render } : { type: 'button' })}
			className={variant === 'action' ? popoverActionRowStyles : rowStyles}
		>
			{children}
			{check ? <Check kind={check} checked={checked} className="ml-auto" /> : null}
		</Ariakit.Role.button>
	)
}

/** The scrolling list of a surface, under its title row and PopoverHeader, so both stay put while the rows scroll.
    `divided` rules a line between rows. Renders a `div`; pass `render` for an `Ariakit.ComboboxList`. */
export function PopoverList({
	divided = false,
	...props
}: Omit<Ariakit.RoleProps<'div'>, 'className'> & { divided?: boolean }) {
	return (
		<Ariakit.Role.div
			{...props}
			className={divided ? `${popoverScrollAreaStyles} divide-y divide-(--border-subtle)` : popoverScrollAreaStyles}
		/>
	)
}

const FOOTER_ACTION_INSETS = {
	popover: 'px-3 py-2 label-sm max-sm:min-h-11',
	// Nested-menu rows only render in phone sheets, so they keep the 44px touch height outright.
	nested: 'min-h-11 px-4 py-2.5 body-sm'
} as const

/** The closing action under a surface's list (Add custom column, Reset filters, Download .csv): a full-width row
    over a hairline. `inset` matches the rows above it. Focusable while disabled when `accessibleWhenDisabled`. */
export function PopoverFooterAction({
	inset,
	...props
}: Omit<Ariakit.ButtonProps, 'className'> & { inset: keyof typeof FOOTER_ACTION_INSETS }) {
	return (
		<Ariakit.Button
			type="button"
			{...props}
			className={`flex w-full min-w-0 shrink-0 cursor-pointer items-center gap-2 overflow-hidden border-t border-subtle text-left text-primary not-aria-disabled:hover:bg-hover-row focus-visible:bg-hover-row disabled:cursor-not-allowed disabled:text-disabled aria-disabled:cursor-not-allowed aria-disabled:text-disabled data-focus-visible:focus-ring ${FOOTER_ACTION_INSETS[inset]}`}
		/>
	)
}

/** The rule between groups of rows in a menu. */
export function MenuSeparator() {
	return <Ariakit.MenuSeparator className="border-t border-subtle" />
}
