import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { useAuthContext } from '~/auth'
import { NewsletterSignup } from '~/components/Newsletter/NewsletterSignup'
import { DashboardAuthorProfileCard } from '~/containers/Authors/DashboardAuthorProfileCard'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { useIsClient } from '~/hooks/useIsClient'
import { buttonStyles } from '~/ui/Button'
import { LoadingIndicator } from '~/ui/Status'
import { AuthenticationCard } from './AuthenticationCard'
import { DeleteAccountCard } from './DeleteAccountCard'
import { ReferralCard } from './ReferralCard'
import { SettingsCard } from './SettingsCard'
import { SubscriptionSection } from './SubscriptionSection'
import { TeamInviteLanding } from './Team/TeamInviteLanding'
import { TeamTab } from './Team/TeamTab'
import { UserHeader } from './UserHeader'
import { isWalletEmail, truncateAddress } from './utils'

export function ManageAccount() {
	const isClient = useIsClient()
	const router = useRouter()
	const { user, logout, isAuthenticated, loaders } = useAuthContext()

	const queryTab = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab
	const inviteToken = Array.isArray(router.query.token) ? router.query.token[0] : router.query.token
	const selectedTabId = queryTab === 'team' || queryTab === 'profile' ? queryTab : 'account'

	const tabStore = Ariakit.useTabStore({
		selectedId: selectedTabId,
		setSelectedId: (id) => {
			if (!id) return
			const { tab: _ignored, ...rest } = router.query
			const nextQuery = id === 'account' ? rest : { ...rest, tab: id }
			void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
		}
	})

	if (!isClient || loaders.userLoading || !router.isReady) {
		return (
			<div role="status" aria-live="polite" className="flex h-64 items-center justify-center">
				<LoadingIndicator />
			</div>
		)
	}

	if (!isAuthenticated || !user) {
		// Team invite link opened by a logged-out (possibly unregistered) user
		if (queryTab === 'team' && inviteToken) {
			return <TeamInviteLanding />
		}

		return (
			<div className="flex flex-col items-center gap-6 py-16">
				<img src="/assets/account_avatar.png" alt="" className="size-16 rounded-full" />
				<div className="flex flex-col gap-2 text-center">
					<h2 className="heading-sm text-sub-text-primary">Account Access Required</h2>
					<p className="max-w-md body-md text-sub-text-muted">
						Sign in to view and manage your account and subscription.
					</p>
				</div>
				<SignInModal text="Sign In" className={buttonStyles({ variant: 'primary', size: 'md' })} />
			</div>
		)
	}

	const displayName = isWalletEmail(user.email) ? truncateAddress(user.walletAddress) : user.email

	return (
		<div className="flex flex-col gap-8">
			<h1 className="heading-sm text-sub-text-primary">Manage Account</h1>
			<UserHeader displayName={displayName} onLogout={logout} />

			<Ariakit.TabProvider store={tabStore}>
				<Ariakit.TabList className="flex gap-4 border-b border-sub-border">
					<Ariakit.Tab
						id="account"
						className={`pb-2.5 text-sm font-semibold transition-colors ${
							selectedTabId === 'account'
								? 'border-b-2 border-sub-brand-primary text-sub-brand-primary'
								: 'text-sub-text-muted hover:text-sub-text-primary'
						}`}
					>
						Account
					</Ariakit.Tab>
					<Ariakit.Tab
						id="team"
						className={`pb-2.5 text-sm font-semibold transition-colors ${
							selectedTabId === 'team'
								? 'border-b-2 border-sub-brand-primary text-sub-brand-primary'
								: 'text-sub-text-muted hover:text-sub-text-primary'
						}`}
					>
						Team
					</Ariakit.Tab>
					<Ariakit.Tab
						id="profile"
						className={`pb-2.5 text-sm font-semibold transition-colors ${
							selectedTabId === 'profile'
								? 'border-b-2 border-sub-brand-primary text-sub-brand-primary'
								: 'text-sub-text-muted hover:text-sub-text-primary'
						}`}
					>
						Profile
					</Ariakit.Tab>
				</Ariakit.TabList>

				<Ariakit.TabPanel tabId="account">
					<div className="flex flex-col gap-3">
						<AuthenticationCard />
						<ReferralCard />
						<SettingsCard />
						<NewsletterSignup layout="card" />
						<SubscriptionSection />
						<DeleteAccountCard />
					</div>
				</Ariakit.TabPanel>

				<Ariakit.TabPanel tabId="team">
					<TeamTab />
				</Ariakit.TabPanel>

				<Ariakit.TabPanel tabId="profile">
					<DashboardAuthorProfileCard />
				</Ariakit.TabPanel>
			</Ariakit.TabProvider>
		</div>
	)
}
