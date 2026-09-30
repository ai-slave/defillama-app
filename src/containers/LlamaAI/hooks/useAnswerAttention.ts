import { useEffect, useRef } from 'react'
import { trackUmamiEvent } from '~/utils/analytics/umami'

interface AnswerRun {
	startedAt: number
	entrySource: string | undefined
	abandoned: boolean
}

export function useAnswerAttention({
	isStreaming,
	hasText,
	entrySource
}: {
	isStreaming: boolean
	hasText: boolean
	entrySource: string | undefined
}) {
	const runRef = useRef<AnswerRun | null>(null)
	const hasTextRef = useRef(hasText)
	const entrySourceRef = useRef(entrySource)

	useEffect(() => {
		hasTextRef.current = hasText
		entrySourceRef.current = entrySource
	}, [hasText, entrySource])

	useEffect(() => {
		if (isStreaming) {
			if (!runRef.current) {
				runRef.current = { startedAt: Date.now(), entrySource: entrySourceRef.current, abandoned: false }
			}
			return
		}
		const run = runRef.current
		runRef.current = null
		if (!run || document.visibilityState !== 'visible') return
		trackUmamiEvent('llamaai-answer-view', {
			entry_source: run.entrySource,
			wait_ms: Date.now() - run.startedAt,
			returned: run.abandoned
		})
	}, [isStreaming])

	useEffect(() => {
		const markLeft = () => {
			const run = runRef.current
			if (!run || run.abandoned) return
			run.abandoned = true
			trackUmamiEvent('llamaai-answer-abandon', {
				entry_source: run.entrySource,
				waited_ms: Date.now() - run.startedAt,
				phase: hasTextRef.current ? 'streaming' : 'before_first_token'
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
		}
	}, [])
}
