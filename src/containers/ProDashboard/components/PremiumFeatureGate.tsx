import { useState, type ReactNode } from 'react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { Icon } from '~/ui/Icon'
import { LoadingIndicator } from '~/ui/Status'
import { ProButton } from '../ui'
import { DashboardPaywallModal, type PaywallReason } from './DashboardPaywallModal'

interface PremiumFeatureGateProps {
	featureName: string
	paywallReason?: PaywallReason
	children: ReactNode
}

export function PremiumFeatureGate({ featureName, paywallReason = 'pro-feature', children }: PremiumFeatureGateProps) {
	const { hasActiveSubscription, loaders } = useAuthContext()
	const [paywallOpen, setPaywallOpen] = useState(false)

	if (hasActiveSubscription) {
		return <>{children}</>
	}

	if (loaders.userLoading) {
		return (
			<div className="flex min-h-[300px] items-center justify-center">
				<LoadingIndicator />
			</div>
		)
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
				<ProButton
					type="button"
					onClick={() => {
						setSignupSource('pro-dashboard')
						setPaywallOpen(true)
					}}
					variant="primary"
					size="lg"
				>
					<Icon name="sparkles" height={16} width={16} />
					Upgrade to Pro
				</ProButton>
			</div>

			{paywallOpen ? <DashboardPaywallModal reason={paywallReason} onClose={() => setPaywallOpen(false)} /> : null}
		</>
	)
}
