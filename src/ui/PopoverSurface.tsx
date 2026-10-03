import * as Ariakit from '@ariakit/react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { Icon } from './Icon'
import { surfaceMotionStyles } from './Popover'
import { tw } from './tw'

/* ----------------------------------------------------------------------------
   Anchored popover surfaces (design.md → Popover surface).

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

   ComboboxSurface also supports `search-results`: input-anchored results at
   every breakpoint, with no drawer, scrim, or dismiss button.

   Every surface sits on the dialogs' layer, z-50, and the one opened last is
   added to the page last, so it paints on top: a picker over the dialog that
   hosts it, a flyout over its parent menu. `className` is for LAYOUT only —
   width (`w-72`). Never override the surface stacking, colors or radius.
   Results that match their input's width pass `sameWidth`: surfaces portal to
   body, so a width on the wrapper would size them to the viewport.

   Every surface unmounts its content on hide, like the dialogs and tooltips
   in this repo and the shared Select. Pass `unmountOnHide={false}` only with
   a comment saying why: a nav menu that must open instantly on a phone, or
   state that has to survive a close. Note that a closed ComboboxSelect only
   does type-ahead over mounted options; the shared Select never had that, so
   it is not a reason on its own.
---------------------------------------------------------------------------- */

/* The surface recipes and the drawer wrapper live here, not in Popover.ts, so
   nothing outside src/ui can wire a drawer by hand: the only way to get the
   surface + wrapper + close button triple is one of the components below. */

/* Phone drawers share the dialog sheets' height (--sheet-height in tailwind.css) and sit on top of the iOS keyboard:
   useKeyboardInset (mounted in _app) publishes the keyboard's height, which iOS Safari does not take off the page. */
const selectSurfaceHeightStyles =
	'max-sm:h-(--sheet-height) max-sm:w-full! max-sm:max-w-none! max-sm:drawer max-sm:rounded-b-none max-sm:pb-[max(0px,calc(env(safe-area-inset-bottom)-var(--keyboard-inset,0px)))] sm:max-h-[min(400px,var(--popover-available-height))]'

const menuSurfaceHeightStyles =
	'max-sm:max-h-(--sheet-height) max-sm:w-full! max-sm:max-w-none! max-sm:drawer max-sm:rounded-b-none max-sm:pb-[max(0px,calc(env(safe-area-inset-bottom)-var(--keyboard-inset,0px)))] sm:max-h-[min(60dvh,var(--popover-available-height))]'

const nestedMenuSurfaceHeightStyles =
	'max-sm:h-(--sheet-height) max-sm:w-full! max-sm:max-w-none! max-sm:rounded-b-none sm:max-h-[min(60dvh,var(--popover-available-height))]'

const popoverSurfaceStyles = `z-50 flex min-w-[180px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay px-0 py-0 shadow-overlay-sm ${selectSurfaceHeightStyles} ${surfaceMotionStyles}`

const menuSurfaceStyles = `z-50 flex min-w-[180px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay px-0 py-0 sm:max-w-md shadow-overlay-sm ${menuSurfaceHeightStyles} ${surfaceMotionStyles}`

const nestedMenuSurfaceStyles = `z-50 flex min-w-[180px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay px-0 py-0 sm:max-w-md shadow-overlay-sm ${nestedMenuSurfaceHeightStyles} ${surfaceMotionStyles}`

/* Mobile drawers dim the page behind them so a short sheet at the bottom is
   still noticed. The scrim is a pseudo-element on the positioning wrapper:
   Ariakit copies the surface z-index onto the wrapper, so the pseudo paints
   under the surface, and a tap on it lands outside the surface and closes.
   Hidden popovers keep their wrapper mounted, so only open scrims accept clicks. */
const popoverMobileWrapperClassName = tw`max-sm:fixed! max-sm:top-auto! max-sm:right-0! max-sm:bottom-(--keyboard-inset,0px)! max-sm:left-0! max-sm:w-full! max-sm:transform-none! max-sm:before:pointer-events-none max-sm:before:fixed max-sm:before:inset-0 max-sm:before:bg-screen-dim max-sm:before:opacity-0 max-sm:before:transition-opacity max-sm:before:duration-200 max-sm:before:ease-out-quart max-sm:before:content-[''] max-sm:has-data-enter:before:pointer-events-auto max-sm:has-data-enter:before:opacity-100`

