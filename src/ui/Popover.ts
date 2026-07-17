import { tw } from './tw'
/* ----------------------------------------------------------------------------
   Popover/menu surface recipe from Figma 6183:293478.

   Surface owns the elevated background, medium border, 12px radius, scrollbars,
   overscroll, drawer behavior, and max height. Rows/search/action/footer blocks
   own all spacing.
---------------------------------------------------------------------------- */

const selectSurfaceHeightStyles =
	'max-sm:h-[calc(100dvh-80px)] max-sm:w-full! max-sm:max-w-none! max-sm:drawer max-sm:rounded-b-none sm:max-h-[min(400px,var(--popover-available-height))]'

const menuSurfaceHeightStyles =
	'max-sm:h-[calc(100dvh-80px)] max-sm:w-full! max-sm:max-w-none! max-sm:drawer max-sm:rounded-b-none sm:max-h-[min(60dvh,var(--popover-available-height))]'

const nestedMenuSurfaceHeightStyles =
	'max-sm:h-[calc(100dvh-80px)] max-sm:w-full! max-sm:max-w-none! max-sm:rounded-b-none sm:max-h-[min(60dvh,var(--popover-available-height))]'

export const popoverSurfaceStyles = `z-10 flex min-w-[180px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay px-0 py-0 shadow-overlay-sm ${selectSurfaceHeightStyles}`

export const menuSurfaceStyles = `z-10 flex min-w-[180px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay px-0 py-0 sm:max-w-md shadow-overlay-sm ${menuSurfaceHeightStyles}`

export const nestedMenuSurfaceStyles = `flex min-w-[180px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay px-0 py-0 sm:max-w-md shadow-overlay-sm ${nestedMenuSurfaceHeightStyles}`

export const popoverSearchResultsSurfaceStyles = tw`z-10 overflow-y-auto rounded-b-lg border border-medium bg-overlay shadow-overlay-sm`

export const popoverHovercardSurfaceStyles = tw`z-50 max-h-[min(calc(100dvh-80px),var(--popover-available-height))] max-w-(--popover-available-width) overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay body-sm shadow-overlay-sm`

/* Text-only tooltips: same chrome as hovercards, but radius follows the
   component's size — 6px on a one-line bubble, not the popover 12px. */
export const tooltipSurfaceStyles = tw`z-50 max-h-[calc(100dvh-80px)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border border-medium bg-overlay body-sm shadow-overlay-sm lg:max-h-(--popover-available-height)`

export const popoverRowStyles = tw`flex shrink-0 cursor-pointer items-center justify-between gap-2 overflow-hidden px-3 py-2 body-sm text-primary cv-auto-37 hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring`

export const popoverRowWithBorderStyles = `${popoverRowStyles} border-b border-subtle last-of-type:border-b-0`

export const popoverMenuItemStyles = tw`flex shrink-0 cursor-pointer items-center gap-2 overflow-hidden px-3 py-2 body-sm text-primary hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring`

export const popoverTreeRowStyles = tw`group relative flex shrink-0 cursor-pointer items-center gap-2 truncate py-2 pr-3 body-sm text-primary hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring data-[active=true]:bg-hover-row`

export const popoverActionBarStyles = tw`grid w-full min-w-0 grid-cols-2 border-b border-subtle bg-overlay body-sm text-link`

export const popoverActionButtonStyles = tw`flex min-w-0 items-center justify-center truncate px-3 py-2 text-link hover:bg-hover-row focus-visible:bg-hover-row`

export const popoverSearchBlockStyles = tw`relative p-3`

export const popoverSearchBlockWithBottomPaddingStyles = popoverSearchBlockStyles

export const popoverFooterActionStyles = tw`flex w-full min-w-0 shrink-0 items-center gap-2 overflow-hidden border-t border-subtle px-3 py-2 label-sm text-primary hover:bg-hover-row focus-visible:bg-hover-row`

export const popoverSeeMoreStyles = tw`w-full cursor-pointer px-3 py-2 text-left body-sm text-link hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring`

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

export const popoverMobileWrapperClassName = tw`max-sm:fixed! max-sm:top-auto! max-sm:right-0! max-sm:bottom-0! max-sm:left-0! max-sm:w-full! max-sm:transform-none!`

export const nestedPopoverMobileWrapperClassName = tw`max-sm:fixed! max-sm:top-auto! max-sm:right-0! max-sm:bottom-0! max-sm:left-0! max-sm:w-full! max-sm:transform-none!`

export const popoverMobileDismissStyles = tw`ml-auto flex size-10 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-hover-row hover:text-primary focus-visible:bg-hover-row focus-visible:text-primary sm:hidden`

/* Compatibility styles for product surfaces that still consume shared menu/select components. */
export const legacySelectPopoverSurfaceStyles = `z-10 flex min-w-[180px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border border-medium bg-surface-elevated-1 ${selectSurfaceHeightStyles}`

export const productSurfaceComboboxPopoverSurfaceStyles = `z-10 flex min-w-[180px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-surface-elevated-1 ${selectSurfaceHeightStyles}`

export const productSurfaceComboboxActionBarStyles = tw`sticky top-0 z-1 flex flex-wrap justify-between gap-1 border-b border-subtle bg-surface-elevated-1 text-xs text-link`

export const legacyMenuSurfaceStyles = `z-10 flex min-w-[180px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border border-medium bg-surface-elevated-1 sm:max-w-md ${menuSurfaceHeightStyles}`

export const legacyNestedMenuSurfaceStyles = `flex flex-col gap-1 overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border border-medium bg-surface-elevated-1 max-sm:p-2 sm:p-0 ${nestedMenuSurfaceHeightStyles}`

export const legacyNestedMenuRootFilterButtonStyles = tw`relative flex cursor-pointer flex-nowrap items-center justify-between gap-2 rounded-md border border-medium px-2 py-1.5 text-xs font-medium text-secondary hover:bg-hover-row focus-visible:bg-hover-row`

export const legacyNestedMenuRootButtonStyles = tw`flex items-center justify-between gap-3 rounded-md bg-surface-elevated-1 px-3 py-2 text-primary hover:bg-surface-elevated-2 focus-visible:bg-surface-elevated-2`

export const legacyNestedMenuButtonStyles = tw`flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-primary hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row`

export const legacyPopoverRowStyles = tw`flex shrink-0 cursor-pointer items-center justify-between gap-4 overflow-hidden border-b border-medium px-3 py-2 text-primary cv-auto-37 first-of-type:rounded-t-md last-of-type:rounded-b-md hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row`

export const legacyPopoverExternalRowStyles = tw`shrink-0 cursor-pointer truncate border-b border-medium px-3 py-2 text-primary cv-auto-37 first-of-type:rounded-t-md last-of-type:rounded-b-md hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row`

export const legacySelectPopoverRowStyles = tw`flex shrink-0 cursor-pointer items-center justify-start gap-4 border-b border-medium px-3 py-2 text-primary cv-auto-37 last-of-type:rounded-b-md hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row`

export const legacyPopoverActionBarStyles = tw`sticky top-0 z-1 flex flex-wrap justify-between gap-1 border-b border-medium bg-surface-elevated-1 text-xs text-link`

export const legacyPopoverActionButtonStyles = 'p-3'

export const legacyPopoverSeeMoreStyles = tw`w-full cursor-pointer px-3 py-4 text-link hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row`

export const legacyPopoverSelectCheckStyles = tw`ml-auto flex size-3 shrink-0 items-center justify-center rounded-xs border border-brand text-link`
