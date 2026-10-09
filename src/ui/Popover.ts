import { tw } from './tw'
/* ----------------------------------------------------------------------------
   Row, check and hovercard/tooltip recipes for the popover surfaces. The
   surfaces themselves are private to ./PopoverSurface.tsx.

   The surface owns its overlay background, medium border, 12px radius,
   scrolling, drawer behavior and max height. Rows and footers own their
   spacing; the search/toggle block above a list is `PopoverHeader`.

   Rows: px-3 py-2 body-sm, full-bleed, hover-row wash, 44px tall on phones.
   Nested-menu rows use the `nestedMenu*` recipes (16px sides, always 44px).

   Checks (popoverMultiSelectCheckStyles, popoverSingleSelectCheckStyles):
   a multi-select row draws a 14px rounded box, brand-filled with a white
   check when selected and an empty border-strong box when not. A
   single-select row draws no box: only the selected row shows a 14px
   text-link check.
---------------------------------------------------------------------------- */

export const surfaceMotionStyles = tw`sm:origin-(--popover-transform-origin) sm:scale-[.98] sm:opacity-0 sm:transition-[opacity,scale] sm:duration-180 sm:ease-out-quart sm:data-enter:scale-100 sm:data-enter:opacity-100 sm:data-leave:duration-140`

const tooltipMotionStyles = tw`translate-y-1 opacity-0 transition-[opacity,translate] duration-120 ease-out-quart data-enter:translate-y-0 data-enter:opacity-100 data-leave:duration-100`

export const popoverHovercardSurfaceStyles = `z-50 max-h-[min(calc(100dvh-80px),var(--popover-available-height))] max-w-(--popover-available-width) overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay body-sm shadow-overlay ${surfaceMotionStyles}`

/* Text-only tooltips: same chrome as hovercards, but radius follows the
   component's size — 6px on a one-line bubble, not the popover 12px. The
   surface sets text-primary, so a tooltip rendered in place (portal={false})
   never takes its anchor's colour, such as a toast's red title. */
export const tooltipSurfaceStaticStyles = tw`z-50 max-h-[calc(100dvh-80px)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border border-medium bg-overlay body-sm text-primary shadow-overlay lg:max-h-(--popover-available-height)`

export const tooltipSurfaceStyles = `${tooltipSurfaceStaticStyles} ${tooltipMotionStyles}`

/* Virtualized lists measure each row, so their rows skip `content-visibility`: an off-screen row would report
   its placeholder size instead of its own. */
export const popoverMeasuredRowStyles = tw`flex shrink-0 cursor-pointer items-center justify-between gap-2 overflow-hidden px-3 py-2 body-sm text-primary not-aria-disabled:hover:bg-hover-row focus-visible:bg-hover-row aria-disabled:cursor-not-allowed aria-disabled:text-disabled data-active-item:bg-hover-row data-focus-visible:focus-ring max-sm:min-h-11`

export const popoverRowStyles = `${popoverMeasuredRowStyles} cv-auto-37 max-sm:cv-auto-44`

export const popoverRowWithBorderStyles = `${popoverRowStyles} border-b border-subtle last-of-type:border-b-0`

const menuItemRowStyles = tw`flex shrink-0 cursor-pointer items-center gap-2 overflow-hidden px-3 py-2 body-sm aria-disabled:cursor-not-allowed aria-disabled:text-disabled data-focus-visible:focus-ring max-sm:min-h-11`

export const popoverMenuItemStyles = `${menuItemRowStyles} text-primary hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row`

/* Its own recipe, not `text-error` appended to the row: Tailwind emits `.text-primary` after `.text-error`, so an
   appended color class never wins. A destructive row highlights in its own red, like the destructive button. */
export const popoverDestructiveMenuItemStyles = `${menuItemRowStyles} text-error hover:bg-error-tint focus-visible:bg-error-tint data-active-item:bg-error-tint`

/* The current row (`data-active`) is a selection: brand tint and link text, and it takes no hover wash. */
export const popoverTreeRowStyles = tw`group relative flex shrink-0 cursor-pointer items-center gap-2 truncate py-2 pr-3 body-sm text-primary not-data-[active=true]:hover:bg-hover-row not-data-[active=true]:focus-visible:bg-hover-row not-data-[active=true]:data-active-item:bg-hover-row data-focus-visible:focus-ring data-[active=true]:bg-brand-muted data-[active=true]:text-link max-sm:min-h-11`

/* The list under a PopoverHeader scrolls on its own, so the title row and header stay put when Ariakit
   scrolls the selected option into view on open, or the user scrolls a long list. Neither reserves a
   scrollbar gutter: with always-visible scrollbars a reserved gutter leaves every short list lopsided. */
export const popoverScrollAreaStyles = tw`min-h-0 flex-1 overflow-y-auto overscroll-contain`

export const popoverFooterActionStyles = tw`flex w-full min-w-0 shrink-0 items-center gap-2 overflow-hidden border-t border-subtle px-3 py-2 label-sm text-primary hover:bg-hover-row focus-visible:bg-hover-row max-sm:min-h-11`

export const popoverSeeMoreStyles = tw`w-full cursor-pointer px-3 py-2 text-left body-sm text-link hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring max-sm:min-h-11`

// Nested-menu rows only render in phone sheets, so they keep the 44px touch height outright.
export const nestedMenuRootRowStyles = tw`grid min-h-11 w-full cursor-pointer grid-cols-[minmax(0,1fr)_1rem] items-center overflow-hidden px-4 py-2.5 text-left body-sm text-primary hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring`

export const nestedMenuSelectRowStyles = tw`grid min-h-11 w-full cursor-pointer grid-cols-[minmax(0,1fr)_1.25rem] items-center overflow-hidden border-b border-subtle px-4 py-2.5 text-left body-sm text-primary last-of-type:border-b-0 not-aria-disabled:hover:bg-hover-row focus-visible:bg-hover-row aria-disabled:cursor-not-allowed aria-disabled:text-disabled data-active-item:bg-hover-row data-focus-visible:focus-ring`

export const nestedMenuSeeMoreStyles = tw`min-h-11 w-full cursor-pointer px-4 py-2.5 text-left body-sm text-link hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring`

export const nestedMenuActionStyles = tw`flex min-h-11 w-full shrink-0 cursor-pointer items-center justify-start gap-2 overflow-hidden border-t border-subtle px-4 py-2.5 text-left body-sm text-primary hover:bg-hover-row focus-visible:bg-hover-row disabled:cursor-not-allowed disabled:text-disabled aria-disabled:cursor-not-allowed aria-disabled:text-disabled`

export const nestedMenuDisclosureIconStyles = tw`size-4 justify-self-end text-tertiary`

export function popoverMultiSelectCheckStyles(selected: boolean) {
	return `ml-auto grid size-3.5 shrink-0 place-items-center rounded-[4px] border ${
		selected ? 'border-brand bg-brand text-on-brand' : 'border-strong bg-transparent text-transparent'
	}`
}

export function popoverSingleSelectCheckStyles(selected: boolean) {
	return `ml-auto grid size-3.5 shrink-0 place-items-center text-link ${selected ? '' : 'invisible'}`
}
