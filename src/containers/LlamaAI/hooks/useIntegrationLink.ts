import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useAuthContext } from '~/auth'
import {
	confirmTelegramLink,
	getTelegramStatus,
	startTelegramLink,
	unlinkTelegram,
	type TelegramStatus
} from '~/containers/LlamaAI/api/telegram'
import { LLAMA_AI_SETTINGS_QUERY_KEY, type SettingsQueryResult } from '~/containers/LlamaAI/hooks/useLlamaAISettings'

export const LLAMA_AI_TELEGRAM_STATUS_QUERY_KEY = ['llama-ai', 'telegram-status'] as const

export const getTelegramStatusQueryKey = (userId: string | null) =>
	[...LLAMA_AI_TELEGRAM_STATUS_QUERY_KEY, userId] as const

const POLL_MS = 2000

export type IntegrationLinkState =
	| { status: 'idle' }
	| { status: 'loading' }
	| { status: 'linked'; username: string; linkedAt: string }
	| { status: 'starting' }
	| { status: 'awaiting_tg'; token: string; deepLink: string }
	| { status: 'awaiting_code'; token: string }
	// Which prompt sent the confirmation, so that prompt stays on screen with its button pending.
	| { status: 'confirming'; step: 'code' | 'switch' }
	| {
			status: 'switch_confirm'
			token: string
			short_code: string
			currentTelegramUsername: string | null
			expiresAt: string
	  }
	| { status: 'error'; message: string }

type Options = { initialStatus?: TelegramStatus | null; initialTgloginToken?: string | null }
type ConfirmTelegramLinkResult = Awaited<ReturnType<typeof confirmTelegramLink>>
type ConfirmTelegramLinkVariables = { token: string; short_code: string; force?: boolean }
type ConfirmState = {
	isPending: boolean
	data: ConfirmTelegramLinkResult | undefined
	variables: ConfirmTelegramLinkVariables | undefined
	error: Error | null
}

export function getTelegramStatusRefetchInterval(status: TelegramStatus | null | undefined) {
	return status?.pending ? POLL_MS : false
}

function getSwitchConfirmation(confirm: ConfirmState) {
	const { data, variables } = confirm
	if (!data || !('status' in data) || data.status !== 'requires_switch_confirmation' || !variables) return null
	return {
		status: 'switch_confirm',
		token: variables.token,
		short_code: variables.short_code,
		currentTelegramUsername: data.currentTelegramUsername,
		expiresAt: data.expiresAt
	} satisfies IntegrationLinkState
}

export function deriveTelegramLinkState({
	status,
	statusError,
	isLoading,
	isStarting,
	confirm,
	initialTgloginToken
}: {
	status: TelegramStatus | null | undefined
	statusError: Error | null
	isLoading: boolean
	isStarting: boolean
	confirm: ConfirmState
	initialTgloginToken: string | null | undefined
}): IntegrationLinkState {
	const switchConfirmation = getSwitchConfirmation(confirm)
	const confirmLinked = !!(confirm.data && 'linked' in confirm.data && confirm.data.linked)
	// The confirmation's own outcome wins over query state, so its prompts and a forced switch's error stay visible
	// while polling catches up.
	if (!switchConfirmation && !confirmLinked) {
		if (confirm.variables?.force && confirm.error)
			return { status: 'error', message: "Couldn't switch the Telegram account." }
		if (!initialTgloginToken && !status && statusError) {
			return { status: 'error', message: "Couldn't load Telegram status." }
		}
	}
	// Switch account starts from a linked account, which stays on screen while its button waits.
	if (isStarting && status?.link.state !== 'linked') return { status: 'starting' }
	if (confirm.isPending) return { status: 'confirming', step: confirm.variables?.force ? 'switch' : 'code' }
	if (switchConfirmation) return switchConfirmation
	if (!confirmLinked && initialTgloginToken) return { status: 'awaiting_code', token: initialTgloginToken }
	if (status?.pending) return { status: 'awaiting_tg', token: status.pending.token, deepLink: status.pending.deepLink }
	if (status?.link.state === 'linked') {
		return { status: 'linked', username: status.link.telegramUsername, linkedAt: status.link.linkedAt }
	}
	if (isLoading) return { status: 'loading' }
	return { status: 'idle' }
}

