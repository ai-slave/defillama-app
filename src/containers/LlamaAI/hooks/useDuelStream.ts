import { useCallback, useRef, useState } from 'react'
import {
	dispatchAgenticEvent,
	type AgenticArmEvent,
	type AgenticSSECallbacks
} from '~/containers/LlamaAI/fetchAgenticResponse'
import { createAgenticCallbacks } from '~/containers/LlamaAI/streamCallbacks'
import {
	buildAssistantMessage,
	createStreamAccumulator,
	hasStreamBufferContent,
	type StreamAccumulator,
	type StreamDispatch
} from '~/containers/LlamaAI/streamState'
import type { Message } from '~/containers/LlamaAI/types'

export interface DuelArmState {
	message: Message | null
	/** The persisted id of this arm's answer; a vote resolves the thread to it. */
	messageId: string | null
	/** The arm saw its own `response_end`. Whether it is still streaming is the turn's state, not the arm's. */
	answered: boolean
	error: string | null
}

const EMPTY_ARM: DuelArmState = { message: null, messageId: null, answered: false, error: null }

// The buffer is the arm's only copy of its answer; nothing reads a live stream state for it.
const ignoreStreamAction: StreamDispatch = () => undefined

function useDuelArm() {
	const [arm, setArm] = useState<DuelArmState>(EMPTY_ARM)
	// Mutable and outside React: every event lands here, and render reads the snapshot in `arm`.
	const streamRef = useRef<{ buffer: StreamAccumulator; callbacks: AgenticSSECallbacks } | null>(null)

	const start = useCallback(() => {
		const buffer = createStreamAccumulator()
		streamRef.current = {
			buffer,
			callbacks: createAgenticCallbacks({
				isCurrent: () => true,
				buffer,
				dispatch: ignoreStreamAction,
				// `message_id` is session-scoped and never arm-tagged; the arm's id comes from `arm_message_id`.
				currentMessageIdRef: { current: null },
				appendMessage: () => undefined,
				notify: () => undefined
			})
		}
		setArm(EMPTY_ARM)
	}, [])

	const apply = useCallback((event: AgenticArmEvent) => {
		const stream = streamRef.current
		if (!stream) return
		// The agent closes each answer with `response_end`; `done` is session-scoped
		// and would settle both arms as soon as either one finished.
		if (event.type === 'response_end') {
			setArm((current) => ({ ...current, answered: true }))
			return
		}
		if (event.type === 'arm_message_id') {
			setArm((current) => ({ ...current, messageId: event.messageId }))
			return
		}
		dispatchAgenticEvent(event, stream.callbacks)
		const { buffer } = stream
		const message = hasStreamBufferContent(buffer) ? buildAssistantMessage(buffer) : null
		setArm((current) => ({ ...current, message, error: buffer.error }))
	}, [])

	const reset = useCallback(() => {
		streamRef.current = null
		setArm(EMPTY_ARM)
	}, [])

	return { arm, start, apply, reset }
}

/**
 * Duel UI state for one turn. Both answers arrive on the single `/agentic` stream as
 * `arm`-tagged events, so this hook never opens a request of its own.
 */
export function useDuelStream() {
	const [pairId, setPairId] = useState<string | null>(null)
	/** The execution whose stream delivered `duel_start`. Any other execution streaming in the chat ends the duel. */
	const [ownerExecutionId, setOwnerExecutionId] = useState<string | null>(null)
	/** The user message the duel answers, named by the `user_message_id` its stream sent before `duel_start`. */
	const [promptMessageId, setPromptMessageId] = useState<string | null>(null)
	const [ready, setReady] = useState(false)
	const armA = useDuelArm()
	const armB = useDuelArm()

	const startA = armA.start
	const startB = armB.start
	const applyA = armA.apply
	const applyB = armB.apply
	const resetA = armA.reset
	const resetB = armB.reset

	const start = useCallback(
		(nextPairId: string, executionId: string, nextPromptMessageId: string | null) => {
			setPairId(nextPairId)
			setOwnerExecutionId(executionId)
			setPromptMessageId(nextPromptMessageId)
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

	const reset = useCallback(() => {
		setPairId(null)
		setOwnerExecutionId(null)
		setPromptMessageId(null)
		setReady(false)
		resetA()
		resetB()
	}, [resetA, resetB])

	return {
		pairId,
		ownerExecutionId,
		promptMessageId,
		ready,
		a: armA.arm,
		b: armB.arm,
		start,
		markReady,
		handleArmEvent,
		reset
	}
}
