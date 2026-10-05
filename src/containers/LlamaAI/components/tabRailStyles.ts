import { tw } from '~/ui/tw'

/* ----------------------------------------------------------------------------
   The vertical tab rail beside a dialog or popover panel: Settings sections
   and Explore categories. The rail is w-48 with p-2 and gap-0.5 on bg-page,
   divided from the panel by border-r.

   Item: label-sm, px-3 py-2, 14px icon (`size-3.5`) with an 8px gap.
   Inactive text-secondary, primary on hover, with the hover wash. Selected
   (`data-active` from `Tab`) is bg-brand-muted + text-link-on-tint.
---------------------------------------------------------------------------- */

export const RAIL_TAB = tw`hover-wash flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left label-sm whitespace-nowrap text-secondary hover:text-primary data-[active=true]:bg-brand-muted data-[active=true]:text-link-on-tint`
