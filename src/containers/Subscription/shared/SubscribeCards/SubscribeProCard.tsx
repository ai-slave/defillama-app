import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { useRef } from 'react'
import { useAuthContext } from '~/auth'
import { useSubscribe } from '~/auth/useSubscribe'
import { BasicLink } from '~/components/Link'
import { MONTHLY_PRICING_CARDS } from '~/containers/Subscription/data'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import type { FeatureItem } from '~/containers/Subscription/types'
import { useStableCallback } from '~/hooks/useStableCallback'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { trackUmamiEvent } from '~/utils/analytics/umami'

const PRO_CARD = MONTHLY_PRICING_CARDS.find((c) => c.key === 'pro')!

// The pricing page's card look stays on the page; inside the dialog the plan reads as dialog copy.
function FeatureLabel({ item }: { item: FeatureItem }) {
	if (!item.link) return item.label
	const idx = item.linkText ? item.label.indexOf(item.linkText) : -1
	if (idx === -1)
		return (
			<a href={item.link} className="text-link underline">
				{item.label}
			</a>
		)
	return (
		<>
			{item.label.slice(0, idx)}
			<a href={item.link} className="text-link underline">
				{item.linkText}
			</a>
			{item.label.slice(idx + item.linkText!.length)}
		</>
	)
}

interface SubscribeProModalProps {
	dialogStore: Ariakit.DialogStore
	source?: string
	placement?: string
}

export function SubscribeProModal({ dialogStore, source, placement }: SubscribeProModalProps) {
	const router = useRouter()
	const { isAuthenticated } = useAuthContext()
	const { isTrialAvailable: isTrialAvailableFromApi } = useSubscribe()
	const signInDialogStore = Ariakit.useDialogStore()
	const unlockRef = useRef<HTMLAnchorElement>(null)

	const isTrialAvailable = isAuthenticated ? isTrialAvailableFromApi : true

	// The dialog unmounts its content on hide, so the marker below mounts once per opening. Stable, so a render never
	// re-attaches it.
	const trackOpen = useStableCallback((node: HTMLSpanElement | null) => {
		if (!node) return
		trackUmamiEvent('subscribe-modal-open', {
			page: router.asPath,
			...(source ? { source } : {}),
			...(placement ? { placement } : {})
		})
	})

	// The dialog stays open when the reader signs in on another tab: closing it under them would take away the plan
	// they are reading, and its checkout works signed in.
	return (
		<>
			<Dialog size="sm" store={dialogStore} portal unmountOnHide>
				<span hidden ref={trackOpen} />
				<DialogHeader title={`Upgrade to ${PRO_CARD.title}`} subtitle={PRO_CARD.subtitle} />
				<DialogBody>
					<div className="flex flex-col gap-1">
						<p className="flex items-baseline gap-1">
							<span className="heading-sm text-primary">{PRO_CARD.priceMain}</span>
							<span className="body-sm text-secondary">{PRO_CARD.priceUnit}</span>
						</p>
						<p className="body-sm text-secondary">
							{isTrialAvailable ? '7-day free trial available' : PRO_CARD.priceSecondary}
						</p>
					</div>
					<p className="body-sm text-secondary">{PRO_CARD.includedTierText}</p>
					{PRO_CARD.sections.map((section) => (
						<section key={section.title} className="flex flex-col gap-2">
							<h3 className="label-sm text-primary">{section.title}</h3>
							<ul className="flex flex-col gap-1.5 body-sm">
								{section.items.map((item) => (
									<li
										key={item.label}
										className={`flex items-start gap-2 ${item.isSubItem ? 'pl-6 text-secondary' : item.availability === 'check' ? 'text-primary' : 'text-tertiary'}`}
									>
										{item.isSubItem ? null : (
											<Icon
												name={item.availability === 'check' ? 'check' : 'x'}
												className={`size-4 shrink-0 ${item.availability === 'check' ? 'text-link' : 'text-tertiary'}`}
												aria-hidden
											/>
										)}
										<span>
											{item.availability === 'check' ? null : <span className="sr-only">Not included: </span>}
											<FeatureLabel item={item} />
										</span>
									</li>
								))}
							</ul>
						</section>
					))}
				</DialogBody>
				<DialogFooter
					leading={
						isAuthenticated ? null : (
							<Button type="button" variant="ghost" size="md" onClick={signInDialogStore.show}>
								Already a subscriber? Sign in
							</Button>
						)
					}
				>
					<Button
						as={BasicLink}
						ref={unlockRef}
						variant="primary"
						size="md"
						href="/subscription"
						data-umami-event="subscribe-modal-goto-page"
					>
						Unlock Pro features
					</Button>
				</DialogFooter>
			</Dialog>
			<SignInModal
				store={signInDialogStore}
				// Signing in removes the sign-in button this dialog returns focus to; the plan's action takes it.
				onAuthenticated={() => signInDialogStore.setDisclosureElement(unlockRef.current)}
			/>
		</>
	)
}
