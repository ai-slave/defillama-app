import { useRouter } from 'next/router'
import { useEffect, useRef, type RefObject } from 'react'
import { useAuthContext } from '~/auth'
import { Button } from '~/ui/Button'
import { focusRegionOnLeave } from '~/ui/focus'
import { EmptyState, InlineStatus, PanelLoadingStatus } from '~/ui/Status'
import { queryReadFailed } from '~/utils/query'
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

	if (token && membershipConfirmed && queryReadFailed(inviteAccount)) {
		return (
			<InlineStatus variant="error" retry={inviteAccount}>
				You joined the team, but account details could not be loaded.
			</InlineStatus>
		)
	}

	if ((inviteAcceptance.isFetching || (membershipConfirmed && inviteAccount.isPending)) && token) {
		return (
			<PanelLoadingStatus
				label={membershipConfirmed ? 'Invite accepted. Loading your account' : 'Accepting invite'}
				className="min-h-64"
			/>
		)
	}

	if (inviteAcceptance.isError && token && !isTeamLoading && !membershipConfirmed) {
		return (
			<EmptyState
				size="lg"
				headingAs="h2"
				title="Check your invitation"
				actions={
					<div className="flex flex-col items-center gap-3">
						{isTeamError ? <InlineStatus variant="error">Couldn&apos;t check membership.</InlineStatus> : null}
						<Button
							ref={focusRegionOnLeave}
							type="button"
							size="md"
							onClick={() => void refetchTeam()}
							pendingLabel="Checking membership…"
							pending={isTeamRetrying}
						>
							Check membership
						</Button>
					</div>
				}
			>
				{inviteAcceptance.error?.message || 'The invite may have expired or already been used.'} Make sure you&apos;re
				signed in with the email address the invite was sent to. If the connection dropped, check whether you already
				joined.
			</EmptyState>
		)
	}

	if (isTeamLoading) {
		return <PanelLoadingStatus label="Loading team" className="min-h-64" />
	}

	// A failed team read is unknown, not "no team": don't offer Create team.
	if (isTeamError) {
		return (
			<InlineStatus variant="error" retry={{ refetch: refetchTeam, isFetching: isTeamRetrying }}>
				Couldn&apos;t load your team.
			</InlineStatus>
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
