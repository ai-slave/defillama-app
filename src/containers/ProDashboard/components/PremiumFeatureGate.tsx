import { useState, type ReactNode } from 'react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { EmptyState, SurfaceBodyLoadingStatus } from '~/ui/Status'
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
		return <SurfaceBodyLoadingStatus className="min-h-[300px]" />
	}

	return (
		<>
			<EmptyState
				size="md"
				icon="file-lock-2"
				title={featureName}
				className="min-h-[300px]"
				actions={
					<Button
						type="button"
						onClick={() => {
							setSignupSource('pro-dashboard')
							setPaywallOpen(true)
						}}
						variant="primary"
						size="sm"
					>
						<Icon name="sparkles" height={14} width={14} />
						Upgrade to Pro
					</Button>
				}
			>
				This feature requires a Pro subscription. Upgrade to unlock it.
			</EmptyState>

			{paywallOpen ? <DashboardPaywallModal reason={paywallReason} onClose={() => setPaywallOpen(false)} /> : null}
		</>
	)
}
