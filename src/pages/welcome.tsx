import { SubscribeLayout } from '~/containers/Subscription/Layout'
import { WelcomeOnboarding } from '~/containers/Subscription/WelcomeOnboarding'
import { ClientOnly } from '~/layout/ClientOnly'

export default function Welcome() {
	return (
		<ClientOnly>
			<SubscribeLayout title="Welcome to Pro - DefiLlama" description="Set up your DefiLlama Pro experience.">
				<WelcomeOnboarding />
			</SubscribeLayout>
		</ClientOnly>
	)
}
