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

export const popoverSurfaceStyles = `z-10 flex min-w-[180px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay px-0 py-0 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)] ${selectSurfaceHeightStyles}`

export const menuSurfaceStyles = `z-10 flex min-w-[180px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay px-0 py-0 sm:max-w-md shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)] ${menuSurfaceHeightStyles}`

export const nestedMenuSurfaceStyles = `flex min-w-[180px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay px-0 py-0 sm:max-w-md shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)] ${nestedMenuSurfaceHeightStyles}`

export const popoverSearchResultsSurfaceStyles =
	'z-10 overflow-y-auto rounded-b-lg border border-medium bg-overlay shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)]'

export const popoverHovercardSurfaceStyles =
	'z-50 max-h-[calc(100dvh-80px)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-overlay body-sm shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)] lg:max-h-(--popover-available-height)'

/* Text-only tooltips: same chrome as hovercards, but radius follows the
   component's size — 6px on a one-line bubble, not the popover 12px. */
export const tooltipSurfaceStyles =
	'z-50 max-h-[calc(100dvh-80px)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border border-medium bg-overlay body-sm shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)] lg:max-h-(--popover-available-height)'

export const popoverRowStyles =
	'body-sm flex shrink-0 cursor-pointer items-center justify-between gap-2 overflow-hidden px-3 py-2 text-primary cv-auto-37 hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring'

export const popoverRowWithBorderStyles = `${popoverRowStyles} border-b border-subtle last-of-type:border-b-0`

export const popoverMenuItemStyles =
	'body-sm flex shrink-0 cursor-pointer items-center gap-2 overflow-hidden px-3 py-2 text-primary hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring'

export const popoverTreeRowStyles =
	'body-sm group relative flex shrink-0 cursor-pointer items-center gap-2 truncate py-2 pr-3 text-primary hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring data-[active=true]:bg-hover-row'

export const popoverActionBarStyles =
	'grid w-full min-w-0 grid-cols-2 border-b border-subtle bg-overlay body-sm text-link'

export const popoverActionButtonStyles =
	'flex min-w-0 items-center justify-center truncate px-3 py-2 text-link hover:bg-hover-row focus-visible:bg-hover-row'

export const popoverSearchBlockStyles = 'relative p-3'

export const popoverSearchBlockWithBottomPaddingStyles = popoverSearchBlockStyles

export const popoverFooterActionStyles =
	'flex w-full min-w-0 shrink-0 items-center gap-2 overflow-hidden border-t border-subtle px-3 py-2 label-sm text-primary hover:bg-hover-row focus-visible:bg-hover-row'

export const popoverSeeMoreStyles =
	'body-sm w-full cursor-pointer px-3 py-2 text-left text-link hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring'

export const nestedMenuRootRowStyles =
	'body-sm grid min-h-10 w-full cursor-pointer grid-cols-[minmax(0,1fr)_1rem] items-center overflow-hidden px-4 py-2.5 text-left text-primary hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring'

export const nestedMenuSelectRowStyles =
	'body-sm grid min-h-10 w-full cursor-pointer grid-cols-[minmax(0,1fr)_1.25rem] items-center overflow-hidden border-b border-subtle px-4 py-2.5 text-left text-primary last-of-type:border-b-0 hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring'

export const nestedMenuSeeMoreStyles =
	'body-sm min-h-10 w-full cursor-pointer px-4 py-2.5 text-left text-link hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring'

export const nestedMenuActionStyles =
	'body-sm flex min-h-10 w-full shrink-0 cursor-pointer items-center justify-start gap-2 overflow-hidden border-t border-subtle px-4 py-2.5 text-left text-primary hover:bg-hover-row focus-visible:bg-hover-row disabled:cursor-not-allowed disabled:opacity-40'

export const nestedMenuActionBarStyles = 'grid w-full min-w-0 grid-cols-2 border-b border-subtle body-sm text-link'

export const nestedMenuActionButtonStyles =
	'flex min-h-10 min-w-0 items-center justify-center px-4 py-2.5 text-center text-link hover:bg-hover-row focus-visible:bg-hover-row'

export const nestedMenuSearchBlockStyles = 'relative px-4 py-3'

export const nestedMenuDisclosureIconStyles = 'size-4 justify-self-end text-tertiary'

export const nestedMenuHeaderIconButtonStyles =
	'flex size-10 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-hover-row hover:text-primary focus-visible:bg-hover-row focus-visible:text-primary'

