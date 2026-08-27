import * as Ariakit from '@ariakit/react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { useSubscribe } from '~/auth/useSubscribe'
import { ManageAccount } from '~/containers/Account/ManageAccount'
import Layout from '~/layout'
import { WalletProvider } from '~/layout/WalletProvider'
import { Icon } from '~/ui/Icon'

export default function Account() {
	const router = useRouter()
	const queryClient = useQueryClient()
	const { isAuthenticated } = useAuthContext()
	const { hasActiveSubscription, isSubscriptionLoading } = useSubscribe()
	const topupProcessedRef = useRef(false)
	const successProcessedRef = useRef(false)
	const teamCheckoutProcessedRef = useRef(false)
	const [showSuccessModal, setShowSuccessModal] = useState(false)

	const topupSuccess = Array.isArray(router.query.topup) ? router.query.topup[0] : router.query.topup
	const success = Array.isArray(router.query.success) ? router.query.success[0] : router.query.success
	const teamCheckout = Array.isArray(router.query['team-checkout'])
		? router.query['team-checkout'][0]
		: router.query['team-checkout']

	// The checkout redirect lands before the webhook applies the purchase, so
	// re-read the affected data a bounded number of times instead of announcing
	// the result as already applied.
	const scheduleConfirmationReads = useCallback(
		(queryKey: string[]) => {
			void queryClient.invalidateQueries({ queryKey })
			for (const delay of [4000, 12000]) {
				window.setTimeout(() => void queryClient.invalidateQueries({ queryKey }), delay)
			}
		},
		[queryClient]
	)

	// Handle ?topup=success
	useEffect(() => {
		if (topupSuccess !== 'success' || !isAuthenticated || topupProcessedRef.current) return
		topupProcessedRef.current = true
		scheduleConfirmationReads(['ai-balance'])
		toast.success('Top-up payment received! Your External Data Balance will update shortly.')
		const { topup: _ignored, ...nextQuery } = router.query
		void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
	}, [topupSuccess, isAuthenticated, scheduleConfirmationReads, router])

	useEffect(() => {
		if (topupSuccess !== 'success') {
			topupProcessedRef.current = false
		}
	}, [topupSuccess])

	// Handle ?success=true (post-upgrade redirect from Stripe). A single read here
	// can race the webhook and cache a premature 404 as confirmed Free, so this
	// path uses the same bounded re-reads as the other checkout returns.
	useEffect(() => {
		if (success !== 'true' || !isAuthenticated || successProcessedRef.current) return
		successProcessedRef.current = true
		scheduleConfirmationReads(['subscription'])
		const { success: _ignored, ...nextQuery } = router.query
		void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
	}, [success, isAuthenticated, scheduleConfirmationReads, router])

	useEffect(() => {
		if (success !== 'true') {
			successProcessedRef.current = false
		}
	}, [success])

	useEffect(() => {
		if (successProcessedRef.current && !isSubscriptionLoading && hasActiveSubscription) {
			setShowSuccessModal(true)
		}
	}, [isSubscriptionLoading, hasActiveSubscription])

	// Handle ?team-checkout=success
	useEffect(() => {
		if (teamCheckout !== 'success' || !isAuthenticated || teamCheckoutProcessedRef.current) return
		teamCheckoutProcessedRef.current = true
		scheduleConfirmationReads(['team'])
		toast.success('Payment received! Your team seats will be available shortly.')
		const { 'team-checkout': _ignored, ...nextQuery } = router.query
		void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
	}, [teamCheckout, isAuthenticated, scheduleConfirmationReads, router])

	useEffect(() => {
		if (teamCheckout !== 'success') {
			teamCheckoutProcessedRef.current = false
		}
	}, [teamCheckout])

	return (
		<WalletProvider>
			<Layout
				title="Manage Account - DefiLlama"
				description="Manage your DefiLlama account settings and authentication."
				canonicalUrl="/account"
			>
				<div className="mx-auto w-full max-w-[720px] py-6">
					<ManageAccount />
				</div>

				<Ariakit.DialogProvider open={showSuccessModal} setOpen={() => setShowSuccessModal(false)}>
					<Ariakit.Dialog
						backdrop={<div className="bg-black/80" />}
						className="dialog max-h-[90vh] min-h-0 gap-0 overflow-y-auto rounded-2xl border-0 p-0 md:max-w-[380px]"
						portal
						unmountOnHide
					>
						<div className="flex flex-col items-center gap-6 bg-white px-5 py-8 dark:bg-sub-surface-dark">
							<div className="flex size-16 items-center justify-center rounded-full bg-sub-brand-primary/10">
								<Icon name="check" height={32} width={32} className="text-sub-brand-primary" />
							</div>
							<div className="flex flex-col gap-2 text-center">
								<h2 className="text-xl font-semibold text-sub-text-primary">Payment Successful!</h2>
								<p className="text-sm text-sub-text-muted">
									Your payment went through. Any plan changes will be reflected on your account shortly.
								</p>
							</div>
							<Ariakit.DialogDismiss className="flex h-10 w-full items-center justify-center rounded-lg bg-sub-brand-primary text-sm font-medium text-on-brand">
								Continue
							</Ariakit.DialogDismiss>
						</div>
					</Ariakit.Dialog>
				</Ariakit.DialogProvider>
			</Layout>
		</WalletProvider>
	)
}
