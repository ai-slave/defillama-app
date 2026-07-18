import * as Ariakit from '@ariakit/react'
import { useState, type ReactNode } from 'react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { Icon } from '~/ui/Icon'
import { DashboardPaywallModal, type PaywallReason } from './DashboardPaywallModal'

interface PremiumFeatureGateProps {
	featureName: string
	paywallReason?: PaywallReason
	children: ReactNode
}

export function PremiumFeatureGate({ featureName, paywallReason = 'pro-feature', children }: PremiumFeatureGateProps) {
	const { hasActiveSubscription } = useAuthContext()
	const [paywallOpen, setPaywallOpen] = useState(false)
	const paywallDialogStore = Ariakit.useDialogStore({ open: paywallOpen, setOpen: setPaywallOpen })

	if (hasActiveSubscription) {
		return <>{children}</>
	}

	return (
		<>
			<div className="flex min-h-[300px] flex-col items-center justify-center gap-4 p-6 text-center">
				<div className="flex size-12 items-center justify-center rounded-full bg-brand/10">
					<Icon name="file-lock-2" height={24} width={24} className="text-brand" />
				</div>
				<div className="space-y-2">
					<h3 className="text-lg font-semibold text-pro-text-primary">{featureName}</h3>
					<p className="max-w-sm text-sm text-pro-text-secondary">
						This feature requires a Pro subscription. Upgrade to unlock it.
					</p>
				</div>
				<button
					onClick={() => {
						setSignupSource('pro-dashboard')
						setPaywallOpen(true)
					}}
					className="flex items-center gap-2 rounded-md pro-btn-primary px-6 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
				>
					<Icon name="sparkles" height={16} width={16} />
					Upgrade to Pro
				</button>
			</div>

			{paywallOpen ? <DashboardPaywallModal dialogStore={paywallDialogStore} reason={paywallReason} /> : null}
		</>
	)
}
