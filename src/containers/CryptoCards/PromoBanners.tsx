import Image from 'next/image'
import { Card } from '~/ui/Card'

const CARD_PROMOS = [
	{
		id: 'plasma-one',
		name: 'Plasma One Card',
		src: '/assets/crypto-cards/plasma-one.webp',
		alt: 'Plasma One Card promotion placeholder: spend stablecoins anywhere Visa is accepted, earn XPL cashback and yield, and get premium travel perks.'
	},
	{
		id: 'ethena-pay',
		name: 'Ethena Pay',
		src: '/assets/crypto-cards/ethena-pay.webp',
		alt: 'Ethena Pay promotion placeholder: earn yield on your balance, cashback on everyday spending, and use global multi-currency payments.'
	},
	{
		id: 'etherfi-cash',
		name: 'ether.fi Cash Card',
		src: '/assets/crypto-cards/etherfi-cash.webp',
		alt: 'ether.fi Cash Card promotion placeholder: borrow against ETH, earn cashback paid in ETH, and keep self-custody.'
	},
	{
		id: 'defillama-partner',
		name: 'DefiLlama partnership',
		src: '/assets/crypto-cards/defillama-partner.webp',
		alt: 'DefiLlama partnership promotion placeholder inviting card providers to set up a call.'
	}
]

export function PromoBanners() {
	return (
		<section
			aria-label="Featured card promotions"
			className="flex scrollbar-none touch-pan-x snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch] xl:grid xl:snap-none xl:grid-cols-4 xl:overflow-visible xl:pb-0"
		>
			{CARD_PROMOS.map((promo, index) => (
				<Card
					as="figure"
					key={promo.id}
					padding="none"
					className="w-10/12 shrink-0 snap-start overflow-hidden sm:w-[calc(50%_-_0.25rem)] xl:w-auto"
					data-umami-event="crypto-cards-banner-click"
					data-umami-event-banner={promo.id}
					data-umami-event-placement="featured-promotions"
				>
					<Image
						src={promo.src}
						alt={promo.alt}
						width={1200}
						height={640}
						loading={index === 0 ? 'eager' : 'lazy'}
						sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 83vw"
						className="h-auto w-full"
					/>
				</Card>
			))}
		</section>
	)
}
