/* ----------------------------------------------------------------------------
   Popover/menu surface recipe from Figma 6183:293478.

   Surface owns the elevated background, medium border, 12px radius, and
   overflow. Rows/search/action/footer blocks own all spacing.
---------------------------------------------------------------------------- */

export const popoverSurfaceStyles =
	'z-10 flex min-w-[180px] flex-col overflow-auto overscroll-contain rounded-xl border border-medium bg-surface-elevated-1 px-0 py-0 max-sm:h-[calc(100dvh-80px)] max-sm:drawer max-sm:rounded-b-none sm:max-h-[min(400px,60dvh)] lg:max-h-(--popover-available-height)'

export const menuSurfaceStyles =
	'z-10 flex thin-scrollbar min-w-[180px] flex-col overflow-auto overscroll-contain rounded-xl border border-medium bg-surface-elevated-1 px-0 py-0 max-sm:h-[calc(100dvh-80px)] max-sm:drawer max-sm:rounded-b-none sm:max-h-[60dvh] sm:max-w-md lg:max-h-(--popover-available-height)'

export const popoverSearchResultsSurfaceStyles =
	'z-10 thin-scrollbar overflow-y-auto rounded-b-[8px] border border-medium bg-surface-elevated-1 shadow-sm'

export const popoverHovercardSurfaceStyles =
	'z-50 max-h-[calc(100dvh-80px)] overflow-auto overscroll-contain rounded-xl border border-medium bg-surface-elevated-1 body-sm lg:max-h-(--popover-available-height)'

export const popoverRowStyles =
	'body-sm flex shrink-0 cursor-pointer items-center justify-between gap-2 overflow-hidden px-3 py-2 text-primary cv-auto-37 hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row'

export const popoverRowWithBorderStyles = `${popoverRowStyles} border-b border-subtle last-of-type:border-b-0`

export const popoverMenuItemStyles =
	'body-sm flex shrink-0 cursor-pointer items-center gap-2 overflow-hidden px-3 py-2 text-primary hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row'

export const popoverTreeRowStyles =
	'body-sm group relative flex shrink-0 cursor-pointer items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap py-2 pr-3 text-primary hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-[active=true]:bg-hover-row'

export const popoverActionBarStyles =
	'grid w-full min-w-0 grid-cols-2 border-b border-subtle bg-surface-elevated-1 body-sm text-link'

export const popoverActionButtonStyles =
	'flex min-w-0 items-center justify-center truncate px-3 py-2 text-link hover:bg-hover-row focus-visible:bg-hover-row'

export const popoverSearchBlockStyles = 'relative p-3'

export const popoverSearchBlockWithBottomPaddingStyles = popoverSearchBlockStyles

export const popoverFooterActionStyles =
	'flex w-full min-w-0 items-center gap-2 overflow-hidden px-3 py-2 label-sm text-primary hover:bg-hover-row focus-visible:bg-hover-row'

export const popoverSeeMoreStyles =
	'body-sm w-full cursor-pointer px-3 py-2 text-left text-link hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row'

export function popoverMultiSelectCheckStyles(selected: boolean) {
	return `ml-auto grid size-3.5 shrink-0 place-items-center rounded-[4px] border ${
		selected ? 'border-brand bg-brand text-on-brand' : 'border-strong bg-transparent text-transparent'
	}`
}

export function popoverSingleSelectCheckStyles(selected: boolean) {
	return `ml-auto grid size-3.5 shrink-0 place-items-center text-link ${selected ? '' : 'invisible'}`
}

export const popoverMobileWrapperClassName =
	'max-sm:fixed! max-sm:bottom-0! max-sm:top-[unset]! max-sm:transform-none! max-sm:w-full!'

export const popoverMobileDismissStyles = 'ml-auto p-2 opacity-50 sm:hidden'

/* Compatibility styles for quarantined surfaces that still consume shared menu/select components. */
export const legacySelectPopoverSurfaceStyles =
	'z-10 flex min-w-[180px] flex-col overflow-auto overscroll-contain rounded-md border border-medium bg-surface-elevated-1 max-sm:h-[calc(100dvh-80px)] max-sm:drawer max-sm:rounded-b-none sm:max-h-[min(400px,60dvh)] lg:max-h-(--popover-available-height)'

export const excludedSurfaceComboboxPopoverSurfaceStyles =
	'z-10 flex min-w-[180px] flex-col overflow-auto overscroll-contain rounded-xl border border-medium bg-surface-elevated-1 max-sm:h-[calc(100dvh-80px)] max-sm:drawer max-sm:rounded-b-none sm:max-h-[min(400px,60dvh)] lg:max-h-(--popover-available-height)'

export const excludedSurfaceComboboxActionBarStyles =
	'sticky top-0 z-1 flex flex-wrap justify-between gap-1 border-b border-subtle bg-surface-elevated-1 text-xs text-link'

export const legacyMenuSurfaceStyles =
	'z-10 flex thin-scrollbar h-[calc(100dvh-80px)] min-w-[180px] flex-col overflow-auto overscroll-contain rounded-md border border-medium bg-surface-elevated-1 max-sm:drawer max-sm:rounded-b-none sm:max-h-[60dvh] sm:max-w-md lg:h-full lg:max-h-(--popover-available-height)'

export const legacyNestedMenuSurfaceStyles =
	'flex thin-scrollbar flex-col gap-1 rounded-md border border-medium bg-surface-elevated-1 max-sm:h-[calc(100dvh-80px)] max-sm:overflow-auto max-sm:overscroll-contain max-sm:rounded-b-none max-sm:p-2 sm:max-h-[60dvh] sm:overflow-x-hidden sm:overflow-y-auto sm:overscroll-contain sm:p-0'

export const legacyNestedMenuRootFilterButtonStyles =
	'relative flex cursor-pointer flex-nowrap items-center justify-between gap-2 rounded-md border border-medium px-2 py-1.5 text-xs font-medium text-secondary hover:bg-hover-row focus-visible:bg-hover-row'

export const legacyNestedMenuRootButtonStyles =
	'flex items-center justify-between gap-3 rounded-md bg-surface-elevated-1 px-3 py-2 text-primary hover:bg-surface-elevated-2 focus-visible:bg-surface-elevated-2'

export const legacyNestedMenuButtonStyles =
	'flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-primary hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row'

export const legacyPopoverRowStyles =
	'flex shrink-0 cursor-pointer items-center justify-between gap-4 overflow-hidden border-b border-medium px-3 py-2 text-primary cv-auto-37 first-of-type:rounded-t-md last-of-type:rounded-b-md hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row'

export const legacyPopoverExternalRowStyles =
	'shrink-0 cursor-pointer overflow-hidden border-b border-medium px-3 py-2 text-ellipsis whitespace-nowrap text-primary cv-auto-37 first-of-type:rounded-t-md last-of-type:rounded-b-md hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row'

export const legacySelectPopoverRowStyles =
	'flex shrink-0 cursor-pointer items-center justify-start gap-4 border-b border-medium px-3 py-2 text-primary cv-auto-37 last-of-type:rounded-b-md hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row'

export const legacyPopoverActionBarStyles =
	'sticky top-0 z-1 flex flex-wrap justify-between gap-1 border-b border-medium bg-surface-elevated-1 text-xs text-link'

export const legacyPopoverActionButtonStyles = 'p-3'

export const legacyPopoverSeeMoreStyles =
	'w-full cursor-pointer px-3 py-4 text-link hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row'

export const legacyPopoverSelectCheckStyles =
	'ml-auto flex size-3 shrink-0 items-center justify-center rounded-xs border border-brand text-link'
