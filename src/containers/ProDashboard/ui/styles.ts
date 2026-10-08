import { tw } from '~/ui/tw'

export const proCardShellStyles = tw`rounded-lg border border-pro-cards-border bg-pro-cards-bg`

export const proPanelStyles = tw`rounded-lg border border-pro-cards-border bg-pro-cards-bg p-4`

export const proInputStyles = tw`w-full rounded-md border border-pro-cards-border bg-pro-cards-bg px-3 py-1.5 body-md text-pro-text-primary placeholder:text-pro-text-tertiary focus:border-brand focus:ring-2 focus:ring-brand/30 focus:outline-hidden`

export const proMenuGroupLabelStyles = tw`px-3 pt-2 pb-1 body-sm text-pro-text-tertiary`

export const proTabStyles = tw`relative shrink-0 cursor-pointer px-3 py-2 label-md whitespace-nowrap text-pro-text-secondary after:absolute after:right-1 after:bottom-0 after:left-1 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-t-xs after:bg-pro-accent after:opacity-0 after:transition-[scale,opacity] after:duration-180 after:ease-out-quart hover:text-pro-text-primary focus-visible:text-pro-text-primary data-[active=true]:text-pro-text-primary data-[active=true]:after:scale-x-100 data-[active=true]:after:opacity-100`
