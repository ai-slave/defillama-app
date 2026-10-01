import * as Ariakit from '@ariakit/react'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { Button } from '~/ui/Button'
import { CopyHelper } from '~/ui/Copy'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'

/** Ethena Pay sign-up needs an invite code, so its Get button opens the code instead of the
 *  card's link: the same dialog the promo banner opens. */
const ETHENA_PAY_CARD_ID = 'ethena-pay'
const ETHENA_PAY_INVITE_CODE = 'TDQTXQ'
const ETHENA_PAY_DOWNLOAD_URL = 'https://pay.ethena.fi/download'

export function EthenaPayInviteDialog() {
	return (
		<Dialog size="sm" portal unmountOnHide>
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
						data-umami-event-card={ETHENA_PAY_CARD_ID}
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
					data-umami-event-card={ETHENA_PAY_CARD_ID}
				>
					Download Ethena Pay
					<Icon name="arrow-up-right" className="size-3.5" aria-hidden="true" />
				</Button>
			</DialogFooter>
		</Dialog>
	)
}

interface GetCardButtonProps {
	cardId: string
	cardName: string
	/** The card's website, which is its partner link when there is one. */
	url: string | null
	/** A table row gets a compact pill in the sticky Card column; the detail page gets its one
	 *  primary action. */
	placement: 'table' | 'details'
}

export function GetCardButton({ cardId, cardName, url, placement }: GetCardButtonProps) {
	const tracking = {
		'data-umami-event': 'crypto-cards-get-card',
		'data-umami-event-card': cardId,
		'data-umami-event-placement': placement
	}

	if (cardId === ETHENA_PAY_CARD_ID) {
		return (
			<Ariakit.DialogProvider>
				<Ariakit.DialogDisclosure
					render={
						placement === 'table' ? (
							<Button size="md" />
						) : (
							<Button variant="primary" size="md" className="max-sm:w-full" />
						)
					}
					aria-label={`Get ${cardName} invite code`}
					{...tracking}
				>
					{placement === 'table' ? 'Get' : 'Get card'}
					<Icon name="arrow-up-right" className="size-3.5 shrink-0" aria-hidden="true" />
				</Ariakit.DialogDisclosure>
				<EthenaPayInviteDialog />
			</Ariakit.DialogProvider>
		)
	}
	if (!url) return null
	// A table row's link pill matches the rewards table's per-row "Open" link; brand borders stay
	// for selected states, and the row's name is already the blue link.
	if (placement === 'table') {
		return (
			<ExternalLinkButton href={url} aria-label={`Get ${cardName}`} {...tracking}>
				Get
			</ExternalLinkButton>
		)
	}
	return (
		<Button
			as="a"
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			variant="primary"
			size="md"
			className="max-sm:w-full"
			{...tracking}
		>
			Get card
			<Icon name="arrow-up-right" className="size-3.5" aria-hidden="true" />
		</Button>
	)
}
