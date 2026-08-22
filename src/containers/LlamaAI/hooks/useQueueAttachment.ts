import { useEffect, useRef } from 'react'
import { checkActiveExecution } from '~/containers/LlamaAI/fetchAgenticResponse'
import { decodeQueueSnapshot, type QueuedMessageElement, type QueueSnapshot } from '~/containers/LlamaAI/queue/protocol'
import type { StreamBuffer } from '~/containers/LlamaAI/streamState'
import {
	didQueueAttachProgress,
	hasClaimableQueueWork,
	prepareQueueAttachExecution,
	queueAttachSnapshotKey,
	shouldConfirmQueueDrain,
	shouldTriggerQueueAttach
} from '~/containers/LlamaAI/utils/queueAttach'
import { useStableCallback } from '~/hooks/useStableCallback'

interface ActiveExecution {
	active: boolean
	messageId?: string
	queueItemId?: string
}

export interface QueueAttachResult {
	outcome: 'done' | 'timeout' | 'paused' | 'finished' | 'not_found' | 'error'
	messageId: string | null
}

interface QueueAttachmentOptions {
	sessionId: string | null
	isStreaming: boolean
	queue: QueuedMessageElement[]
	fetchFn: typeof fetch
	getQueue: () => QueuedMessageElement[]
	applySnapshot: (snapshot: QueueSnapshot) => boolean
	restoreQueue: (sessionId: string) => Promise<{ queueRevision?: unknown; queuedMessages?: unknown } | null>
	attachExecution: (
		sessionId: string,
		buffer: StreamBuffer,
		resetStream: boolean,
		queueItemId: string | null
	) => Promise<QueueAttachResult>
	abortAttachment: () => void
}

export function useQueueAttachment({
	sessionId,
	isStreaming,
	queue,
	fetchFn,
	getQueue,
	applySnapshot,
	restoreQueue,
	attachExecution,
	abortAttachment
}: QueueAttachmentOptions) {
	const mountedRef = useRef(true)
	const runningRef = useRef(false)
	const attachedSessionRef = useRef<string | null>(null)
	const sessionIdRef = useRef(sessionId)
	const isStreamingRef = useRef(isStreaming)
	const abort = useStableCallback(abortAttachment)
	sessionIdRef.current = sessionId
	isStreamingRef.current = isStreaming

	useEffect(() => {
		mountedRef.current = true
		return () => {
			mountedRef.current = false
			if (runningRef.current) abort()
		}
	}, [abort])

	useEffect(() => {
		const attachedSessionId = attachedSessionRef.current
		if (attachedSessionId && attachedSessionId !== sessionId) abort()
	}, [abort, sessionId])

	const attemptAttach = useStableCallback(async (targetSessionId: string) => {
		if (runningRef.current) return
		runningRef.current = true
		attachedSessionRef.current = targetSessionId
		let sawQueueWork = false
		let failedAttempts = 0
		let lastExecutionId: string | null = null
		let attachedExecution: ReturnType<typeof prepareQueueAttachExecution>['execution'] | null = null
		try {
			while (mountedRef.current && sessionIdRef.current === targetSessionId) {
				const currentQueue = getQueue()
				const hasQueueWork = hasClaimableQueueWork(currentQueue)
				const shouldConfirmDrain = shouldConfirmQueueDrain(sawQueueWork, currentQueue)
				if (hasQueueWork) sawQueueWork = true
				else if (!shouldConfirmDrain) break

				let activeExecution: ActiveExecution
				try {
					activeExecution = await checkActiveExecution(targetSessionId, fetchFn)
				} catch (error) {
					failedAttempts += 1
					console.error('[llama-ai] [queue-attach-check] failed:', error)
					await new Promise((resolve) => setTimeout(resolve, failedAttempts < 3 ? 1000 : 5000))
					continue
				}

				if (!activeExecution.active) {
					if (shouldConfirmDrain) break
					failedAttempts += 1
					if (failedAttempts % 3 === 0) {
						try {
							const restored = await restoreQueue(targetSessionId)
							const snapshot = restored
								? decodeQueueSnapshot({
										sessionId: targetSessionId,
										revision: restored.queueRevision,
										queue: restored.queuedMessages
									})
								: null
							if (sessionIdRef.current === targetSessionId && snapshot) applySnapshot(snapshot)
						} catch (error) {
							console.error('[llama-ai] [queue-attach-resync] failed:', error)
						}
					}
					await new Promise((resolve) => setTimeout(resolve, failedAttempts < 3 ? 1000 : 5000))
					continue
				}

				const executionId = activeExecution.queueItemId ?? activeExecution.messageId ?? null
				const prepared = prepareQueueAttachExecution(attachedExecution, executionId)
				attachedExecution = prepared.execution
				const beforeSnapshot = queueAttachSnapshotKey(getQueue())
				const result = await attachExecution(
					targetSessionId,
					attachedExecution.buffer,
					prepared.resetStream,
					activeExecution.queueItemId ?? null
				)
				if (sessionIdRef.current !== targetSessionId) break

				const afterSnapshot = queueAttachSnapshotKey(getQueue())
				const observedExecutionId = executionId ?? result.messageId
				const progressed = didQueueAttachProgress(beforeSnapshot, afterSnapshot, lastExecutionId, observedExecutionId)
				if (progressed) failedAttempts = 0
				else if (result.outcome === 'error' || result.outcome === 'not_found') failedAttempts += 1
				lastExecutionId = observedExecutionId ?? lastExecutionId
				if (result.outcome !== 'error') attachedExecution = null
				if (result.outcome === 'error') {
					await new Promise((resolve) => setTimeout(resolve, failedAttempts < 3 ? 1000 : 5000))
				}
			}
		} finally {
			runningRef.current = false
			attachedSessionRef.current = null
			if (mountedRef.current) {
				const nextSessionId = sessionIdRef.current
				if (nextSessionId && shouldTriggerQueueAttach(isStreamingRef.current, nextSessionId, getQueue())) {
					queueMicrotask(() => void attemptAttach(nextSessionId))
				}
			}
		}
	})

	useEffect(() => {
		if (!sessionId || !shouldTriggerQueueAttach(isStreaming, sessionId, queue)) return
		void attemptAttach(sessionId)
	}, [attemptAttach, isStreaming, queue, sessionId])
}
