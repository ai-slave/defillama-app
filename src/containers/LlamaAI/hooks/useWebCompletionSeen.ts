import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { COMPLETION_SEEN_REQUEST_TIMEOUT_MS, markWebCompletionSeen } from '~/containers/LlamaAI/api/mobilePush'
import type { AuthorizedFetch } from '~/containers/LlamaAI/api/transport'
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
	if (!isWebMobilePushEnabled(preference)) return false
	if (pending.expiresAt <= Date.now()) return false
	if (!isChatSurfaceAttended(attention)) return false
	if (attention.sessionId !== pending.sessionId) return false
	return attention.visibleMessageIds.has(pending.messageId)
}

function shouldRetrySeenRequest(error: unknown) {
	if (!(error instanceof LlamaAITransportError)) return true
	return error.status === 408 || error.status >= 500
}

/** Queue shared by every flush attempt. `flushing` serialises them so a retry
    cannot race the flush that scheduled it. */
interface SeenFlushState {
	pending: Map<string, PendingSeen>
	flushing: boolean
}

function getNextSeen(state: SeenFlushState, attention: ChatAttention, preference: WebMobilePreference) {
	for (const [messageId, pending] of state.pending) {
		if (pending.expiresAt <= Date.now()) {
			state.pending.delete(messageId)
			continue
		}
		if (canMarkSeen(pending, attention, preference)) return pending
	}
	return null
}

interface FlushPendingSeenOptions {
	state: SeenFlushState
	attention: ChatAttention
	preference: WebMobilePreference
	authorizedFetch: AuthorizedFetch
	scheduleRetry: (delayMs: number) => void
}

/** Module scope on purpose: the loop and try/finally below cannot be lowered by
    the React compiler, so keeping this out of the hook body lets the hook
    itself compile. */
async function flushPendingSeen({
	state,
	attention,
	preference,
	authorizedFetch,
	scheduleRetry
}: FlushPendingSeenOptions) {
	if (state.flushing || !isWebMobilePushEnabled(preference)) return
	if (!getNextSeen(state, attention, preference)) return
	state.flushing = true
	try {
		while (true) {
			const next = getNextSeen(state, attention, preference)
			if (!next) break
			next.attempts += 1
			try {
				await markWebCompletionSeen(authorizedFetch, next.sessionId, next.messageId)
				if (state.pending.get(next.messageId) === next) state.pending.delete(next.messageId)
			} catch (error) {
				console.error('[llama-ai] failed to mark web completion seen:', getErrorMessage(error))
				if (state.pending.get(next.messageId) !== next) break
				const retryDelay = shouldRetrySeenRequest(error) ? SEEN_RETRY_DELAYS_MS[next.attempts - 1] : undefined
				const retryFits =
					retryDelay !== undefined && Date.now() + retryDelay + COMPLETION_SEEN_REQUEST_TIMEOUT_MS < next.expiresAt
				if (retryFits) {
					scheduleRetry(retryDelay)
				} else {
					state.pending.delete(next.messageId)
				}
				break
			}
		}
	} finally {
		state.flushing = false
	}
}

export function useWebCompletionSeen({ attention, preference }: UseWebCompletionSeenOptions) {
	const { authorizedFetch, user } = useAuthContext()
	const userId = user?.id ?? null
	const stateRef = useRef<SeenFlushState>({ pending: new Map(), flushing: false })
	const previousUserIdRef = useRef(userId)
	const [retryAt, setRetryAt] = useState<number | null>(null)
	const canFlush = isWebMobilePushEnabled(preference)
	const clearOnDisable = shouldClearPending(preference)

	const runFlush = () => {
		void flushPendingSeen({
			state: stateRef.current,
			attention,
			preference,
			authorizedFetch,
			// An absolute deadline, so two retries at the same delay are still
			// distinct state and each one re-arms the effect below.
			scheduleRetry: (delayMs) => setRetryAt(Date.now() + delayMs)
		})
	}
	const flushSeen = useEffectEvent(runFlush)
	const retryFlush = useStableCallback(runFlush)

	const clearPending = useCallback(() => {
		stateRef.current.pending.clear()
	}, [])

	// The scheduled retry is state, not a ref, so unmount and every re-schedule
	// cancel the outstanding timer through this effect's cleanup. A retry that is
	// no longer wanted needs no cancelling: the flush re-checks the queue and the
	// preference, so it turns into a no-op.
	useEffect(() => {
		if (retryAt === null) return
		const timer = window.setTimeout(() => retryFlush(), Math.max(0, retryAt - Date.now()))
		return () => window.clearTimeout(timer)
	}, [retryAt, retryFlush])

	useEffect(() => {
		const onAttention = () => flushSeen()
		document.addEventListener('visibilitychange', onAttention)
		window.addEventListener('focus', onAttention)
		return () => {
			document.removeEventListener('visibilitychange', onAttention)
			window.removeEventListener('focus', onAttention)
		}
	}, [])

	/* eslint-disable react/exhaustive-effect-dependencies -- the attention fields are triggers: flush the seen set when the user looks at messages */
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
	/* eslint-enable react/exhaustive-effect-dependencies */

	const markCompletionSeen = useCallback(
		(sessionId: string, messageId: string) => {
			if (!userId || clearOnDisable) return
			for (const [pendingMessageId, pending] of stateRef.current.pending) {
				if (pending.expiresAt <= Date.now()) stateRef.current.pending.delete(pendingMessageId)
			}
			stateRef.current.pending.set(messageId, {
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
