import * as Ariakit from '@ariakit/react'
import { lazy, Suspense, useState } from 'react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { useDashboardCreation } from '~/containers/ProDashboard/hooks/useDashboardCreation'
import { useIsClient } from '~/hooks/useIsClient'
import { Button } from '~/ui/Button'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'

const SubscribeProModal = lazy(() =>
	import('~/containers/Subscription/shared/SubscribeCards/SubscribeProCard').then((m) => ({
		default: m.SubscribeProModal
	}))
)

export function FullOldViewButton() {
	const { createDashboardWithDataset, isLoading } = useDashboardCreation()
	const { loaders, isAuthenticated, hasActiveSubscription } = useAuthContext()
	const [shouldRenderModal, setShouldRenderModal] = useState(false)
	const subscribeModalStore = Ariakit.useDialogStore({ open: shouldRenderModal, setOpen: setShouldRenderModal })
	const isClient = useIsClient()

	const handleClick = () => {
		if (isLoading || loaders.userLoading) return

		if (isAuthenticated && hasActiveSubscription) {
			createDashboardWithDataset()
		} else {
			setSignupSource('open-in-dashboard')
			subscribeModalStore.show()
		}
	}

	const featureContent = (
		<div className="space-y-1 text-xs">
			<p className="font-semibold">Full View includes:</p>
			<ul className="list-inside list-disc pl-2">
				<li>Protocol Name & Logo</li>
				<li>24h Volume</li>
				<li>7d Volume</li>
				<li>30d Volume</li>
				<li>24h Change %</li>
				<li>7d Change %</li>
				<li>% of Total</li>
				<li>CSV Download</li>
			</ul>
		</div>
	)

	return (
		<>
			<span className="flex items-center gap-1">
				<Button type="button" size="md" onClick={handleClick} disabled={isLoading}>
					{isClient && isLoading ? <LoadingSpinner size={16} /> : <Icon name="plus" height={16} width={16} />}
					<span>Open in Dashboard</span>
				</Button>
				<Hovercard
					content={featureContent}
					contentClassName="w-max max-w-(--popover-available-width) p-3"
					render={<Button type="button" variant="ghost" size="md" square aria-label="What Full View includes" />}
				>
					<Icon name="help-circle" height={16} width={16} />
				</Hovercard>
			</span>
			{shouldRenderModal ? (
				<Suspense fallback={null}>
					<SubscribeProModal dialogStore={subscribeModalStore} />
				</Suspense>
			) : null}
		</>
	)
}
