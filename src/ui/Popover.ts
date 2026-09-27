import { tw } from './tw'
/* ----------------------------------------------------------------------------
   Popover/menu surface recipe from Figma 6183:293478.

   Surface owns the elevated background, medium border, 12px radius, scrollbars,
   overscroll, drawer behavior, and max height. Rows/search/action/footer blocks
   own all spacing.
---------------------------------------------------------------------------- */

export const surfaceMotionStyles = tw`sm:origin-(--popover-transform-origin) sm:scale-[.98] sm:opacity-0 sm:transition-[opacity,scale] sm:duration-180 sm:ease-out-quart sm:data-enter:scale-100 sm:data-enter:opacity-100 sm:data-leave:duration-140`

const tooltipMotionStyles = tw`translate-y-1 opacity-0 transition-[opacity,translate] duration-120 ease-out-quart data-enter:translate-y-0 data-enter:opacity-100 data-leave:duration-100`

export const popoverHovercardSurfaceStyles = `z-50 max-h-[min(calc(100dvh-80px),var(--popover-available-height))] max-w-(--popover-available-width) overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay body-sm shadow-overlay-sm ${surfaceMotionStyles}`

/* Text-only tooltips: same chrome as hovercards, but radius follows the
   component's size — 6px on a one-line bubble, not the popover 12px. */
export const tooltipSurfaceStaticStyles = tw`z-50 max-h-[calc(100dvh-80px)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border border-medium bg-overlay body-sm shadow-overlay-sm lg:max-h-(--popover-available-height)`

export const tooltipSurfaceStyles = `${tooltipSurfaceStaticStyles} ${tooltipMotionStyles}`

export const popoverRowStyles = tw`flex shrink-0 cursor-pointer items-center justify-between gap-2 overflow-hidden px-3 py-2 body-sm text-primary cv-auto-37 hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring max-sm:min-h-11 max-sm:cv-auto-44`

export const popoverRowWithBorderStyles = `${popoverRowStyles} border-b border-subtle last-of-type:border-b-0`

export const popoverMenuItemStyles = tw`flex shrink-0 cursor-pointer items-center gap-2 overflow-hidden px-3 py-2 body-sm text-primary hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring max-sm:min-h-11`

export const popoverTreeRowStyles = tw`group relative flex shrink-0 cursor-pointer items-center gap-2 truncate py-2 pr-3 body-sm text-primary hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring data-[active=true]:bg-hover-row max-sm:min-h-11`

export const popoverActionBarStyles = tw`grid w-full min-w-0 grid-cols-2 border-b border-subtle bg-overlay body-sm text-link`

export const popoverActionButtonStyles = tw`flex min-w-0 items-center justify-center truncate px-3 py-2 text-link hover:bg-hover-row focus-visible:bg-hover-row`

export const popoverSearchBlockStyles = tw`relative p-3`

export const popoverFooterActionStyles = tw`flex w-full min-w-0 shrink-0 items-center gap-2 overflow-hidden border-t border-subtle px-3 py-2 label-sm text-primary hover:bg-hover-row focus-visible:bg-hover-row max-sm:min-h-11`

export const popoverSeeMoreStyles = tw`w-full cursor-pointer px-3 py-2 text-left body-sm text-link hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring max-sm:min-h-11`

export const nestedMenuRootRowStyles = tw`grid min-h-10 w-full cursor-pointer grid-cols-[minmax(0,1fr)_1rem] items-center overflow-hidden px-4 py-2.5 text-left body-sm text-primary hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring`

export const nestedMenuSelectRowStyles = tw`grid min-h-10 w-full cursor-pointer grid-cols-[minmax(0,1fr)_1.25rem] items-center overflow-hidden border-b border-subtle px-4 py-2.5 text-left body-sm text-primary last-of-type:border-b-0 hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring`

export const nestedMenuSeeMoreStyles = tw`min-h-10 w-full cursor-pointer px-4 py-2.5 text-left body-sm text-link hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring`

export const nestedMenuActionStyles = tw`flex min-h-10 w-full shrink-0 cursor-pointer items-center justify-start gap-2 overflow-hidden border-t border-subtle px-4 py-2.5 text-left body-sm text-primary hover:bg-hover-row focus-visible:bg-hover-row disabled:cursor-not-allowed disabled:opacity-40`

export const nestedMenuActionBarStyles = tw`grid w-full min-w-0 grid-cols-2 border-b border-subtle body-sm text-link`

export const nestedMenuActionButtonStyles = tw`flex min-h-10 min-w-0 items-center justify-center px-4 py-2.5 text-center text-link hover:bg-hover-row focus-visible:bg-hover-row`

export const nestedMenuSearchBlockStyles = tw`relative px-4 py-3`

export const nestedMenuDisclosureIconStyles = tw`size-4 justify-self-end text-tertiary`

export const nestedMenuHeaderIconButtonStyles = tw`flex size-10 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-hover-row hover:text-primary focus-visible:bg-hover-row focus-visible:text-primary`

export const nestedMenuRootFilterButtonStyles = tw`flex min-h-8 cursor-pointer flex-nowrap items-center justify-between gap-2 rounded-lg border border-medium px-3 py-1.5 label-sm text-primary hover:bg-hover-row focus-visible:bg-hover-row`

export function popoverMultiSelectCheckStyles(selected: boolean) {
	return `ml-auto grid size-3.5 shrink-0 place-items-center rounded-[4px] border ${
		selected ? 'border-brand bg-brand text-on-brand' : 'border-strong bg-transparent text-transparent'
	}`
}

export function popoverSingleSelectCheckStyles(selected: boolean) {
	return `ml-auto grid size-3.5 shrink-0 place-items-center text-link ${selected ? '' : 'invisible'}`
}
