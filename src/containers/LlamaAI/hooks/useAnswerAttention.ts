import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import type { createStreamStore } from '~/containers/LlamaAI/streamState'
import { trackUmamiEvent } from '~/utils/analytics/umami'

interface AnswerRun {
	startedAt: number
	entrySource: string | undefined
	abandoned: boolean
}

/**
 * A run lasts while the stream store reports streaming. The stream's `done` handler reports an
 * answer through `markAnswered`; every other ending (error, limit, stop, reset) leaves the run
 * unanswered.
 */
export function useAnswerAttention({
	streamStore,
	entrySource
}: {
	streamStore: ReturnType<typeof createStreamStore>
	entrySource: string | undefined
}) {
	const isStreaming = useSyncExternalStore(
		streamStore.subscribe,
		() => streamStore.getSnapshot().isStreaming,
		() => streamStore.getSnapshot().isStreaming
	)
	const runRef = useRef<AnswerRun | null>(null)
	const entrySourceRef = useRef(entrySource)

	useEffect(() => {
		entrySourceRef.current = entrySource
	}, [entrySource])

	useEffect(() => {
		if (!isStreaming) {
			runRef.current = null
			return
		}
		if (!runRef.current) {
			runRef.current = { startedAt: Date.now(), entrySource: entrySourceRef.current, abandoned: false }
		}
	}, [isStreaming])

	useEffect(() => {
		const markLeft = () => {
			const run = runRef.current
			if (!run || run.abandoned) return
			run.abandoned = true
			trackUmamiEvent('llamaai-answer-abandon', {
				entry_source: run.entrySource,
				waited_ms: Date.now() - run.startedAt,
				phase: streamStore.getSnapshot().text.length > 0 ? 'streaming' : 'before_first_token'
			})
		}
		const onVisibilityChange = () => {
			if (document.visibilityState !== 'visible') markLeft()
		}
		document.addEventListener('visibilitychange', onVisibilityChange)
		window.addEventListener('pagehide', markLeft)
		return () => {
			document.removeEventListener('visibilitychange', onVisibilityChange)
			window.removeEventListener('pagehide', markLeft)
			// Unmounting mid-run is a client-side navigation away from the chat, which no page event reports.
			markLeft()
		}
	}, [streamStore])

	// `done` calls this synchronously after COMMIT_STREAM, before React renders the commit and the
	// effect above closes the run.
	const markAnswered = useCallback(() => {
		const run = runRef.current
		runRef.current = null
		// The user asked to stop; `done` winning the race does not make it an answer they waited for.
		if (!run || streamStore.getSnapshot().phase.status === 'stopping') return
		if (document.visibilityState !== 'visible') return
		trackUmamiEvent('llamaai-answer-view', {
			entry_source: run.entrySource,
			wait_ms: Date.now() - run.startedAt,
			returned: run.abandoned
		})
	}, [streamStore])

	return { markAnswered }
}
