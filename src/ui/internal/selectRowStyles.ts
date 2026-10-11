import { tw } from '../tw'

/* The rows of a flat multi-select list in Select and SelectWithCombobox: each option row holds the option and its
   "Only" item. */

export const gridRowStyles = tw`group relative flex border-b border-subtle last-of-type:border-b-0`
// "Only" is a small button lying over the space its option keeps free before the check (the row's px-3, the 14px check
// and the gap-2 put it 34px from the edge), so the check stays at the edge. It shows while either item is active, so a
// keyboard reader sees it on reaching the row and a phone shows it on the row last tapped, and on desktop also on hover.
// Phones get a larger tap area. `h-fit` lets my-auto center it between inset-y-0 while min-h sets its height.
export const onlyItemStyles = tw`invisible absolute inset-y-0 right-[34px] my-auto flex h-fit min-h-6 cursor-pointer items-center rounded-md border border-subtle bg-surface px-2 label-sm text-secondary group-has-data-active-item:visible hover:border-medium hover:bg-hover-row hover:text-primary data-active-item:border-medium data-active-item:bg-hover-row data-active-item:text-primary data-focus-visible:focus-ring max-sm:min-h-8 max-sm:px-3 sm:group-hover:visible`
