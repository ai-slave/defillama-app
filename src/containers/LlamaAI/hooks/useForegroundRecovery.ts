import { useEffect, useEffectEvent, useRef } from 'react'
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
	const onResumeRecoveryRef = useRef(onResumeRecovery)
	onResumeRecoveryRef.current = onResumeRecovery
	const onReplayPromptRef = useRef(onReplayPrompt)
	onReplayPromptRef.current = onReplayPrompt
	const onProbeSessionRef = useRef(onProbeSession)
	onProbeSessionRef.current = onProbeSession

	const reconnectVisibleExecution = useEffectEvent(() => {
		if (readOnly || isRouteSessionPending) return
		const intent = getForegroundRecoveryIntent({
			hasActiveRecovery: getHasActiveRecovery(),
			promptFailure,
			hasGenericError
		})
		switch (intent) {
			case 'resume-recovery':
				onResumeRecoveryRef.current()
				return
			case 'replay-prompt':
				onReplayPromptRef.current()
				return
			case 'probe-session':
				if (sessionId && !isStreaming) onProbeSessionRef.current(sessionId)
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
			if (document.hidden) return
			if (recoveryIntent === 'replay-prompt') {
				onReplayPromptRef.current()
			} else {
				onProbeSessionRef.current(sessionId)
			}
		}, FOREGROUND_RECOVERY_POLL_MS)
		return () => window.clearInterval(intervalId)
	}, [isRouteSessionPending, isStreaming, hasGenericError, sessionId, readOnly, promptFailure])
}
