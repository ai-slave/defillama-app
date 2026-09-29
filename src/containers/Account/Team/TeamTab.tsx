import { useRouter } from 'next/router'
import { useEffect, useRef, type RefObject } from 'react'
import { useAuthContext } from '~/auth'
import { SubscriptionLoadError } from '~/containers/Subscription/shared/SubscriptionLoadError'
import { Button } from '~/ui/Button'
import { LoadingIndicator } from '~/ui/Status'
import { CreateTeamCard } from './CreateTeamCard'
import { TeamFaqCard } from './TeamFaqCard'
import { TeamInfoCard } from './TeamInfoCard'
import { TeamInvitesCard } from './TeamInvitesCard'
import { TeamMembersCard } from './TeamMembersCard'
import { TeamMemberView } from './TeamMemberView'
import { TeamSeatsCard } from './TeamSeatsCard'
import { useTeam } from './useTeam'

const getQueryParam = (value: string | Array<string> | undefined) => (Array.isArray(value) ? value[0] : value)

export function TeamTab() {
	const regionRef = useRef<HTMLDivElement>(null)
	return (
		<div ref={regionRef} role="region" aria-label="Team management" tabIndex={-1}>
			<TeamTabContent finalFocus={regionRef} />
		</div>
	)
}

function TeamTabContent({ finalFocus }: { finalFocus: RefObject<HTMLElement | null> }) {
	const router = useRouter()
	const { promptVerifyEmail } = useAuthContext()
	const token = router.isReady ? getQueryParam(router.query.token) : undefined
	const {
		team,
		isTeamLoading,
		isTeamError,
		isTeamRetrying,
		refetchTeam,
		isAdmin,
		inviteAcceptance,
		inviteMembershipConfirmed: membershipConfirmed,
		inviteAccount
	} = useTeam({
		inviteToken: token
	})

	useEffect(() => {
		if (!router.isReady || !token) return
		if (!inviteAccount.isSuccess) return
		if (inviteAccount.data && !inviteAccount.data.verified) promptVerifyEmail(inviteAccount.data.id)
		const { token: _ignored, ...nextQuery } = router.query
		void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
	}, [inviteAccount.isSuccess, inviteAccount.data, promptVerifyEmail, router, token])

	if ((inviteAcceptance.isFetching || (membershipConfirmed && inviteAccount.isPending)) && token) {
		return (
			<div role="status" aria-live="polite" className="flex justify-center py-16">
				<LoadingIndicator label={membershipConfirmed ? 'Invite accepted. Loading your account' : 'Accepting invite'} />
			</div>
		)
	}

	if (token && membershipConfirmed && inviteAccount.isError) {
		return (
			<SubscriptionLoadError
				isRetrying={inviteAccount.isFetching}
				onRetry={() => void inviteAccount.refetch()}
				message="You joined the team, but account details could not be loaded."
			/>
		)
	}

	if (inviteAcceptance.isError && token && !isTeamLoading && !membershipConfirmed) {
		return (
			<div className="mx-auto flex max-w-md flex-col items-center gap-2 py-16 text-center">
				<h2 className="heading-xs text-primary">Check your invitation</h2>
				<p className="body-sm text-secondary">
					{inviteAcceptance.error?.message || 'The invite may have expired or already been used.'}
				</p>
				<p className="body-sm text-secondary">
					Make sure you&apos;re signed in with the email address the invite was sent to. If the connection dropped,
					check whether you already joined.
				</p>
				{isTeamError ? (
					<p role="alert" className="body-sm text-data-down">
						Could not check membership.
					</p>
				) : null}
				<Button
					type="button"
					size="md"
					className="mt-2"
					onClick={() => void refetchTeam()}
					pendingLabel={isTeamRetrying ? 'Checking membership…' : null}
				>
					Check membership
				</Button>
			</div>
		)
	}

	if (isTeamLoading) {
		return (
			<div role="status" aria-live="polite" className="flex h-64 items-center justify-center">
				<LoadingIndicator />
			</div>
		)
	}

	// A failed team read is unknown, not "no team": don't offer Create Team.
	if (isTeamError) {
		return (
			<SubscriptionLoadError
				isRetrying={isTeamRetrying}
				onRetry={() => void refetchTeam()}
				message="Couldn't load your team."
			/>
		)
	}

	if (!team) {
		return (
			<div className="flex flex-col gap-3">
				<CreateTeamCard />
				<TeamFaqCard />
			</div>
		)
	}

	if (!isAdmin) {
		return (
			<div className="flex flex-col gap-3">
				<TeamMemberView finalFocus={finalFocus} />
				<TeamFaqCard defaultOpenIndex={null} />
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-3">
			<TeamInfoCard />
			<TeamSeatsCard />
			<TeamMembersCard />
			<TeamInvitesCard />
			<TeamFaqCard defaultOpenIndex={null} />
		</div>
	)
}
