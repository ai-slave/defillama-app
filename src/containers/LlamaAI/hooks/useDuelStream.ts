import { useCallback, useReducer, useRef, useState } from 'react'
import {
	dispatchAgenticEvent,
	type AgenticArmEvent,
	type AgenticSSECallbacks
} from '~/containers/LlamaAI/fetchAgenticResponse'
import { createAgenticCallbacks } from '~/containers/LlamaAI/streamCallbacks'
import {
	buildAssistantMessage,
	createInitialStreamState,
	createStreamBuffer,
	hasStreamBufferContent,
	streamReducer
} from '~/containers/LlamaAI/streamState'
import type { Message } from '~/containers/LlamaAI/types'

export interface DuelArmState {
	message: Message | null
	messageId: string | null
	isStreaming: boolean
	error: string | null
}

function useDuelArm() {
	const [streamState, dispatch] = useReducer(streamReducer, undefined, createInitialStreamState)
	const [persistedMessageId, setPersistedMessageId] = useState<string | null>(null)
	const bufferRef = useRef(createStreamBuffer())
	const currentMessageIdRef = useRef<string | null>(null)
	const toolCallIdRef = useRef(0)
	const activeRequestIdRef = useRef(0)
	const callbacksRef = useRef<AgenticSSECallbacks | null>(null)

	const start = useCallback(() => {
		const buffer = createStreamBuffer()
		bufferRef.current = buffer
		currentMessageIdRef.current = null
		setPersistedMessageId(null)
		dispatch({ type: 'START_STREAM' })
		callbacksRef.current = createAgenticCallbacks({
			requestId: activeRequestIdRef.current,
			activeRequestIdRef,
			buffer,
			dispatch,
			currentMessageIdRef,
			toolCallIdRef,
			// Duel answers render from their arm buffer and never enter shared message history;
			// callback dispatches already provide the render notification for every event.
			appendMessage: () => undefined,
			notify: () => undefined
		})
	}, [])

	const settle = useCallback(() => {
		dispatch({ type: 'COMMIT_STREAM' })
	}, [])

	const apply = useCallback(
		(event: AgenticArmEvent) => {
			const callbacks = callbacksRef.current
			if (!callbacks) return
			// The agent closes each answer with `response_end`; `done` is session-scoped
			// and would settle both arms as soon as either one finished.
			if (event.type === 'response_end') {
				settle()
				return
			}
			// The persisted id of this arm's answer; it resolves the thread on vote and
			// is never answer content.
			if (event.type === 'arm_message_id') {
				setPersistedMessageId(event.messageId)
				return
			}
			dispatchAgenticEvent(event, callbacks)
		},
		[settle]
	)

	const reset = useCallback(() => {
		callbacksRef.current = null
		bufferRef.current = createStreamBuffer()
		currentMessageIdRef.current = null
		setPersistedMessageId(null)
		dispatch({ type: 'RESET_STREAM' })
		dispatch({ type: 'SET_ERROR', value: null })
	}, [])

	// Computed every render on purpose: the buffer mutates in place, so memoising it would
	// stall the live draft behind a dependency the compiler cannot see.
	const message: Message | null = hasStreamBufferContent(bufferRef.current)
		? buildAssistantMessage(bufferRef.current, currentMessageIdRef.current ?? undefined)
		: null

	return {
		message,
		messageId: persistedMessageId,
		isStreaming: streamState.isStreaming,
		error: streamState.error,
		start,
		apply,
		settle,
		reset
	}
}

/**
 * Duel UI state for one turn. Both answers arrive on the single `/agentic` stream as
 * `arm`-tagged events, so this hook never opens a request of its own.
 */
export function useDuelStream() {
	const [pairId, setPairId] = useState<string | null>(null)
	const [ready, setReady] = useState(false)
	const armA = useDuelArm()
	const armB = useDuelArm()

	const startA = armA.start
	const startB = armB.start
	const applyA = armA.apply
	const applyB = armB.apply
	const settleA = armA.settle
	const settleB = armB.settle
	const resetA = armA.reset
	const resetB = armB.reset

	const start = useCallback(
		(nextPairId: string) => {
			setPairId(nextPairId)
			setReady(false)
			startA()
			startB()
		},
		[startA, startB]
	)

	const markReady = useCallback(() => setReady(true), [])

	const handleArmEvent = useCallback(
		(event: AgenticArmEvent) => {
			if (event.arm === 'b') applyB(event)
			else applyA(event)
		},
		[applyA, applyB]
	)

	const finish = useCallback(() => {
		settleA()
		settleB()
	}, [settleA, settleB])

	const reset = useCallback(() => {
		setPairId(null)
		setReady(false)
		resetA()
		resetB()
	}, [resetA, resetB])

	const a: DuelArmState = {
		message: armA.message,
		messageId: armA.messageId,
		isStreaming: armA.isStreaming,
		error: armA.error
	}
	const b: DuelArmState = {
		message: armB.message,
		messageId: armB.messageId,
		isStreaming: armB.isStreaming,
		error: armB.error
	}

	return { pairId, ready, a, b, start, markReady, handleArmEvent, finish, reset }
}
