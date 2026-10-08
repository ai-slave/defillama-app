import { tw } from '~/ui/tw'

export const proCardShellStyles = tw`rounded-lg border border-subtle bg-surface`

export const proPanelStyles = tw`rounded-lg border border-subtle bg-surface p-4`

export const proMenuGroupLabelStyles = tw`px-3 pt-2 pb-1 body-sm text-tertiary`

export const proTabStyles = tw`relative shrink-0 cursor-pointer px-3 py-2 label-md whitespace-nowrap text-secondary after:absolute after:right-1 after:bottom-0 after:left-1 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-t-xs after:bg-brand after:opacity-0 after:transition-[scale,opacity] after:duration-180 after:ease-out-quart hover:text-primary focus-visible:text-primary data-[active=true]:text-primary data-[active=true]:after:scale-x-100 data-[active=true]:after:opacity-100`
