import { useCallback, useEffect, useEffectEvent, useRef } from 'react'
import { useAuthContext } from '~/auth'
import { COMPLETION_SEEN_REQUEST_TIMEOUT_MS, markWebCompletionSeen } from '~/containers/LlamaAI/api/mobilePush'
import { LlamaAITransportError } from '~/containers/LlamaAI/api/transport'
import { isChatSurfaceAttended, type ChatAttention } from '~/containers/LlamaAI/chatAttention'
import { isWebMobilePushEnabled, type WebMobilePreference } from '~/containers/LlamaAI/hooks/useWebMobilePushPreference'
import { useStableCallback } from '~/hooks/useStableCallback'
import { getErrorMessage } from '~/utils/error'

export interface PendingSeen {
	sessionId: string
	messageId: string
	attempts: number
	expiresAt: number
}

interface UseWebCompletionSeenOptions {
	attention: ChatAttention
	preference: WebMobilePreference
}

const SEEN_RETRY_DELAYS_MS = [750, 2000] as const
export const PENDING_SEEN_TTL_MS = 10_000

function canFlushPreference(preference: WebMobilePreference): boolean {
	return isWebMobilePushEnabled(preference)
}

function shouldClearPending(preference: WebMobilePreference): boolean {
	switch (preference.kind) {
		case 'signed-out':
			return true
		case 'known':
			return !preference.enabled
		case 'loading':
		case 'error':
			return false
		default: {
			const _exhaustive: never = preference
			return _exhaustive
		}
	}
}

export function canMarkSeen(pending: PendingSeen, attention: ChatAttention, preference: WebMobilePreference): boolean {
	if (!canFlushPreference(preference)) return false
	if (pending.expiresAt <= Date.now()) return false
	if (!isChatSurfaceAttended(attention)) return false
	if (attention.sessionId !== pending.sessionId) return false
	return attention.visibleMessageIds.has(pending.messageId)
}

function shouldRetrySeenRequest(error: unknown) {
	if (!(error instanceof LlamaAITransportError)) return true
	return error.status === 408 || error.status >= 500
}

export function useWebCompletionSeen({ attention, preference }: UseWebCompletionSeenOptions) {
	const { authorizedFetch, user } = useAuthContext()
	const userId = user?.id ?? null
	const pendingRef = useRef(new Map<string, PendingSeen>())
	const flushingRef = useRef(false)
	const retryTimerRef = useRef<number | null>(null)
	const previousUserIdRef = useRef(userId)
	const canFlush = canFlushPreference(preference)
	const clearOnDisable = shouldClearPending(preference)

	const clearRetryTimer = useCallback(() => {
		if (retryTimerRef.current === null) return
		window.clearTimeout(retryTimerRef.current)
		retryTimerRef.current = null
	}, [])

	const clearPending = useCallback(() => {
		clearRetryTimer()
		pendingRef.current.clear()
	}, [clearRetryTimer])

	const getNextSeen = () => {
		for (const [messageId, pending] of pendingRef.current) {
			if (pending.expiresAt <= Date.now()) {
				pendingRef.current.delete(messageId)
				continue
			}
			if (canMarkSeen(pending, attention, preference)) return pending
		}
		return null
	}

	const flushPending = async () => {
		if (flushingRef.current || !canFlushPreference(preference)) return
		if (!getNextSeen()) return
		clearRetryTimer()
		flushingRef.current = true
		try {
			while (true) {
				const next = getNextSeen()
				if (!next) break
				next.attempts += 1
				try {
					await markWebCompletionSeen(authorizedFetch, next.sessionId, next.messageId)
					if (pendingRef.current.get(next.messageId) === next) pendingRef.current.delete(next.messageId)
				} catch (error) {
					console.error('[llama-ai] failed to mark web completion seen:', getErrorMessage(error))
					if (pendingRef.current.get(next.messageId) !== next) break
					const retryDelay = shouldRetrySeenRequest(error) ? SEEN_RETRY_DELAYS_MS[next.attempts - 1] : undefined
					const retryFits =
						retryDelay !== undefined && Date.now() + retryDelay + COMPLETION_SEEN_REQUEST_TIMEOUT_MS < next.expiresAt
					if (retryFits) {
						retryTimerRef.current = window.setTimeout(() => {
							retryTimerRef.current = null
							retryFlush()
						}, retryDelay)
					} else {
						pendingRef.current.delete(next.messageId)
					}
					break
				}
			}
		} finally {
			flushingRef.current = false
		}
	}

	const flushSeen = useEffectEvent(() => {
		void flushPending()
	})
	const retryFlush = useStableCallback(() => {
		void flushPending()
	})

	useEffect(() => {
		const onAttention = () => flushSeen()
		document.addEventListener('visibilitychange', onAttention)
		window.addEventListener('focus', onAttention)
		return () => {
			document.removeEventListener('visibilitychange', onAttention)
			window.removeEventListener('focus', onAttention)
			clearRetryTimer()
		}
	}, [clearRetryTimer])

	useEffect(() => {
		if (previousUserIdRef.current !== userId) {
			previousUserIdRef.current = userId
			clearPending()
		}
		if (clearOnDisable) {
			clearPending()
			return
		}
		flushSeen()
	}, [
		userId,
		clearOnDisable,
		canFlush,
		attention.sessionId,
		attention.uncovered,
		attention.visibleMessageIds,
		clearPending
	])

	const markCompletionSeen = useCallback(
		(sessionId: string, messageId: string) => {
			if (!userId || clearOnDisable) return
			for (const [pendingMessageId, pending] of pendingRef.current) {
				if (pending.expiresAt <= Date.now()) pendingRef.current.delete(pendingMessageId)
			}
			pendingRef.current.set(messageId, {
				sessionId,
				messageId,
				attempts: 0,
				expiresAt: Date.now() + PENDING_SEEN_TTL_MS
			})
			retryFlush()
		},
		[clearOnDisable, retryFlush, userId]
	)

	return { markCompletionSeen }
}
