import { tw } from '../tw'

/* Popover pieces: the surfaces' open and close motion, and the menu row that ../Popover.ts's popoverMenuItemStyles and
   MenuItem's destructive row (../PopoverSurface.tsx) share. */

export const surfaceMotionStyles = tw`sm:origin-(--popover-transform-origin) sm:scale-[.98] sm:opacity-0 sm:transition-[opacity,scale] sm:duration-180 sm:ease-out-quart sm:data-enter:scale-100 sm:data-enter:opacity-100 sm:data-leave:duration-140`

export const menuItemRowStyles = tw`flex shrink-0 cursor-pointer items-center gap-2 overflow-hidden px-3 py-2 body-sm aria-disabled:cursor-not-allowed aria-disabled:text-disabled data-focus-visible:focus-ring max-sm:min-h-11`
