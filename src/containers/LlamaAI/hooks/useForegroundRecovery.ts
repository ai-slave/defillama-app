import { useEffect, useEffectEvent } from 'react'
import { getForegroundRecoveryIntent, type PromptFailure } from '~/containers/LlamaAI/promptFailures'

export const FOREGROUND_RECOVERY_POLL_MS = 30_000

interface UseForegroundRecoveryOptions {
	readOnly: boolean
	isRouteSessionPending: boolean
	isStreaming: boolean
	sessionId: string | null
	hasGenericError: boolean
	promptFailure: PromptFailure | null
	getHasActiveRecovery: () => boolean
	onResumeRecovery: () => void
	onReplayPrompt: () => void
	onProbeSession: (sessionId: string) => void
}

export function useForegroundRecovery({
	readOnly,
	isRouteSessionPending,
	isStreaming,
	sessionId,
	hasGenericError,
	promptFailure,
	getHasActiveRecovery,
	onResumeRecovery,
	onReplayPrompt,
	onProbeSession
}: UseForegroundRecoveryOptions) {
	const reconnectVisibleExecution = useEffectEvent(() => {
		if (readOnly || isRouteSessionPending) return
		const intent = getForegroundRecoveryIntent({
			hasActiveRecovery: getHasActiveRecovery(),
			promptFailure,
			hasGenericError
		})
		switch (intent) {
			case 'resume-recovery':
				onResumeRecovery()
				return
			case 'replay-prompt':
				onReplayPrompt()
				return
			case 'probe-session':
				if (sessionId && !isStreaming) onProbeSession(sessionId)
				return
			case 'none':
				return
			default: {
				const _exhaustive: never = intent
				return _exhaustive
			}
		}
	})

	useEffect(() => {
		const onVisibilityChange = () => {
			if (!document.hidden) reconnectVisibleExecution()
		}
		const onPageShow = (event: PageTransitionEvent) => {
			if (event.persisted) reconnectVisibleExecution()
		}

		document.addEventListener('visibilitychange', onVisibilityChange)
		window.addEventListener('pageshow', onPageShow)
		return () => {
			document.removeEventListener('visibilitychange', onVisibilityChange)
			window.removeEventListener('pageshow', onPageShow)
		}
	}, [])

	useEffect(() => {
		const onOnline = () => {
			reconnectVisibleExecution()
		}

		window.addEventListener('online', onOnline)
		return () => window.removeEventListener('online', onOnline)
	}, [])

	// Stable identity, latest props: the poll must not restart when a callback changes, and must not
	// call yesterday's callback either.
	const pollRecovery = useEffectEvent((intent: 'replay-prompt' | 'probe-session', session: string) => {
		if (document.hidden) return
		if (intent === 'replay-prompt') onReplayPrompt()
		else onProbeSession(session)
	})

	useEffect(() => {
		const recoveryIntent = getForegroundRecoveryIntent({
			hasActiveRecovery: false,
			promptFailure,
			hasGenericError
		})
		if (
			isRouteSessionPending ||
			isStreaming ||
			!sessionId ||
			readOnly ||
			(recoveryIntent !== 'replay-prompt' && recoveryIntent !== 'probe-session')
		) {
			return
		}
		const intervalId = window.setInterval(() => {
			pollRecovery(recoveryIntent, sessionId)
		}, FOREGROUND_RECOVERY_POLL_MS)
		return () => window.clearInterval(intervalId)
	}, [isRouteSessionPending, isStreaming, hasGenericError, sessionId, readOnly, promptFailure])
}
