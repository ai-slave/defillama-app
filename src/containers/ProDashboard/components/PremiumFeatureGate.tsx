import { useState, type ReactNode } from 'react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { LoadingIndicator } from '~/ui/Status'
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
					<Icon name="file-lock-2" height={24} width={24} className="text-link" />
				</div>
				<div className="space-y-2">
					<h3 className="heading-xs text-pro-text-primary">{featureName}</h3>
					<p className="max-w-sm body-md text-pro-text-secondary">
						This feature requires a Pro subscription. Upgrade to unlock it.
					</p>
				</div>
				<Button
					type="button"
					onClick={() => {
						setSignupSource('pro-dashboard')
						setPaywallOpen(true)
					}}
					variant="primary"
					size="md"
				>
					<Icon name="sparkles" height={14} width={14} />
					Upgrade to Pro
				</Button>
			</div>

			{paywallOpen ? <DashboardPaywallModal reason={paywallReason} onClose={() => setPaywallOpen(false)} /> : null}
		</>
	)
}
