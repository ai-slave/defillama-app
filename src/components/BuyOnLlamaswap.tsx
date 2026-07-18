import * as Ariakit from '@ariakit/react'
import { TokenLogo } from '~/components/TokenLogo'
import { Icon } from '~/ui/Icon'
import { popoverHovercardSurfaceStyles, popoverMenuItemStyles } from '~/ui/Popover'
import type { IProtocolLlamaswapChain } from '~/utils/metadata/types'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function buildSwapUrl(chain: Pick<IProtocolLlamaswapChain, 'chain' | 'address'>, placement: string) {
	const params = new URLSearchParams({
		chain: chain.chain,
		tab: 'swap',
		utm_source: 'defillama',
		utm_medium: 'buy_button',
		utm_content: placement
	})

	if (chain.address === ZERO_ADDRESS) {
		params.set('to', ZERO_ADDRESS)
	} else {
		params.set('from', ZERO_ADDRESS)
		params.set('to', chain.address)
	}

	return `https://swap.defillama.com/?${params.toString()}`
}

export function BuyOnLlamaswap({
	chains,
	placement = 'protocol_page',
	size = 'small'
}: {
	chains?: IProtocolLlamaswapChain[] | null
	placement?: string
	size?: 'small' | 'large'
}) {
	if (!chains?.length) return null
	const primaryChain = chains[0]

	if (chains.length === 1) {
		return (
			<a
				target="_blank"
				rel="noreferrer noopener"
				href={buildSwapUrl(primaryChain, placement)}
				className={
					size === 'small'
						? `hover-wash flex items-center gap-1 rounded-md bg-brand-faint px-1.5 py-0.5 label-sm text-link`
						: `flex items-center gap-1 rounded-full border-2 border-brand bg-brand px-2 py-1 label-sm text-on-brand hover:brightness-110`
				}
			>
				{size === 'small' ? 'Buy' : 'Buy Now'}
				<Icon name="external-link" className={size === 'small' ? 'size-2.5' : 'size-3.5'} />
			</a>
		)
	}

	return (
		<Ariakit.HovercardProvider showTimeout={0}>
			<Ariakit.HovercardAnchor
				render={<button />}
				className={
					size === 'small'
						? `hover-wash flex items-center gap-1 rounded-md bg-brand-faint px-1.5 py-0.5 label-sm text-link`
						: `flex items-center gap-1 rounded-full border-2 border-brand bg-brand px-2 py-1 label-sm text-on-brand hover:brightness-110`
				}
			>
				{size === 'small' ? 'Buy' : 'Buy Now'}
				<Icon name="chevron-down" className={size === 'small' ? 'size-2.5' : 'size-3.5'} />
			</Ariakit.HovercardAnchor>
			<Ariakit.Hovercard
				unmountOnHide
				gutter={6}
				overflowPadding={16}
				className={`${popoverHovercardSurfaceStyles} flex min-w-[min(180px,var(--popover-available-width))] flex-col`}
				portal
			>
				<span className="px-3 pt-2 pb-1 label-sm text-secondary">Select chain</span>
				{chains.map((chain) => (
					<a
						key={`${chain.chain}:${chain.address}`}
						href={buildSwapUrl(chain, placement)}
						target="_blank"
						rel="noreferrer noopener"
						className={`${popoverMenuItemStyles} rounded-md`}
					>
						<TokenLogo name={chain.displayName} kind="chain" size={18} />
						<span className="min-w-0 truncate capitalize">{chain.displayName}</span>
						{chain.best ? (
							<span className="ml-auto rounded-full bg-brand-muted px-1.5 py-0.5 label-sm text-link">Best</span>
						) : null}
					</a>
				))}
			</Ariakit.Hovercard>
		</Ariakit.HovercardProvider>
	)
}