export const nestedMenuRootFilterButtonStyles =
	'label-sm flex min-h-8 cursor-pointer flex-nowrap items-center justify-between gap-2 rounded-lg border border-medium px-3 py-1.5 text-primary hover:bg-hover-row focus-visible:bg-hover-row'

export function popoverMultiSelectCheckStyles(selected: boolean) {
	return `ml-auto grid size-3.5 shrink-0 place-items-center rounded-[4px] border ${
		selected ? 'border-brand bg-brand text-on-brand' : 'border-strong bg-transparent text-transparent'
	}`
}

export function popoverSingleSelectCheckStyles(selected: boolean) {
	return `ml-auto grid size-3.5 shrink-0 place-items-center text-link ${selected ? '' : 'invisible'}`
}

export const popoverMobileWrapperClassName =
	'max-sm:fixed! max-sm:right-0! max-sm:bottom-0! max-sm:left-0! max-sm:top-auto! max-sm:transform-none! max-sm:w-full!'

export const nestedPopoverMobileWrapperClassName =
	'max-sm:fixed! max-sm:right-0! max-sm:bottom-0! max-sm:left-0! max-sm:top-auto! max-sm:transform-none! max-sm:w-full!'

export const popoverMobileDismissStyles =
	'ml-auto flex size-10 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-hover-row hover:text-primary focus-visible:bg-hover-row focus-visible:text-primary sm:hidden'

/* Compatibility styles for quarantined surfaces that still consume shared menu/select components. */
export const legacySelectPopoverSurfaceStyles = `z-10 flex min-w-[180px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border border-medium bg-surface-elevated-1 ${selectSurfaceHeightStyles}`

export const excludedSurfaceComboboxPopoverSurfaceStyles = `z-10 flex min-w-[180px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border border-medium bg-surface-elevated-1 ${selectSurfaceHeightStyles}`

export const excludedSurfaceComboboxActionBarStyles =
	'sticky top-0 z-1 flex flex-wrap justify-between gap-1 border-b border-subtle bg-surface-elevated-1 text-xs text-link'

export const legacyMenuSurfaceStyles = `z-10 flex min-w-[180px] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border border-medium bg-surface-elevated-1 sm:max-w-md ${menuSurfaceHeightStyles}`

export const legacyNestedMenuSurfaceStyles = `flex flex-col gap-1 overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border border-medium bg-surface-elevated-1 max-sm:p-2 sm:p-0 ${nestedMenuSurfaceHeightStyles}`

export const legacyNestedMenuRootFilterButtonStyles =
	'relative flex cursor-pointer flex-nowrap items-center justify-between gap-2 rounded-md border border-medium px-2 py-1.5 text-xs font-medium text-secondary hover:bg-hover-row focus-visible:bg-hover-row'

export const legacyNestedMenuRootButtonStyles =
	'flex items-center justify-between gap-3 rounded-md bg-surface-elevated-1 px-3 py-2 text-primary hover:bg-surface-elevated-2 focus-visible:bg-surface-elevated-2'

export const legacyNestedMenuButtonStyles =
	'flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-primary hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row'

export const legacyPopoverRowStyles =
	'flex shrink-0 cursor-pointer items-center justify-between gap-4 overflow-hidden border-b border-medium px-3 py-2 text-primary cv-auto-37 first-of-type:rounded-t-md last-of-type:rounded-b-md hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row'

export const legacyPopoverExternalRowStyles =
	'shrink-0 cursor-pointer truncate border-b border-medium px-3 py-2 text-primary cv-auto-37 first-of-type:rounded-t-md last-of-type:rounded-b-md hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row'

export const legacySelectPopoverRowStyles =
	'flex shrink-0 cursor-pointer items-center justify-start gap-4 border-b border-medium px-3 py-2 text-primary cv-auto-37 last-of-type:rounded-b-md hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row'

export const legacyPopoverActionBarStyles =
	'sticky top-0 z-1 flex flex-wrap justify-between gap-1 border-b border-medium bg-surface-elevated-1 text-xs text-link'

export const legacyPopoverActionButtonStyles = 'p-3'

export const legacyPopoverSeeMoreStyles =
	'w-full cursor-pointer px-3 py-4 text-link hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row'

export const legacyPopoverSelectCheckStyles =
	'ml-auto flex size-3 shrink-0 items-center justify-center rounded-xs border border-brand text-link'
