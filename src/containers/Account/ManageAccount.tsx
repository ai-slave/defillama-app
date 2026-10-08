import { useRouter } from 'next/router'
import { useAuthContext } from '~/auth'
import { NewsletterSignup } from '~/components/Newsletter/NewsletterSignup'
import { ViewTabs } from '~/components/ViewTabs'
import { DashboardAuthorProfileCard } from '~/containers/Authors/DashboardAuthorProfileCard'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { useIsClient } from '~/hooks/useIsClient'
import { Button } from '~/ui/Button'
import { LoadingIndicator } from '~/ui/Status'
import { TabPanel, Tabs } from '~/ui/Tabs'
import { AuthenticationCard } from './AuthenticationCard'
import { DeleteAccountCard } from './DeleteAccountCard'
import { ReferralCard } from './ReferralCard'
import { SettingsCard } from './SettingsCard'
import { SubscriptionSection } from './SubscriptionSection'
import { TeamInviteLanding } from './Team/TeamInviteLanding'
import { TeamTab } from './Team/TeamTab'
import { UserHeader } from './UserHeader'
import { isWalletEmail, truncateAddress } from './utils'

const ACCOUNT_TABS = [
	{ id: 'account', label: 'Account' },
	{ id: 'team', label: 'Team' },
	{ id: 'profile', label: 'Profile' }
] as const
type AccountTab = (typeof ACCOUNT_TABS)[number]['id']
const ACCOUNT_TAB_IDS = ACCOUNT_TABS.map((tab) => tab.id)

export function ManageAccount() {
	const isClient = useIsClient()
	const router = useRouter()
	const { user, logout, isAuthenticated, loaders } = useAuthContext()

	const queryTab = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab
	const inviteToken = Array.isArray(router.query.token) ? router.query.token[0] : router.query.token
	const selectedTabId: AccountTab = queryTab === 'team' || queryTab === 'profile' ? queryTab : 'account'

	// The URL holds the tab; Account is the default and leaves no `?tab`.
	const selectTab = (tab: AccountTab) => {
		const { tab: _ignored, ...rest } = router.query
		const nextQuery = tab === 'account' ? rest : { ...rest, tab }
		void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
	}

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
					<h2 className="heading-sm text-primary">Account access required</h2>
					<p className="max-w-md body-md text-tertiary">Sign in to view and manage your account and subscription.</p>
				</div>
				<SignInModal
					trigger={
						<Button variant="primary" size="md">
							Sign in
						</Button>
					}
				/>
			</div>
		)
	}

	const displayName = isWalletEmail(user.email) ? truncateAddress(user.walletAddress) : user.email

	return (
		<div className="flex flex-col gap-8">
			<h1 className="heading-sm text-primary">Manage account</h1>
			<UserHeader displayName={displayName} onLogout={logout} />

			<Tabs value={selectedTabId} onValueChange={selectTab} values={ACCOUNT_TAB_IDS}>
				<ViewTabs tabs={ACCOUNT_TABS} label="Account sections" />

				<TabPanel value="account">
					<div className="flex flex-col gap-3">
						<AuthenticationCard />
						<ReferralCard />
						<SettingsCard />
						<NewsletterSignup layout="card" />
						<SubscriptionSection />
						<DeleteAccountCard />
					</div>
				</TabPanel>

				<TabPanel value="team">
					<TeamTab />
				</TabPanel>

				<TabPanel value="profile">
					<DashboardAuthorProfileCard />
				</TabPanel>
			</Tabs>
		</div>
	)
}
