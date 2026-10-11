import * as Ariakit from '@ariakit/react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { useDashboardCreation } from '~/containers/ProDashboard/hooks/useDashboardCreation'
import { LazySubscribeProModal } from '~/containers/Subscription/shared/SubscribeCards/LazySubscribeProModal'
import { Button } from '~/ui/Button'
import { Hovercard } from '~/ui/Hovercard'
import { Icon } from '~/ui/Icon'

export function FullOldViewButton() {
	const { createDashboardWithDataset, isLoading } = useDashboardCreation()
	const { loaders, isAuthenticated, hasActiveSubscription } = useAuthContext()
	const subscribeModalStore = Ariakit.useDialogStore()

	const handleClick = () => {
		if (loaders.userLoading) return

		if (isAuthenticated && hasActiveSubscription) {
			createDashboardWithDataset()
		} else {
			setSignupSource('open-in-dashboard')
			subscribeModalStore.show()
		}
	}

	const featureContent = (
		<div className="space-y-1 body-sm">
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
				<Button type="button" size="md" onClick={handleClick} pendingLabel="Creating dashboard…" pending={isLoading}>
					<Icon name="plus" className="size-4" />
					<span>Open in Dashboard</span>
				</Button>
				<Hovercard
					content={featureContent}
					contentClassName="w-max max-w-(--popover-available-width) p-3"
					render={<Button type="button" variant="ghost" size="md" square aria-label="What Full View includes" />}
				>
					<Icon name="help-circle" className="size-4" />
				</Hovercard>
			</span>
			<LazySubscribeProModal dialogStore={subscribeModalStore} />
		</>
	)
}
