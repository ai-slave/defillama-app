import { useRouter } from 'next/router'
import { useEffect, useRef, type RefObject } from 'react'
import { useAuthContext } from '~/auth'
import { SubscriptionLoadError } from '~/containers/Subscription/shared/SubscriptionLoadError'
import { Icon } from '~/ui/Icon'
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
	const { team, isTeamLoading, isTeamError, isTeamRetrying, refetchTeam, isAdmin, inviteAcceptance, inviteAccount } =
		useTeam({
			inviteToken: token
		})

	// An invite token replay fails once membership exists (lost response, re-opened
	// link), so actual membership wins over the stale invite error.
	const membershipConfirmed = inviteAcceptance.isSuccess || (inviteAcceptance.isError && Boolean(team))

	useEffect(() => {
		if (!router.isReady || !token) return
		if (!inviteAccount.isSuccess) return
		if (inviteAccount.data && !inviteAccount.data.verified) promptVerifyEmail(inviteAccount.data.id)
		const { token: _ignored, ...nextQuery } = router.query
		void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true })
	}, [inviteAccount.isSuccess, inviteAccount.data, promptVerifyEmail, router, token])

	if ((inviteAcceptance.isFetching || (membershipConfirmed && inviteAccount.isPending)) && token) {
		return (
			<div className="flex flex-col items-center gap-4 py-16">
				<div className="size-8 animate-spin rounded-full border-2 border-sub-brand-primary border-t-transparent" />
				<p className="text-sm text-sub-text-muted">
					{membershipConfirmed ? 'Invite accepted. Loading your account...' : 'Accepting invite...'}
				</p>
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

	if (inviteAcceptance.isError && token && !isTeamLoading && !team) {
		return (
			<div className="flex flex-col items-center gap-4 py-16">
				<div className="flex size-16 items-center justify-center rounded-full bg-error/10">
					<Icon name="alert-triangle" height={32} width={32} className="text-error" />
				</div>
				<div className="flex flex-col gap-2 text-center">
					<h2 className="text-lg font-semibold text-sub-text-primary">Check your invitation</h2>
					<p className="text-sm text-sub-text-muted">
						{inviteAcceptance.error?.message ||
							'Something went wrong. The invite may have expired or already been used.'}
					</p>
					<p className="text-sm text-sub-text-muted">
						Make sure you&apos;re signed in with the email address the invite was sent to. If the connection dropped,
						check whether you already joined.
					</p>
					{isTeamError ? (
						<p role="alert" className="text-sm text-error">
							Could not check membership.
						</p>
					) : null}
					<button
						type="button"
						className="mx-auto rounded-lg border border-sub-border px-4 py-2 text-sm text-sub-text-primary disabled:opacity-50"
						disabled={isTeamRetrying}
						onClick={() => void refetchTeam()}
					>
						{isTeamRetrying ? 'Checking membership...' : 'Check membership'}
					</button>
				</div>
			</div>
		)
	}

	if (isTeamLoading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="size-8 animate-spin rounded-full border-2 border-sub-brand-primary border-t-transparent" />
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
