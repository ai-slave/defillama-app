import * as Ariakit from '@ariakit/react'
import { useSyncExternalStore, type ReactNode } from 'react'
import { StoreButtons } from '~/containers/MobileApp'
import { useIsClient } from '~/hooks/useIsClient'
import { useMedia } from '~/hooks/useMedia'
import { catchLostFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import {
	createAnnouncementDismissalToken,
	dismissAnnouncement,
	isAnnouncementDismissed,
	subscribeToAnnouncementDismissals
} from '~/utils/cookies'

const promotionDismissalToken = createAnnouncementDismissalToken('llamaai-mobile-app-promotion', '2026-08-03')

const continueOnWeb = () => dismissAnnouncement(promotionDismissalToken)

function MobileAppPromotion() {
	return (
		<Ariakit.Dialog
			open
			onClose={continueOnWeb}
			ref={catchLostFocus}
			hideOnInteractOutside={false}
			portal
			className="fixed inset-0 z-[100] flex h-dvh w-screen overflow-y-auto bg-sub-surface-page p-[max(20px,env(safe-area-inset-top))_20px_max(20px,env(safe-area-inset-bottom))] text-sub-text-primary outline-hidden dark:bg-sub-dark-page"
		>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 [background-image:var(--sub-grid-image-light)] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)] [background-size:52px_52px] opacity-40 dark:[background-image:var(--sub-grid-image-dark)] dark:opacity-25"
			/>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[480px] max-w-full -translate-x-1/2 rounded-full bg-sub-brand-primary/20 blur-[100px] dark:bg-sub-blue/25"
			/>

			<Ariakit.DialogDismiss className="absolute top-[max(16px,env(safe-area-inset-top))] right-[max(16px,env(safe-area-inset-right))] flex size-9 items-center justify-center rounded-full text-sub-text-muted transition-colors hover:bg-sub-surface-panel hover:text-sub-text-primary dark:hover:bg-sub-dark-card">
				<Icon name="x" height={18} width={18} />
				<span className="sr-only">Close</span>
			</Ariakit.DialogDismiss>

			<div className="relative m-auto flex w-full max-w-md flex-col items-center gap-6 text-center">
				<div className="flex flex-col items-center gap-3">
					<span className="flex items-center gap-2 rounded-full border border-sub-brand-primary/25 bg-sub-brand-primary/10 px-3 py-1 text-xs font-semibold tracking-wide text-sub-brand-primary uppercase dark:text-sub-brand-softest">
						<span className="size-1.5 rounded-full bg-sub-live shadow-sub-live" />
						Now on iOS and Android
					</span>

					<Ariakit.DialogHeading className="text-4xl leading-[1.1] font-semibold tracking-tight text-sub-text-primary">
						The{' '}
						<span className="bg-linear-to-r from-sub-purple to-sub-purple-soft bg-clip-text text-transparent">
							DefiLlama App
						</span>{' '}
						is here
					</Ariakit.DialogHeading>
					<p className="max-w-sm text-base leading-7 text-sub-text-secondary">
						Get extra free LlamaAI queries and take your crypto research with you.
					</p>
				</div>

				<div className="relative motion-safe:animate-float">
					<div
						aria-hidden="true"
						className="absolute top-1/2 left-1/2 size-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sub-brand-primary/25 blur-[70px] dark:bg-sub-blue/35"
					/>
					<div
						aria-hidden="true"
						className="absolute top-1/2 left-1/2 size-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sub-brand-primary/10"
					/>
					<img
						src="/assets/app/forecast.webp"
						alt=""
						width={760}
						height={1245}
						className="absolute top-1 left-5 w-44 rotate-[8deg] rounded-[1.4rem] border border-sub-border/60 opacity-85"
					/>
					<img
						src="/assets/app/thesis.webp"
						alt="LlamaAI in the DefiLlama mobile app"
						width={760}
						height={1245}
						className="relative w-44 rounded-[1.4rem] border border-sub-border/60 shadow-xl shadow-sub-brand-primary/15"
					/>
				</div>

				{/* Store taps leave the site, so dismiss on any click within the store buttons */}
				<div className="flex w-full flex-col items-center gap-6">
					<div className="w-full" onClickCapture={continueOnWeb}>
						<StoreButtons eventSuffix="llamaai-gate" size="lg" />
					</div>
					<button
						type="button"
						onClick={continueOnWeb}
						data-umami-event="mobile-app-llamaai-gate-continue-web"
						className="flex h-11 w-full max-w-[300px] items-center justify-center rounded-xl border border-sub-border bg-sub-surface-panel px-6 text-sm font-medium text-sub-text-secondary transition-colors hover:border-sub-brand-primary/40 hover:text-sub-text-primary dark:bg-sub-dark-card"
					>
						Continue on the web
					</button>
				</div>
			</div>
		</Ariakit.Dialog>
	)
}

function useMobileAppPromotion() {
	const isClient = useIsClient()
	const isMobile = useMedia('(max-width: 1023px)')
	const hasContinued = useSyncExternalStore(
		subscribeToAnnouncementDismissals,
		() => isAnnouncementDismissed(promotionDismissalToken),
		() => false
	)

	return { isClient, shouldShow: isClient && isMobile && !hasContinued }
}

export function LlamaAIMobileAppPromotion() {
	const { shouldShow } = useMobileAppPromotion()
	return shouldShow ? <MobileAppPromotion /> : null
}

export function LlamaAIMobileAppGate({ children }: { children: ReactNode }) {
	const { isClient, shouldShow } = useMobileAppPromotion()

	// Chat must not mount until the viewport is known, otherwise a
	// queued prompt could submit during mobile hydration behind the promotion.
	if (!isClient) {
		return <div className="min-h-dvh flex-1" aria-busy="true" />
	}

	if (shouldShow) {
		return <MobileAppPromotion />
	}

	return children
}
