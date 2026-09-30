import type { RefObject } from 'react'
import { isTemporaryConnectivityError } from '~/containers/LlamaAI/connectionErrors'
import {
	waitForAbortableDelay,
	type ExecutionCoordinator,
	type ExecutionOperation
} from '~/containers/LlamaAI/executionCoordinator'
import type { AgenticExecutionSnapshot } from '~/containers/LlamaAI/executionProtocol'
import {
	AgenticExecutionChangedError,
	attachAgenticStream,
	checkActiveExecution,
	resumeAgenticStream,
	type AgenticSSECallbacks
} from '~/containers/LlamaAI/fetchAgenticResponse'
import type { QueuedMessageElement } from '~/containers/LlamaAI/queue/protocol'
import { runAgenticRequest } from '~/containers/LlamaAI/runAgenticRequest'
import { appendBufferedAssistantMessage } from '~/containers/LlamaAI/streamCallbacks'
import {
	createStreamBuffer,
	hasStreamBufferContent,
	type StreamBuffer,
	type StreamDispatch
} from '~/containers/LlamaAI/streamState'
import type { Message } from '~/containers/LlamaAI/types'
import { hasClaimableQueueWork, QUEUE_ATTACH_WAIT_MS } from '~/containers/LlamaAI/utils/queueAttach'
import { useStableCallback } from '~/hooks/useStableCallback'

export type ResumeExecutionOutcome =
	| 'settled'
	| 'inactive'
	| 'temporary-disconnect'
	| 'failed'
	| 'aborted'
	| 'superseded'

type AttachExecutionInput = {
	targetSessionId: string
	buffer?: StreamBuffer
	resetStream?: boolean
	onTemporaryDisconnect?: (error: Error, streamBuffer: StreamBuffer) => void
	operation?: ExecutionOperation
}

type CreateChatStreamCallbacks = (args: {
	buffer: StreamBuffer
	isCurrent: () => boolean
	targetSessionId: string
	replaceUserMessageId?: (messageId: string, queueItemId?: string) => void
}) => AgenticSSECallbacks

type QueueAttachOutcome = 'done' | 'timeout' | 'paused' | 'finished' | 'not_found' | 'failed' | 'error'

interface ChatExecutionOwnerOptions {
	appendMessage: (message: Message) => void
	authorizedFetch: typeof fetch
	clearRecovery: () => void
	createCallbacks: CreateChatStreamCallbacks
	currentMessageIdRef: RefObject<string | null>
	dispatch: StreamDispatch
	executionCoordinator: ExecutionCoordinator
	getCurrentSessionId: () => string | null
	getServerQueue: () => Array<QueuedMessageElement>
	onSettled: (sessionId: string) => void
	replaceUserMessageId: (messageId: string, queueItemId?: string) => void
	setPaginationError: (error: string | null) => void
	setViewError: (error: string | null) => void
}

