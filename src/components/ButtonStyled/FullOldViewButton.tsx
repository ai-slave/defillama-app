import * as Ariakit from '@ariakit/react'
import { lazy, Suspense, useState } from 'react'
import { Icon } from '~/components/Icon'
import { LoadingSpinner } from '~/components/Loaders'
import { useDashboardCreation } from '~/containers/ProDashboard/hooks/useDashboardCreation'
import { useAuthContext } from '~/containers/Subscription/auth'
import { setSignupSource } from '~/containers/Subscription/signupSource'
import { useIsClient } from '~/hooks/useIsClient'
import { buttonStyles } from '~/ui/Button'
import { Hovercard } from '~/ui/Hovercard'

const SubscribeProModal = lazy(() =>
	import('~/components/SubscribeCards/SubscribeProCard').then((m) => ({ default: m.SubscribeProModal }))
)

export const FullOldViewButton = () => {
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

	const tooltipContent = (
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
			<Hovercard
				content={tooltipContent}
				render={<button onClick={handleClick} disabled={isLoading} />}
				className={buttonStyles({ size: 'md' })}
				showOnClick={false}
			>
				{isClient && isLoading ? <LoadingSpinner size={16} /> : <Icon name="plus" height={16} width={16} />}
				<span>Open in Dashboard</span>
			</Hovercard>
			{shouldRenderModal ? (
				<Suspense fallback={<></>}>
					<SubscribeProModal dialogStore={subscribeModalStore} />
				</Suspense>
			) : null}
		</>
	)
}
