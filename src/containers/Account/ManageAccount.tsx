import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { useAuthContext } from '~/auth'
import { NewsletterSignup } from '~/components/Newsletter/NewsletterSignup'
import { DashboardAuthorProfileCard } from '~/containers/Authors/DashboardAuthorProfileCard'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { useIsClient } from '~/hooks/useIsClient'
import { Button } from '~/ui/Button'
import { EmptyState, PanelLoadingStatus } from '~/ui/Status'
import { TabPanel, Tabs, UnderlineTabList } from '~/ui/Tabs'
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
	const signInDialogStore = Ariakit.useDialogStore()
	// Mounted beside the page, not in the signed-out gate, so a sign-in from another tab keeps the dialog's "You're
	// signed in" step.
	return (
		<>
			<AccountContent onSignIn={signInDialogStore.show} />
			<SignInModal store={signInDialogStore} />
		</>
	)
}

function AccountContent({ onSignIn }: { onSignIn: () => void }) {
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
		return <PanelLoadingStatus label="Loading account" className="min-h-64" />
	}

	if (!isAuthenticated || !user) {
		// Team invite link opened by a logged-out (possibly unregistered) user
		if (queryTab === 'team' && inviteToken) {
			return <TeamInviteLanding />
		}

		return (
			<EmptyState
				size="lg"
				icon="user"
				title="Account access required"
				headingAs="h1"
				actions={
					<Button variant="primary" size="md" onClick={onSignIn}>
						Sign in
					</Button>
				}
			>
				Sign in to view and manage your account and subscription.
			</EmptyState>
		)
	}

	const displayName = isWalletEmail(user.email) ? truncateAddress(user.walletAddress) : user.email

	return (
		<div className="flex flex-col gap-8">
			<h1 className="heading-sm text-primary">Manage account</h1>
			<UserHeader displayName={displayName} onLogout={logout} />

			<Tabs value={selectedTabId} onValueChange={selectTab} values={ACCOUNT_TAB_IDS}>
				<UnderlineTabList tabs={ACCOUNT_TABS} label="Account sections" />

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