const nestedPopoverMobileWrapperClassName = tw`max-sm:fixed! max-sm:top-auto! max-sm:right-0! max-sm:bottom-(--keyboard-inset,0px)! max-sm:left-0! max-sm:w-full! max-sm:transform-none!`

// The row's 4px plus the close button's 8px inset puts the x on the 12px content edge.
const drawerTitleRowStyles = tw`flex min-h-12 shrink-0 items-center gap-2 pt-2 pr-1 pl-3 sm:hidden`

export type PopoverSurfaceVariant = 'actions' | 'panel' | 'list' | 'nested'

const VARIANT_SURFACE_STYLES: Record<PopoverSurfaceVariant, string> = {
	actions: menuSurfaceStyles,
	panel: menuSurfaceStyles,
	list: popoverSurfaceStyles,
	nested: `${nestedMenuSurfaceStyles} max-sm:drawer-to-left`
}

const VARIANT_WRAPPER_STYLES: Record<PopoverSurfaceVariant, string> = {
	actions: popoverMobileWrapperClassName,
	panel: popoverMobileWrapperClassName,
	list: popoverMobileWrapperClassName,
	nested: nestedPopoverMobileWrapperClassName
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
			<Button
				type="button"
				variant="ghost"
				size="md"
				square
				aria-label={backLabel}
				onClick={onBack}
				className="shrink-0"
			>
				<Icon name="chevron-left" className="size-4" aria-hidden="true" />
			</Button>
			<Ariakit.PopoverHeading className="min-w-0 truncate text-center label-md text-primary">
				{title}
			</Ariakit.PopoverHeading>
			<Button
				type="button"
				variant="ghost"
				size="md"
				square
				aria-label={closeLabel}
				onClick={onClose}
				className="shrink-0"
			>
				<Icon name="x" className="size-4" aria-hidden="true" />
			</Button>
		</div>
	)
}

type SurfaceLayout = {
	/** Layout placement only: width, z-index. */
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

export type SurfaceOwnProps = SurfaceLayout & SurfaceChrome

/** The three wired pieces, for the surface components in this folder. */
export function surfaceProps(variant: PopoverSurfaceVariant, { className }: SurfaceLayout) {
	return {
		className: join(VARIANT_SURFACE_STYLES[variant], className),
		wrapperProps: { className: VARIANT_WRAPPER_STYLES[variant] }
	}
}

export function surfaceTitleRow(heading: string | undefined) {
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
	className,
	heading,
	dismiss: _dismiss,
	children,
	gutter = 6,
	portal = true,
	unmountOnHide = true,
	...props
}: PopoverSurfaceProps) {
	return (
		<Ariakit.Popover
			{...props}
			gutter={gutter}
			portal={portal}
			unmountOnHide={unmountOnHide}
			{...surfaceProps(variant, { className })}
		>
			{surfaceTitleRow(heading)}
			{children}
		</Ariakit.Popover>
	)
}

type ComboboxSurfaceProps = SurfaceLayout &
	(
		| { variant: 'search-results' | 'actions' | 'nested'; heading?: never; dismiss?: never }
		| ({ variant?: 'panel' | 'list' } & DrawerChrome)
	) &
	Omit<Ariakit.ComboboxPopoverProps, 'className' | 'wrapperProps' | 'title'>

/** Combobox results are a list by nature, so `variant` defaults to `list`. */
export function ComboboxSurface({
	variant = 'list',
	className,
	heading,
	dismiss: _dismiss,
	children,
	gutter = 6,
	portal = true,
	unmountOnHide = true,
	...props
}: ComboboxSurfaceProps) {
	return (
		<Ariakit.ComboboxPopover
			{...props}
			gutter={gutter}
			portal={portal}
			unmountOnHide={unmountOnHide}
			{...(variant === 'search-results'
				? {
						className: join(
							'z-50 flex min-w-[180px] flex-col overflow-auto overscroll-contain rounded-xl border border-medium bg-overlay px-0 py-0 shadow-overlay-sm',
							className
						),
						// Results match their field's edges. The default 8px viewport padding is wider than the 4px
						// phone page gutter, so it pushed full-width results 4px right of their field.
						overflowPadding: 0
					}
				: surfaceProps(variant, { className }))}
		>
			{surfaceTitleRow(heading)}
			{children}
		</Ariakit.ComboboxPopover>
	)
}
