import { tw } from '~/ui/tw'

/* ----------------------------------------------------------------------------
   The chat's one code-block and data-table recipe. Tool arguments, SQL, logs,
   citation excerpts, pasted files, and markdown fences all render through
   these so every monospace surface in an answer shares the same chrome.
---------------------------------------------------------------------------- */

export const CODE_BLOCK = tw`m-0 overflow-auto rounded-lg border border-medium bg-surface-elevated-1 p-3 mono-sm break-words whitespace-pre-wrap text-primary`

export const DATA_TABLE_WRAPPER = tw`overflow-x-auto rounded-lg border border-medium bg-surface`
export const DATA_TABLE = tw`w-full body-sm`
export const DATA_TABLE_HEAD = tw`px-2 py-1 text-left label-sm whitespace-nowrap text-secondary`
export const DATA_TABLE_CELL = tw`px-2 py-1 whitespace-nowrap text-primary`
