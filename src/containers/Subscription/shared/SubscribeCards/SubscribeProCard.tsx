import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { useAuthContext } from '~/auth'
import { useSubscribe } from '~/auth/useSubscribe'
import { BasicLink } from '~/components/Link'
import { PricingCardContent } from '~/containers/Subscription/components'
import { MONTHLY_PRICING_CARDS } from '~/containers/Subscription/data'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { ClientOnly } from '~/layout/ClientOnly'
import { Icon } from '~/ui/Icon'
import { trackUmamiEvent } from '~/utils/analytics/umami'

const PRO_CARD = MONTHLY_PRICING_CARDS.find((c) => c.key === 'pro')!

interface SubscribeProModalProps {
	dialogStore: Ariakit.DialogStore
}

export function SubscribeProModal({ dialogStore }: SubscribeProModalProps) {
	const router = useRouter()
	const { isAuthenticated } = useAuthContext()
	const { isTrialAvailable: isTrialAvailableFromApi } = useSubscribe()
	const signInDialogStore = Ariakit.useDialogStore()

	const isTrialAvailable = isAuthenticated ? isTrialAvailableFromApi : true

	useEffect(() => {
		if (dialogStore?.getState()?.open) {
			trackUmamiEvent('subscribe-modal-open', {
				page: router?.asPath
			})
		}
	}, [dialogStore, router?.asPath])

	return (
		<ClientOnly>
			<Ariakit.DialogProvider store={dialogStore}>
				<Ariakit.Dialog
					className="dialog flex max-h-[85dvh] max-w-md flex-col overflow-hidden rounded-xl border border-sub-border-slate-100 bg-white p-4 text-sub-text-primary shadow-2xl max-sm:drawer max-sm:rounded-b-none sm:p-6 dark:border-sub-border-strong dark:bg-sub-surface-dark"
					portal
					unmountOnHide
				>
					<span className="mx-auto flex h-full w-full max-w-[440px] flex-col overflow-hidden">
						<Ariakit.DialogDismiss className="ml-auto shrink-0 rounded-full p-1.5 text-sub-text-muted transition-colors hover:bg-sub-surface-slate-50 hover:text-sub-text-primary dark:text-sub-text-muted dark:hover:bg-sub-dark-card">
							<Icon name="x" height={18} width={18} />
							<span className="sr-only">Close</span>
						</Ariakit.DialogDismiss>
						<div className="min-h-0 flex-1 overflow-y-auto">
							<PricingCardContent card={PRO_CARD} isTrialAvailable={isTrialAvailable} />
						</div>
						<div className="flex shrink-0 flex-col gap-3 pt-3">
							<BasicLink
								href="/subscription"
								data-umami-event="subscribe-modal-goto-page"
								className="block w-full rounded-lg bg-sub-brand-primary px-4 py-2 text-center font-medium text-on-brand transition-colors hover:opacity-90"
							>
								Unlock Pro Features
							</BasicLink>

							{!isAuthenticated ? (
								<button
									type="button"
									className="mx-auto w-full flex-1 rounded-lg border border-sub-border-slate-100 py-2 text-center font-medium text-sub-text-secondary transition-colors hover:bg-sub-surface-slate-50 hover:text-sub-text-primary disabled:cursor-not-allowed dark:border-sub-border-strong dark:text-sub-text-muted dark:hover:bg-sub-dark-card"
									onClick={() => {
										signInDialogStore.show()
									}}
								>
									Already a subscriber? Sign In
								</button>
							) : null}
						</div>
					</span>
				</Ariakit.Dialog>
			</Ariakit.DialogProvider>
			<SignInModal store={signInDialogStore} />
		</ClientOnly>
	)
}
