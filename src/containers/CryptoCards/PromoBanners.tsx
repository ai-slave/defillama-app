import * as Ariakit from '@ariakit/react'
import Image from 'next/image'
import { Card } from '~/ui/Card'
import { EthenaPayInviteDialog } from './GetCardButton'

const CARD_PROMOS = [
	{
		id: 'plasma-one',
		name: 'Plasma One Card',
		src: '/assets/crypto-cards/plasma-one-v3.webp',
		href: 'https://www.plasma.org/download/LLAMAA',
		alt: 'Plasma One Card: 10% cashback on AI and flights, 4% cashback on everything else, access to 1900+ airport lounges, and $10K in value. Sign up.'
	},
	{
		id: 'ethena-pay',
		name: 'Ethena Pay',
		src: '/assets/crypto-cards/ethena-pay-v2.webp',
		alt: 'Ethena Pay promotion placeholder: earn yield on your balance, cashback on everyday spending, and use global multi-currency payments.'
	},
	{
		id: 'etherfi-cash',
		name: 'ether.fi Cash Card',
		src: '/assets/crypto-cards/etherfi-cash-v2.webp',
		href: 'https://www.ether.fi/@defillama',
		alt: 'ether.fi Cash Card promotion placeholder: borrow against ETH, earn cashback paid in ETH, and keep self-custody.'
	},
	{
		id: 'defillama-partner',
		name: 'DefiLlama partnership',
		src: '/assets/crypto-cards/defillama-partner-v2.webp',
		href: 'https://calendly.com/research-defillama/30min',
		alt: 'DefiLlama partnership promotion placeholder inviting card providers to set up a call.'
	}
]

export function PromoBanners() {
	return (
		<Ariakit.DialogProvider>
			<section
				aria-label="Featured card promotions"
				className="flex scrollbar-none touch-pan-x snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch] xl:grid xl:snap-none xl:grid-cols-4 xl:overflow-visible xl:pb-0"
			>
				{CARD_PROMOS.map((promo, index) => {
					const image = (
						<Image
							src={promo.src}
							alt={promo.alt}
							width={1200}
							height={565}
							loading={index === 0 ? 'eager' : 'lazy'}
							sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 83vw"
							className="h-auto w-full"
						/>
					)
					return (
						<Card
							as="figure"
							key={promo.id}
							padding="none"
							className="w-10/12 shrink-0 snap-start overflow-hidden sm:w-[calc(50%_-_0.25rem)] xl:w-auto"
							data-umami-event="crypto-cards-banner-click"
							data-umami-event-banner={promo.id}
							data-umami-event-placement="featured-promotions"
						>
							{promo.id === 'ethena-pay' ? (
								<Ariakit.DialogDisclosure
									render={<button type="button" className="block w-full cursor-pointer focus-visible:focus-ring" />}
									aria-label="Show Ethena Pay invite code"
								>
									{image}
								</Ariakit.DialogDisclosure>
							) : promo.href ? (
								<a
									href={promo.href}
									target="_blank"
									rel="noopener noreferrer sponsored"
									aria-label={`Open ${promo.name} offer`}
									className="block"
								>
									{image}
								</a>
							) : (
								image
							)}
						</Card>
					)
				})}
			</section>
			<EthenaPayInviteDialog />
		</Ariakit.DialogProvider>
	)
}
