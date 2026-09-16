import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { refreshSession } from '~/auth/authStore'
import { AUTH_SERVER } from '~/constants'
import { handleSimpleFetchResponse } from '~/utils/async'
import pb from '~/utils/pocketbase'
import type { PurchaseSeatsResponse, Team } from './types'

const normalizeHttpErrorMessage = (message: string | undefined, fallbackMessage: string): string => {
	if (!message) return fallbackMessage
	if (!message.startsWith('[HTTP] [error]')) return message
	const colonIndex = message.indexOf(':')
	if (colonIndex === -1) return fallbackMessage
	const details = message.slice(colonIndex + 1).trim()
	return details || fallbackMessage
}

const getErrorMessage = (error: unknown, fallbackMessage: string): string =>
	error instanceof Error ? normalizeHttpErrorMessage(error.message, fallbackMessage) : fallbackMessage

type UseTeamOptions = {
	inviteToken?: string
}

export const useTeam = ({ inviteToken }: UseTeamOptions = {}) => {
	const { user, isAuthenticated, authorizedFetch } = useAuthContext()!
	const queryClient = useQueryClient()
	const currentUserId = user?.id
	const teamQueryKey = ['team', currentUserId]

	// Seats, membership and billing share server state. Serialize writes across hook
	// instances, and show confirmed data instead of rolling back whole-team snapshots.
	const mutationKey = ['team-write', currentUserId]
	const isTeamUpdating = useIsMutating({ mutationKey }) > 0
	const scope = { id: `team:${currentUserId}` }
	const refetch = () => queryClient.invalidateQueries({ queryKey: teamQueryKey })
	const reconcileTeam = (_data: unknown, error: Error | null) => {
		// Show request errors immediately; successful actions wait for canonical seats.
		if (error) {
			void refetch()
			return
		}
		return refetch()
	}

	const inviteAcceptance = useQuery({
		queryKey: ['team-invite-accept', currentUserId, inviteToken],
		queryFn: async () => {
			if (!inviteToken || !currentUserId || pb.authStore.record?.id !== currentUserId)
				throw new Error('Not authenticated')

			const response = await authorizedFetch(`${AUTH_SERVER}/team/invite/accept`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token: inviteToken })
			})
			if (!response) throw new Error('Not authenticated')
			const normalized = await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(getErrorMessage(error, 'Failed to accept invite'))
			})
			const data = await normalized.json()

			if (pb.authStore.record?.id !== currentUserId) throw new Error('Your account changed. Open the invite again.')
			await queryClient.invalidateQueries({ queryKey: teamQueryKey })

			return data
		},
		enabled: isAuthenticated && !!currentUserId && !!inviteToken,
		retry: false,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		staleTime: Infinity
	})

	// ── Query: GET /team ──
	const teamQuery = useQuery({
		queryKey: teamQueryKey,
		queryFn: async (): Promise<Team | null> => {
			if (!isAuthenticated) return null

			const response = await authorizedFetch(`${AUTH_SERVER}/team`)
			if (!response) return null

			const data = await handleSimpleFetchResponse(response).then((res) => res.json())
			return data?.team ?? null
		},
		enabled: isAuthenticated,
		staleTime: 1000 * 60 * 5,
		refetchOnWindowFocus: false
	})

	const team = teamQuery.data ?? null

	// Keep the accepted write separate from its follow-up read. Retrying account
	// loading must never accept the invitation a second time.
	const inviteAccount = useQuery({
		queryKey: ['team-invite-account', currentUserId, inviteToken],
		queryFn: async () => {
			const queryKey = ['auth', 'status', currentUserId]
			await queryClient.cancelQueries({ queryKey, exact: true })
			const account = await refreshSession()
			if (!account || pb.authStore.record?.id !== currentUserId)
				throw new Error('Could not confirm your account. Please retry.')
			queryClient.setQueryData(queryKey, account)
			return account
		},
		enabled: Boolean(
			currentUserId && inviteToken && (inviteAcceptance.isSuccess || (inviteAcceptance.isError && team != null))
		),
		retry: false,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		staleTime: Infinity
	})

	const isTeamLoading = teamQuery.isLoading
	// A refetch failure keeps showing the cached team; error means nothing is known.
	const isTeamError = teamQuery.isError && teamQuery.data == null
	const isTeamRetrying = teamQuery.isFetching
	const isAdmin = team?.isAdmin === true
	const members = team?.members ?? []
	const pendingInvites = team?.pendingInvites ?? []
	const teamSubscriptions = team?.subscriptions ?? []

	// ── Mutation: POST /team/create ──
	const createTeamMutation = useMutation({
		mutationKey,
		scope,
		retry: false,
		mutationFn: async ({ name }: { name: string }) => {
			const response = await authorizedFetch(`${AUTH_SERVER}/team/create`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			})
			if (!response) throw new Error('Not authenticated')
			const normalized = await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(getErrorMessage(error, 'Failed to create team'))
			})
			return normalized.json()
		},
		onSuccess: () => {
			toast.success('Team created successfully!')
			void queryClient.invalidateQueries({ queryKey: ['auth', 'status'] })
			return refetch()
		},
		onError: (error) => {
			console.log('Failed to create team:', error)
		}
	})

	// ── Mutation: POST /team/update ──
	const updateTeamMutation = useMutation({
		mutationKey,
		scope,
		retry: false,
		mutationFn: async ({ name }: { name: string }) => {
			const response = await authorizedFetch(`${AUTH_SERVER}/team/update`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			})
			if (!response) throw new Error('Not authenticated')
			const normalized = await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(getErrorMessage(error, 'Failed to update team'))
			})
			return normalized.json()
		},
		onSuccess: (_data, { name }) => {
			// A rename owns only the name; other team operations may finish while it is pending.
			queryClient.setQueryData<Team | null>(teamQueryKey, (old) => (old ? { ...old, name } : old))
		},
		onSettled: reconcileTeam
	})

	// ── Mutation: POST /team/seats/purchase ──
	const purchaseSeatsMutation = useMutation({
		mutationKey,
		scope,
		retry: false,
		mutationFn: async (data: {
			subscriptionType: string
			seatCount: number
			billingInterval: 'month' | 'year'
			redirectUrl: string
			cancelUrl: string
		}): Promise<PurchaseSeatsResponse> => {
			const response = await authorizedFetch(`${AUTH_SERVER}/team/seats/purchase`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			})
			if (!response) throw new Error('Not authenticated')
			const normalized = await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(getErrorMessage(error, 'Failed to purchase seats'))
			})
			return normalized.json()
		},
		onSuccess: (data) => {
			if (data.action === 'seats_added') {
				toast.success(`${data.seatsAdded} seat(s) added successfully!`)
				return refetch()
			}
		},
		onError: (error) => {
			console.log('Failed to purchase seats:', error)
		}
	})

	// ── Mutation: POST /team/seats/upgrade ──
	// No optimistic update: billingInterval flips on the team sub and all assigned member subs.
	const upgradeSeatsMutation = useMutation({
		mutationKey,
		scope,
		retry: false,
		mutationFn: async (data: { subscriptionType: string }) => {
			const response = await authorizedFetch(`${AUTH_SERVER}/team/seats/upgrade`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			})
			if (!response) throw new Error('Not authenticated')
			const normalized = await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(getErrorMessage(error, 'Failed to upgrade subscription'))
			})
			return normalized.json()
		},
		onSuccess: () => {
			toast.success('Subscription upgraded to yearly billing')
			void queryClient.invalidateQueries({ queryKey: ['subscription'] })
			return refetch()
		},
		onError: (error) => {
			console.log('Failed to upgrade subscription:', error)
		}
	})

	// ── Mutation: POST /team/seats ──
	const setSeatsMutation = useMutation({
		mutationKey,
		scope,
		retry: false,
		mutationFn: async (data: { subscriptionType: string; seatCount: number }) => {
			const response = await authorizedFetch(`${AUTH_SERVER}/team/seats`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			})
			if (!response) throw new Error('Not authenticated')
			const normalized = await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(getErrorMessage(error, 'Failed to update seats'))
			})
			return normalized.json()
		},
		onSuccess: (_data, { seatCount }) => {
			if (seatCount === 0) toast.success('Subscription will cancel at the end of the current period')
		},
		onSettled: reconcileTeam
	})

	// ── Mutation: POST /team/member/assign ──
	const assignMemberMutation = useMutation({
		mutationKey,
		scope,
		retry: false,
		mutationFn: async (data: { userId: string; subscriptionType: string }) => {
			const response = await authorizedFetch(`${AUTH_SERVER}/team/member/assign`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			})
			if (!response) throw new Error('Not authenticated')
			const normalized = await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(getErrorMessage(error, 'Failed to assign member'))
			})
			return normalized.json()
		},
		onSuccess: () => {
			toast.success('Subscription assigned successfully!')
			void queryClient.invalidateQueries({ queryKey: ['subscription'] })
		},
		onSettled: reconcileTeam
	})

	// ── Mutation: POST /team/member/unassign ──
	const unassignMemberMutation = useMutation({
		mutationKey,
		scope,
		retry: false,
		mutationFn: async (data: { userId: string }) => {
			const response = await authorizedFetch(`${AUTH_SERVER}/team/member/unassign`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			})
			if (!response) throw new Error('Not authenticated')
			const normalized = await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(getErrorMessage(error, 'Failed to unassign member'))
			})
			return normalized.json()
		},
		onSuccess: () => {
			toast.success('Subscription removed from member')
			void queryClient.invalidateQueries({ queryKey: ['subscription'] })
		},
		onSettled: reconcileTeam
	})

	// ── Mutation: POST /team/invite ──
	const inviteMemberMutation = useMutation({
		mutationKey,
		scope,
		retry: false,
		mutationFn: async (data: { email: string }) => {
			const response = await authorizedFetch(`${AUTH_SERVER}/team/invite`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			})
			if (!response) throw new Error('Not authenticated')
			const normalized = await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(getErrorMessage(error, 'Failed to send invite'))
			})
			return normalized.json()
		},
		onSuccess: () => {
			toast.success('Invite sent successfully!')
		},
		onSettled: reconcileTeam
	})

	// ── Mutation: POST /team/invite/resend ──
	const resendInviteMutation = useMutation({
		mutationKey,
		scope,
		retry: false,
		mutationFn: async (data: { inviteId: string }) => {
			const response = await authorizedFetch(`${AUTH_SERVER}/team/invite/resend`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			})
			if (!response) throw new Error('Not authenticated')
			const normalized = await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(getErrorMessage(error, 'Failed to resend invite'))
			})
			return normalized.json()
		},
		onSuccess: () => {
			// The row's Resend button flips into its cooldown label, which is the feedback.
			return refetch()
		},
		onError: (error) => {
			console.log('Failed to resend invite:', error)
		}
	})

	// ── Mutation: POST /team/invite/revoke ──
	const revokeInviteMutation = useMutation({
		mutationKey,
		scope,
		retry: false,
		mutationFn: async (data: { inviteId: string }) => {
			const response = await authorizedFetch(`${AUTH_SERVER}/team/invite/revoke`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			})
			if (!response) throw new Error('Not authenticated')
			const normalized = await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(getErrorMessage(error, 'Failed to revoke invite'))
			})
			return normalized.json()
		},
		onSuccess: () => {
			toast.success('Invite revoked')
		},
		onSettled: reconcileTeam
	})

	// ── Mutation: POST /team/member/remove ──
	const removeMemberMutation = useMutation({
		mutationKey,
		scope,
		retry: false,
		mutationFn: async (data: { userId: string }) => {
			const response = await authorizedFetch(`${AUTH_SERVER}/team/member/remove`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			})
			if (!response) throw new Error('Not authenticated')
			const normalized = await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(getErrorMessage(error, 'Failed to remove member'))
			})
			return normalized.json()
		},
		onSuccess: () => {
			toast.success('Member removed from team')
		},
		onSettled: reconcileTeam
	})

	// ── Mutation: POST /team/leave ──
	const leaveTeamMutation = useMutation({
		mutationKey,
		scope,
		retry: false,
		mutationFn: async () => {
			const response = await authorizedFetch(`${AUTH_SERVER}/team/leave`, {
				method: 'POST'
			})
			if (!response) throw new Error('Not authenticated')
			const normalized = await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(getErrorMessage(error, 'Failed to leave team'))
			})
			return normalized.json()
		},
		onSuccess: () => {
			toast.success('You have left the team')
			void queryClient.invalidateQueries({ queryKey: ['auth', 'status'] })
			void queryClient.invalidateQueries({ queryKey: ['subscription'] })
		},
		onSettled: reconcileTeam
	})

	return {
		// Query state
		isTeamUpdating,
		canChangeTeamBilling: !isTeamUpdating && !teamQuery.isFetching && !teamQuery.isError,
		isTeamRefreshError: teamQuery.isError && teamQuery.data != null,
		team,
		isTeamLoading,
		isTeamError,
		isTeamRetrying,
		isAdmin,
		members,
		pendingInvites,
		teamSubscriptions,
		refetchTeam: teamQuery.refetch,
		inviteAcceptance,
		inviteAccount,

		// Mutations
		createTeamMutation,
		updateTeamMutation,
		purchaseSeatsMutation,
		upgradeSeatsMutation,
		setSeatsMutation,
		assignMemberMutation,
		unassignMemberMutation,
		inviteMemberMutation,
		resendInviteMutation,
		revokeInviteMutation,
		removeMemberMutation,
		leaveTeamMutation
	}
}