export function useChatExecutionOwner({
	appendMessage,
	authorizedFetch,
	clearRecovery,
	createCallbacks,
	currentMessageIdRef,
	dispatch,
	executionCoordinator,
	getCurrentSessionId,
	getServerQueue,
	onSettled,
	replaceUserMessageId,
	setPaginationError,
	setViewError
}: ChatExecutionOwnerOptions) {
	const attachExecution = useStableCallback(
		async ({
			targetSessionId,
			buffer = createStreamBuffer(),
			resetStream = true,
			replayCompleted,
			onTemporaryDisconnect,
			operation: existingOperation
		}: AttachExecutionInput & { replayCompleted: boolean }): Promise<ResumeExecutionOutcome> => {
			let nextExecutionHint: AgenticExecutionSnapshot | null = null
			const execute = async (operation: ExecutionOperation, replacementCount = 0): Promise<ResumeExecutionOutcome> => {
				let activeMessageId: string | undefined
				{
					let activeResponse: Awaited<ReturnType<typeof checkActiveExecution>>
					if (nextExecutionHint) {
						const hint = nextExecutionHint
						nextExecutionHint = null
						activeResponse = { active: hint.status === 'running', execution: hint }
					} else {
						try {
							activeResponse = await checkActiveExecution(targetSessionId, authorizedFetch, operation.signal)
							if (!operation.isCurrent()) return 'aborted'
						} catch (checkError) {
							if (!operation.isCurrent()) return 'aborted'
							const error = checkError instanceof Error ? checkError : new Error(String(checkError))
							if (onTemporaryDisconnect && isTemporaryConnectivityError(error)) {
								onTemporaryDisconnect(error, buffer)
								return 'temporary-disconnect'
							}
							dispatch({ type: 'SET_ERROR', value: error.message })
							return 'failed'
						}
					}

					const activeExecution = activeResponse.execution
					if (!activeExecution) return 'inactive'
					const { status, hasResult, cursor } = activeExecution
					activeMessageId = activeExecution.messageId
					if (buffer.executionId && buffer.executionId !== activeMessageId) {
						appendBufferedAssistantMessage(buffer, currentMessageIdRef, appendMessage)
						// oxlint-disable-next-line no-param-reassign -- the buffer is rotated when the execution changes; every downstream callback receives the current one.
						buffer = createStreamBuffer()
						if (!resetStream) {
							dispatch({ type: 'RESET_STREAM' })
							dispatch({ type: 'START_STREAM' })
						}
					}
					buffer.executionId = activeMessageId

					if (!activeResponse.active) {
						const hasNewEvents = buffer.receivedEventCount < cursor
						if (!replayCompleted || status !== 'completed' || !hasResult || !hasNewEvents) return 'inactive'

						setViewError(null)
						dispatch({ type: 'SET_ERROR', value: null })
						dispatch({ type: 'RESET_RECOVERY' })
						if (resetStream) {
							dispatch({ type: 'START_STREAM' })
							currentMessageIdRef.current = null
						}

						let outcome: ResumeExecutionOutcome = 'settled'
						let changedExecution: AgenticExecutionSnapshot | null | undefined
						await runAgenticRequest({
							mode: 'replay',
							operation,
							initialEventCount: buffer.receivedEventCount,
							createCallbacks: ({ isCurrent }) => createCallbacks({ buffer, isCurrent, targetSessionId }),
							execute: async ({ callbacks, signal, eventCounter }) => {
								await resumeAgenticStream({
									sessionId: targetSessionId,
									callbacks,
									abortSignal: signal,
									fetchFn: authorizedFetch,
									...(buffer.receivedEventCount ? { from: buffer.receivedEventCount } : {}),
									expectedMessageId: activeExecution.messageId,
									eventCounter
								})
							},
							onSuccess: ({ isCurrent }) => {
								if (isCurrent()) onSettled(targetSessionId)
							},
							onError: ({ error }, { isCurrent }) => {
								if (!isCurrent()) return
								if (error instanceof AgenticExecutionChangedError) {
									changedExecution = error.execution
									return
								}
								outcome = 'failed'
								if (resetStream) dispatch({ type: 'RESET_STREAM' })
							}
						})
						if (changedExecution !== undefined && operation.isCurrent()) {
							if (replacementCount >= 2) return 'superseded'
							nextExecutionHint = changedExecution
							return execute(operation, replacementCount + 1)
						}
						return operation.isCurrent() ? outcome : 'aborted'
					}
				}

				setViewError(null)
				setPaginationError(null)
				dispatch({ type: 'SET_ERROR', value: null })
				dispatch({ type: 'RESET_RECOVERY' })
				if (resetStream) {
					dispatch({ type: 'START_STREAM' })
					currentMessageIdRef.current = null
				}

				let outcome: ResumeExecutionOutcome = 'settled'
				let changedExecution: AgenticExecutionSnapshot | null | undefined
				await runAgenticRequest({
					mode: 'resume',
					operation,
					initialEventCount: buffer.receivedEventCount,
					createCallbacks: ({ isCurrent }) => createCallbacks({ buffer, isCurrent, targetSessionId }),
					execute: async ({ callbacks, signal, eventCounter }) => {
						await resumeAgenticStream({
							sessionId: targetSessionId,
							callbacks,
							abortSignal: signal,
							fetchFn: authorizedFetch,
							from: buffer.receivedEventCount,
							expectedMessageId: activeMessageId,
							eventCounter
						})
					},
					onError: ({ kind, error }, { isCurrent, eventCounter }) => {
						if (!isCurrent()) return
						if (error instanceof AgenticExecutionChangedError) {
							changedExecution = error.execution
							return
						}
						if (kind === 'abort') {
							outcome = 'aborted'
							appendBufferedAssistantMessage(buffer, currentMessageIdRef, appendMessage)
							dispatch({ type: 'RESET_STREAM' })
							return
						}
						if (onTemporaryDisconnect && kind === 'temporary-connectivity') {
							outcome = 'temporary-disconnect'
							buffer.receivedEventCount = eventCounter.count
							onTemporaryDisconnect(error, buffer)
							return
						}
						outcome = 'failed'
						clearRecovery()
						dispatch({
							type: 'SET_ERROR',
							value: 'Lost connection while waiting for the running execution. Reconnect to try again.'
						})
						dispatch({ type: 'RESET_STREAM' })
					},
					onSuccess: ({ isCurrent }) => {
						if (isCurrent()) onSettled(targetSessionId)
					}
				})

				if (changedExecution !== undefined && operation.isCurrent()) {
					if (replacementCount >= 2) return 'superseded'
					if (changedExecution?.messageId && changedExecution.messageId !== activeMessageId) {
						appendBufferedAssistantMessage(buffer, currentMessageIdRef, appendMessage)
						// oxlint-disable-next-line no-param-reassign -- see above: the buffer is rotated for the replacement execution.
						buffer = createStreamBuffer()
						if (!resetStream) {
							dispatch({ type: 'RESET_STREAM' })
							dispatch({ type: 'START_STREAM' })
						}
					}
					nextExecutionHint = changedExecution
					return execute(operation, replacementCount + 1)
				}
				return operation.isCurrent() ? outcome : 'aborted'
			}

			if (existingOperation) return execute(existingOperation)
			return executionCoordinator.ensure(targetSessionId, 'resume', execute).catch((error) => {
				if (error instanceof DOMException && error.name === 'AbortError') return 'aborted'
				throw error
			})
		}
	)

	const attachQueuedExecution = useStableCallback(
		async (
			targetSessionId: string,
			buffer: StreamBuffer,
			resetStream: boolean,
			queueItemId: string | null,
			operation: ExecutionOperation
		) => {
			const result: {
				outcome: QueueAttachOutcome
				changedExecution: AgenticExecutionSnapshot | null | undefined
			} = {
				outcome: 'error',
				changedExecution: undefined
			}
			let changedExecution: AgenticExecutionSnapshot | null | undefined
			setViewError(null)
			setPaginationError(null)
			dispatch({ type: 'SET_ERROR', value: null })

			await runAgenticRequest({
				mode: 'resume',
				operation,
				initialEventCount: buffer.receivedEventCount,
				createCallbacks: ({ isCurrent }) => {
					const callbacks = createCallbacks({
						buffer,
						isCurrent,
						targetSessionId,
						replaceUserMessageId: (messageId, eventQueueItemId) => {
							const startedQueueItemId = eventQueueItemId ?? queueItemId
							replaceUserMessageId(messageId, startedQueueItemId ?? undefined)
							if (startedQueueItemId) {
								dispatch({ type: 'QUEUED_USER_MESSAGE_READY', queueItemId: startedQueueItemId })
							}
						}
					})
					if (!resetStream) return callbacks
					// The server can hold this request until the queue fires, for as long as a duel waits for its
					// vote. Holding is not an answer: the answer starts with the preamble that names the queued
					// execution, whose `session` or `message_id` comes before any other event.
					let started = false
					const start = () => {
						if (started || !isCurrent()) return
						started = true
						dispatch(queueItemId ? { type: 'START_QUEUED_STREAM', queueItemId } : { type: 'START_STREAM' })
						currentMessageIdRef.current = null
					}
					return {
						...callbacks,
						onSessionId: (sessionId, startedAt) => {
							start()
							callbacks.onSessionId(sessionId, startedAt)
						},
						onMessageId: (messageId) => {
							start()
							callbacks.onMessageId?.(messageId)
						}
					}
				},
				execute: async ({ callbacks, signal, eventCounter }) => {
					result.outcome = await attachAgenticStream({
						sessionId: targetSessionId,
						callbacks,
						abortSignal: signal,
						fetchFn: authorizedFetch,
						from: buffer.receivedEventCount,
						waitMs: QUEUE_ATTACH_WAIT_MS,
						...(buffer.executionId ? { expectedMessageId: buffer.executionId } : {}),
						eventCounter
					})
				},
				onError: ({ kind, error }, { isCurrent, eventCounter }) => {
					if (!isCurrent()) return
					if (error instanceof AgenticExecutionChangedError) {
						result.outcome = 'not_found'
						changedExecution = error.execution
					} else {
						result.outcome = 'error'
					}
					buffer.receivedEventCount = eventCounter.count
					const status = 'status' in error ? error.status : null
					if (status === 401 || status === 403 || status === 404) {
						result.outcome = 'failed'
						dispatch({
							type: 'SET_ERROR',
							value: 'Could not reconnect to the queued response. Refresh and try again.'
						})
						dispatch({ type: 'RESET_STREAM' })
						return
					}
					// A hold that drops before its execution starts lost nothing; the next attempt waits again.
					if (kind !== 'abort' && result.outcome === 'error' && buffer.executionId) {
						dispatch({
							type: 'SET_ERROR',
							value: 'Lost connection while waiting for the queued response. Reconnecting…'
						})
					}
				},
				onSuccess: ({ eventCounter }) => {
					buffer.receivedEventCount = eventCounter.count
				}
			})

			result.changedExecution = changedExecution
			return result
		}
	)

	const ensureQueueAttached = useStableCallback(async (targetSessionId: string) => {
		await executionCoordinator
			.ensure(targetSessionId, 'queue', async (operation) => {
				let failedAttempts = 0
				let buffer = createStreamBuffer()
				while (
					operation.isCurrent() &&
					getCurrentSessionId() === targetSessionId &&
					hasClaimableQueueWork(getServerQueue())
				) {
					const queueItemId =
						getServerQueue().find((item) => item.state === 'firing' || item.state === 'pending')?.id ?? null
					const result = await attachQueuedExecution(
						targetSessionId,
						buffer,
						!hasStreamBufferContent(buffer),
						queueItemId,
						operation
					)
					if (!operation.isCurrent()) return
					if (result.outcome === 'paused' || result.outcome === 'finished' || result.outcome === 'failed') return
					if (result.outcome === 'done') {
						failedAttempts = 0
						buffer = createStreamBuffer()
						continue
					}
					if (result.outcome === 'not_found') {
						if (buffer.executionId) {
							appendBufferedAssistantMessage(buffer, currentMessageIdRef, appendMessage)
							dispatch({ type: 'RESET_STREAM' })
						}
						buffer = createStreamBuffer()
						if (result.changedExecution) buffer.executionId = result.changedExecution.messageId
					}
					failedAttempts += 1
					await waitForAbortableDelay(failedAttempts < 3 ? 1000 : 5000, operation.signal).catch(() => undefined)
				}
			})
			.catch((error) => {
				if (!(error instanceof DOMException && error.name === 'AbortError')) throw error
			})
	})

	const resumeIfRunning = useStableCallback((input: AttachExecutionInput) =>
		attachExecution({ ...input, replayCompleted: false })
	)

	const recoverExecution = useStableCallback((input: AttachExecutionInput) =>
		attachExecution({ ...input, replayCompleted: true })
	)

	return { ensureQueueAttached, resumeIfRunning, recoverExecution }
}
