import * as Ariakit from '@ariakit/react'
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
     panel   — content-sized like `actions`, with a close button. Small
               forms and controls where a user may be mid-task: date pickers,
               save-view forms, annotation editors.
     list    — the tall drawer (reserved height on phones, 400px on desktop)
               with a close button. Selects, comboboxes, searchable lists.
     nested  — a submenu flyout opened from inside another surface. Slides in
               from the right on phones over the parent sheet, so it has no
               scrim of its own and no close button: the caller renders the
               back/title/close header (see NestedMenu).

   `className` is for LAYOUT only — width (`w-72`), stacking (`z-50` when the
   trigger sits inside a dialog). Never override the surface colors/radius.
   `wrapperClassName` extends the positioning wrapper the same way, e.g.
   `w-full!` to make a combobox match its input width.

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

const selectSurfaceHeightStyles =
	'max-sm:h-[calc(100dvh-80px)] max-sm:w-full! max-sm:max-w-none! max-sm:drawer max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom)] sm:max-h-[min(400px,var(--popover-available-height))]'

const menuSurfaceHeightStyles =
	'max-sm:max-h-[calc(100dvh-80px)] max-sm:w-full! max-sm:max-w-none! max-sm:drawer max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom)] sm:max-h-[min(60dvh,var(--popover-available-height))]'

const nestedMenuSurfaceHeightStyles =
	'max-sm:h-[calc(100dvh-80px)] max-sm:w-full! max-sm:max-w-none! max-sm:rounded-b-none sm:max-h-[min(60dvh,var(--popover-available-height))]'

const popoverSurfaceStyles = `z-10 flex min-w-[180px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay px-0 py-0 shadow-overlay-sm ${selectSurfaceHeightStyles} ${surfaceMotionStyles}`

const menuSurfaceStyles = `z-10 flex min-w-[180px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay px-0 py-0 sm:max-w-md shadow-overlay-sm ${menuSurfaceHeightStyles} ${surfaceMotionStyles}`

const nestedMenuSurfaceStyles = `flex min-w-[180px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay px-0 py-0 sm:max-w-md shadow-overlay-sm ${nestedMenuSurfaceHeightStyles} ${surfaceMotionStyles}`

/* Mobile drawers dim the page behind them so a short sheet at the bottom is
   still noticed. The scrim is a pseudo-element on the positioning wrapper:
   Ariakit copies the surface z-index onto the wrapper, so the pseudo paints
   under the surface, and a tap on it lands outside the surface and closes.
   Hidden popovers keep their wrapper mounted, so only open scrims accept clicks. */
const popoverMobileWrapperClassName = tw`max-sm:fixed! max-sm:top-auto! max-sm:right-0! max-sm:bottom-0! max-sm:left-0! max-sm:w-full! max-sm:transform-none! max-sm:before:pointer-events-none max-sm:before:fixed max-sm:before:inset-0 max-sm:before:bg-screen-dim max-sm:before:opacity-0 max-sm:before:transition-opacity max-sm:before:duration-200 max-sm:before:ease-out-quart max-sm:before:content-[''] max-sm:has-data-enter:before:pointer-events-auto max-sm:has-data-enter:before:opacity-100`

const nestedPopoverMobileWrapperClassName = tw`max-sm:fixed! max-sm:top-auto! max-sm:right-0! max-sm:bottom-0! max-sm:left-0! max-sm:w-full! max-sm:transform-none!`

const popoverMobileDismissStyles = tw`ml-auto flex size-10 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-hover-row hover:text-primary focus-visible:bg-hover-row focus-visible:text-primary sm:hidden`

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

const VARIANT_HAS_DISMISS: Record<PopoverSurfaceVariant, boolean> = {
	actions: false,
	panel: true,
	list: true,
	nested: false
}

function join(recipe: string, layout?: string) {
	return layout ? `${recipe} ${layout}` : recipe
}

/** Mobile-only close button for drawer surfaces. Works inside Menu, Popover
    and ComboboxPopover alike: they all share the popover store. */
export function DrawerDismiss({ label = 'Close' }: { label?: string }) {
	return (
		<Ariakit.PopoverDismiss aria-label={label} className={popoverMobileDismissStyles}>
			<Icon name="x" className="size-4" aria-hidden="true" />
		</Ariakit.PopoverDismiss>
	)
}

export type SurfaceOwnProps = {
	variant: PopoverSurfaceVariant
	/** Layout placement only: width, z-index. */
	className?: string
	/** Layout for the positioning wrapper, e.g. `w-full!`. */
	wrapperClassName?: string
	/** aria-label of the mobile close button (`panel` and `list`). */
	dismissLabel?: string
	/** `own` when the surface has a header row and renders `<DrawerDismiss>`
	    inside it itself, so the close button sits inline with the title. */
	dismiss?: 'auto' | 'own'
}

/** The three wired pieces, for the surface components in this folder. */
export function surfaceProps({ variant, className, wrapperClassName }: Omit<SurfaceOwnProps, 'dismissLabel'>) {
	return {
		className: join(VARIANT_SURFACE_STYLES[variant], className),
		wrapperProps: { className: join(VARIANT_WRAPPER_STYLES[variant], wrapperClassName) }
	}
}

export function surfaceDismiss(variant: PopoverSurfaceVariant, label: string, dismiss: 'auto' | 'own') {
	return dismiss === 'auto' && VARIANT_HAS_DISMISS[variant] ? <DrawerDismiss label={label} /> : null
}

type PopoverSurfaceProps = SurfaceOwnProps & Omit<Ariakit.PopoverProps, 'className' | 'wrapperProps'>

export function PopoverSurface({
	variant,
	className,
	wrapperClassName,
	dismissLabel = 'Close',
	dismiss = 'auto',
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
			{...surfaceProps({ variant, className, wrapperClassName })}
		>
			{surfaceDismiss(variant, dismissLabel, dismiss)}
			{children}
		</Ariakit.Popover>
	)
}

type ComboboxSurfaceProps = Partial<Pick<SurfaceOwnProps, 'variant'>> &
	Omit<SurfaceOwnProps, 'variant'> &
	Omit<Ariakit.ComboboxPopoverProps, 'className' | 'wrapperProps'>

/** Combobox results are a list by nature, so `variant` defaults to `list`. */
export function ComboboxSurface({
	variant = 'list',
	className,
	wrapperClassName,
	dismissLabel = 'Close options',
	dismiss = 'auto',
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
			{...surfaceProps({ variant, className, wrapperClassName })}
		>
			{surfaceDismiss(variant, dismissLabel, dismiss)}
			{children}
		</Ariakit.ComboboxPopover>
	)
}