export function useIntegrationLink(opts: Options = {}) {
	const { authorizedFetch, user } = useAuthContext()
	const queryClient = useQueryClient()
	const userId = user?.id ?? null
	const statusQueryKey = useMemo(() => getTelegramStatusQueryKey(userId), [userId])

	const cacheSettingsTelegramStatus = useCallback(
		(status: TelegramStatus) => {
			if (!userId) return
			queryClient.setQueryData<SettingsQueryResult>([...LLAMA_AI_SETTINGS_QUERY_KEY, userId], (previous) => ({
				settings: previous?.settings ?? null,
				availableModels: previous?.availableModels ?? [],
				availableEfforts: previous?.availableEfforts ?? [],
				telegramStatus: status,
				tip: previous?.tip ?? null
			}))
		},
		[queryClient, userId]
	)

	const cacheTelegramStatus = useCallback(
		(status: TelegramStatus) => {
			queryClient.setQueryData(statusQueryKey, status)
			cacheSettingsTelegramStatus(status)
		},
		[cacheSettingsTelegramStatus, queryClient, statusQueryKey]
	)

	const statusQuery = useQuery({
		queryKey: statusQueryKey,
		queryFn: async () => {
			const status = await getTelegramStatus(authorizedFetch)
			cacheSettingsTelegramStatus(status)
			return status
		},
		enabled: !!userId,
		initialData: opts.initialStatus ?? undefined,
		refetchInterval: (query) => getTelegramStatusRefetchInterval(query.state.data),
		refetchOnWindowFocus: false,
		staleTime: 30_000
	})

	// Not the mutation's own error: that one clears as soon as a retry starts, and the retry runs under it.
	const [startError, setStartError] = useState<string | null>(null)
	const startMutation = useMutation({
		mutationFn: () => startTelegramLink(authorizedFetch),
		onError: () => setStartError("Couldn't start linking."),
		onSuccess: (result) => {
			setStartError(null)
			const previous = queryClient.getQueryData<TelegramStatus>(statusQueryKey)
			const status: TelegramStatus = {
				link: previous?.link ?? { state: 'unlinked' },
				pending: { token: result.token, deepLink: result.deepLink, expiresAt: result.expiresAt }
			}
			cacheTelegramStatus(status)
			if (typeof window !== 'undefined') window.open(result.deepLink, '_blank', 'noopener')
		}
	})

	const unlinkMutation = useMutation({
		mutationFn: () => unlinkTelegram(authorizedFetch),
		onSuccess: () => {
			cacheTelegramStatus({ link: { state: 'unlinked' }, pending: null })
		}
	})

	const confirmMutation = useMutation({
		mutationFn: (variables: ConfirmTelegramLinkVariables) => confirmTelegramLink(authorizedFetch, variables),
		onSuccess: (result) => {
			if ('linked' in result && result.linked) {
				cacheTelegramStatus({
					link: {
						state: 'linked',
						telegramUsername: result.telegramUsername ?? '',
						linkedAt: new Date().toISOString()
					},
					pending: null
				})
			}
		}
	})

	const connect = useCallback(() => {
		// Connect also retries after a failed switch, whose error would otherwise outrank the new link.
		confirmMutation.reset()
		startMutation.mutate()
	}, [confirmMutation, startMutation])

	const disconnect = useCallback(() => {
		unlinkMutation.mutate()
	}, [unlinkMutation])

	const confirmCode = useCallback(
		async (short_code: string) => {
			if (!opts.initialTgloginToken) return
			return confirmMutation.mutateAsync({ token: opts.initialTgloginToken, short_code })
		},
		[confirmMutation, opts.initialTgloginToken]
	)

	const confirmSwitch = useCallback(async () => {
		const switchConfirmation = getSwitchConfirmation(confirmMutation)
		if (!switchConfirmation) return false
		const { token, short_code } = switchConfirmation
		try {
			await confirmMutation.mutateAsync({ token, short_code, force: true })
			return true
		} catch (error: any) {
			// Another tab/device can finish the link before this confirmation lands.
			// Treat that as success after refreshing server state.
			if (error?.status === 409 && error?.body?.error === 'link_state_changed') {
				confirmMutation.reset()
				await statusQuery.refetch()
				return true
			}
			return false
		}
	}, [confirmMutation, statusQuery])

	const cancelSwitch = useCallback(() => {
		confirmMutation.reset()
	}, [confirmMutation])

	const state = deriveTelegramLinkState({
		status: statusQuery.data,
		statusError: statusQuery.error,
		isLoading: statusQuery.isLoading,
		isStarting: startMutation.isPending,
		confirm: confirmMutation,
		initialTgloginToken: opts.initialTgloginToken
	})

	return {
		state,
		// Beside the state, not instead of it: the linked account and the button that retries stay on screen.
		startError,
		connect,
		isStarting: startMutation.isPending,
		disconnect,
		isDisconnecting: unlinkMutation.isPending,
		disconnectFailed: unlinkMutation.isError,
		resetDisconnect: unlinkMutation.reset,
		confirmCode,
		confirmSwitch,
		cancelSwitch
	}
}
