import * as Ariakit from '@ariakit/react'
import Image from 'next/image'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { CopyHelper } from '~/ui/Copy'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'

const ETHENA_PAY_INVITE_CODE = 'TDQTXQ'
const ETHENA_PAY_DOWNLOAD_URL = 'https://pay.ethena.fi/download'

const CARD_PROMOS = [
	{
		id: 'ethena-pay',
		name: 'Ethena Pay',
		src: '/assets/crypto-cards/ethena-pay.webp',
		alt: 'Ethena Pay promotion placeholder: earn yield on your balance, cashback on everyday spending, and use global multi-currency payments.'
	},
	{
		id: 'plasma-one',
		name: 'Plasma One Card',
		src: '/assets/crypto-cards/plasma-one.webp',
		href: 'https://www.plasma.org/download/LLAMAA',
		alt: 'Plasma One Card promotion placeholder: spend stablecoins anywhere Visa is accepted, earn XPL cashback and yield, and get premium travel perks.'
	},
	{
		id: 'etherfi-cash',
		name: 'ether.fi Cash Card',
		src: '/assets/crypto-cards/etherfi-cash.webp',
		href: 'https://www.ether.fi/@defillama',
		alt: 'ether.fi Cash Card promotion placeholder: borrow against ETH, earn cashback paid in ETH, and keep self-custody.'
	},
	{
		id: 'defillama-partner',
		name: 'DefiLlama partnership',
		src: '/assets/crypto-cards/defillama-partner.webp',
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
							height={640}
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
			<Dialog size="sm" portal unmountOnHide backdrop={<div className="fixed inset-0 z-50 bg-screen-dim opacity-80" />}>
				<DialogHeader title="Get an Ethena Pay invite code" />
				<DialogBody>
					<p className="body-md text-secondary">Copy this code, then enter it when joining Ethena Pay.</p>
					<div className="flex items-center justify-between gap-4 rounded-lg border border-subtle bg-surface-elevated-1 p-4">
						<output className="min-w-0 mono-xl tracking-widest break-all text-primary" aria-label="Invite code">
							{ETHENA_PAY_INVITE_CODE}
						</output>
						<CopyHelper
							toCopy={ETHENA_PAY_INVITE_CODE}
							size={20}
							aria-label="Copy Ethena Pay invite code"
							data-umami-event="crypto-cards-invite-code-copy"
							data-umami-event-card="ethena-pay"
						/>
					</div>
					<div>
						<h3 className="label-md text-primary">How to use your code</h3>
						<ol className="mt-2 flex list-decimal flex-col gap-2 pl-5 body-sm text-secondary">
							<li>Download and open the Ethena Pay app.</li>
							<li>Start signing up and enter the invite code when prompted.</li>
							<li>Complete the remaining account setup in the app.</li>
						</ol>
					</div>
				</DialogBody>
				<DialogFooter>
					<Button
						as="a"
						href={ETHENA_PAY_DOWNLOAD_URL}
						target="_blank"
						rel="noopener noreferrer sponsored"
						variant="primary"
						size="md"
						data-umami-event="crypto-cards-invite-app-open"
						data-umami-event-card="ethena-pay"
					>
						Download Ethena Pay
						<Icon name="arrow-up-right" className="size-3.5" aria-hidden="true" />
					</Button>
				</DialogFooter>
			</Dialog>
		</Ariakit.DialogProvider>
	)
}
