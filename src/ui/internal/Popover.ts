import { tw } from '../tw'

/* Popover pieces: the surfaces' open and close motion (../PopoverSurface.tsx, ../Hovercard.tsx), the base row
   (`menuItemRowStyles`) that MenuItem and PopoverRow build their own recipes on, and the picker rows behind Select,
   SelectWithCombobox, VirtualizedSelect, MultiSelectCombobox, NestedMenu and Menu.

   Rows: px-3 py-2 body-sm, full-bleed, hover-row wash, 44px tall on phones. Nested-menu rows use the `nestedMenu*`
   recipes (16px sides, always 44px). A pick mark is ./Check.tsx, never a class string. */

export const surfaceMotionStyles = tw`sm:origin-(--popover-transform-origin) sm:scale-[.98] sm:opacity-0 sm:transition-[opacity,scale] sm:duration-180 sm:ease-out-quart sm:data-enter:scale-100 sm:data-enter:opacity-100 sm:data-leave:duration-140`

/* The desktop width ladder of every anchored surface, so a name is one width in a popover, a menu and a hovercard:
   `sm` 240px, `md` 320px, `lg` 384px, `xl` 600px. */
export const SURFACE_WIDTH_LADDER = {
	sm: 'w-60',
	md: 'w-80',
	lg: 'w-96',
	xl: 'w-[600px] max-w-[calc(100vw-2rem)]'
} as const

export const menuItemRowStyles = tw`flex w-full shrink-0 cursor-pointer items-center gap-2 overflow-hidden px-3 py-2 text-left body-sm aria-disabled:cursor-not-allowed aria-disabled:text-disabled data-focus-visible:focus-ring max-sm:min-h-11`

/* Virtualized lists measure each row, so their rows skip `content-visibility`: an off-screen row would report
   its placeholder size instead of its own. */
export const popoverMeasuredRowStyles = tw`flex shrink-0 cursor-pointer items-center justify-between gap-2 overflow-hidden px-3 py-2 body-sm text-primary not-aria-disabled:hover:bg-hover-row focus-visible:bg-hover-row aria-disabled:cursor-not-allowed aria-disabled:text-disabled data-active-item:bg-hover-row data-focus-visible:focus-ring max-sm:min-h-11`

export const popoverRowStyles = `${popoverMeasuredRowStyles} cv-auto-37 max-sm:cv-auto-44`

export const popoverRowWithBorderStyles = `${popoverRowStyles} border-b border-subtle last-of-type:border-b-0`

/* The list under a PopoverHeader scrolls on its own, so the title row and header stay put when Ariakit
   scrolls the selected option into view on open, or the user scrolls a long list. Neither reserves a
   scrollbar gutter: with always-visible scrollbars a reserved gutter leaves every short list lopsided. */
export const popoverScrollAreaStyles = tw`min-h-0 flex-1 overflow-y-auto overscroll-contain`

export const popoverSeeMoreStyles = tw`w-full cursor-pointer px-3 py-2 text-left body-sm text-link hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring max-sm:min-h-11`

// Nested-menu rows only render in phone sheets, so they keep the 44px touch height outright.
export const nestedMenuRootRowStyles = tw`grid min-h-11 w-full cursor-pointer grid-cols-[minmax(0,1fr)_1rem] items-center overflow-hidden px-4 py-2.5 text-left body-sm text-primary hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring`

export const nestedMenuSelectRowStyles = tw`grid min-h-11 w-full cursor-pointer grid-cols-[minmax(0,1fr)_1.25rem] items-center overflow-hidden border-b border-subtle px-4 py-2.5 text-left body-sm text-primary last-of-type:border-b-0 not-aria-disabled:hover:bg-hover-row focus-visible:bg-hover-row aria-disabled:cursor-not-allowed aria-disabled:text-disabled data-active-item:bg-hover-row data-focus-visible:focus-ring`

export const nestedMenuSeeMoreStyles = tw`min-h-11 w-full cursor-pointer px-4 py-2.5 text-left body-sm text-link hover:bg-hover-row focus-visible:bg-hover-row data-active-item:bg-hover-row data-focus-visible:focus-ring`

export const nestedMenuDisclosureIconStyles = tw`size-4 justify-self-end text-tertiary`
