import type { RefObject } from 'react'
import { appendReasoning, completeToolStep, startToolStep } from '~/containers/LlamaAI/agentSteps'
import type { AgenticArmEvent, AgenticSSECallbacks, SpawnProgressData } from '~/containers/LlamaAI/fetchAgenticResponse'
import type { QueueSnapshot } from '~/containers/LlamaAI/queue/protocol'
import {
	buildAssistantMessage,
	hasStreamBufferContent,
	type StreamAccumulator,
	type StreamDispatch
} from '~/containers/LlamaAI/streamState'
import { applyTerminalOps } from '~/containers/LlamaAI/terminal/terminalOps'
import type { TerminalRequestPayload } from '~/containers/LlamaAI/terminal/terminalScreenshot'
import type { DashboardArtifact, Message, TodoItem, UnifiedCitationReference } from '~/containers/LlamaAI/types'
import { stripBeforeReportStart } from '~/containers/LlamaAI/utils/reportMarkers'

// Consume the current streamed message id once the buffered assistant message is committed.
function takeCurrentMessageId(ref: RefObject<string | null>) {
	const messageId = ref.current || undefined
	ref.current = null
	return messageId
}

export function appendBufferedAssistantMessage(
	buffer: StreamAccumulator,
	currentMessageIdRef: RefObject<string | null>,
	appendMessage: (message: Message) => void
) {
	if (!hasStreamBufferContent(buffer)) {
		currentMessageIdRef.current = null
		return
	}

	appendMessage(buildAssistantMessage(buffer, takeCurrentMessageId(currentMessageIdRef)))
}

export function createAgenticCallbacks({
	isCurrent,
	buffer,
	dispatch,
	currentMessageIdRef,
	onSessionId,
	onTitle,
	onTokenLimit,
	onDashboardArtifact,
	appendMessage,
	replaceLocalUserMessageId,
	setMessageSiblingInfo,
	deferEmptyDone,
	onFactCheckStatus,
	onFactCheckCitations,
	onDuelStart,
	onDuelReady,
	onArmEvent,
	onQueueUpdated,
	onTerminalRequest,
	onMessageIdObserved,
	onUserMessageIdObserved,
	onCompletion,
	onAnswer,
	notify
}: {
	isCurrent: () => boolean
	buffer: StreamAccumulator
	dispatch: StreamDispatch
	currentMessageIdRef: RefObject<string | null>
	onSessionId?: (sessionId: string) => void
	onTitle?: (title: string) => void
	onTokenLimit?: () => void
	onDashboardArtifact?: (dashboard: DashboardArtifact) => void
	appendMessage: (message: Message) => void
	replaceLocalUserMessageId?: (realId: string, queueItemId?: string) => void
	setMessageSiblingInfo?: (messageId: string, siblingInfo: Message['siblingInfo']) => void
	deferEmptyDone?: boolean
	onFactCheckStatus?: (status: 'drafting' | 'verifying' | 'finalizing') => void
	onFactCheckCitations?: (refs: Array<UnifiedCitationReference>, finalizedText?: string) => void
	onDuelStart?: (pairId: string) => void
	onDuelReady?: () => void
	onArmEvent?: (event: AgenticArmEvent) => void
	onQueueUpdated?: (snapshot: QueueSnapshot) => void
	onTerminalRequest?: (request: TerminalRequestPayload) => void
	onMessageIdObserved?: (messageId: string) => void
	onUserMessageIdObserved?: (messageId: string) => void
	onCompletion?: (messageId: string) => void
	/** The stream delivered content and reported no error. */
	onAnswer?: () => void
	notify: () => void
}): AgenticSSECallbacks {
	// One guard wraps every callback so late chunks from an aborted or superseded
	// request cannot mutate the current chat.
	const guard =
		<Args extends Array<unknown>>(fn: (...args: Args) => void) =>
		(...args: Args) => {
			if (!isCurrent()) return
			fn(...args)
		}

	// A resume probe or replayed stream can re-fire `done` after we already committed.
	// Commit the buffered assistant message at most once per callback set.
	let committed = false

	return {
		onToken: guard((content) => {
			if (!buffer.hasStartedText) {
				buffer.hasStartedText = true
				dispatch({ type: 'CLEAR_ACTIVITY' })
			}
			// The accumulator stores committed content; the reducer receives the raw
			// chunk so live state can apply the same report-marker utility.
			buffer.text = stripBeforeReportStart(buffer.text + content)
			dispatch({ type: 'APPEND_TOKEN', value: content })
		}),
		// A correction retry rewrites the answer, not what the agent did to get there: the steps stay.
		onResponseReset: guard(() => {
			buffer.text = ''
			buffer.hasStartedText = false
			dispatch({ type: 'RESET_TEXT' })
		}),
		onCharts: guard((charts, chartData, artifactRefs) => {
			dispatch({ type: 'CLEAR_ACTIVITY' })
			const chartSet = { charts, chartData, ...(artifactRefs && { artifactRefs }) }
			buffer.charts.push(chartSet)
			dispatch({ type: 'APPEND_CHARTS', value: chartSet })
		}),
		onGeneratedImages: guard((images) => {
			if (!images?.length) return
			dispatch({ type: 'CLEAR_ACTIVITY' })
			buffer.generatedImages.push(...images)
			dispatch({ type: 'APPEND_GENERATED_IMAGES', value: images })
		}),
		onCsvExport: guard((exports) => {
			buffer.csvExports.push(...exports)
			dispatch({ type: 'APPEND_CSV_EXPORTS', value: exports })
		}),
		onMdExport: guard((exports) => {
			buffer.mdExports.push(...exports)
			dispatch({ type: 'APPEND_MD_EXPORTS', value: exports })
		}),
		onAlertProposed: guard((data) => {
			buffer.alerts.push(data)
			dispatch({ type: 'APPEND_ALERT', value: data })
		}),
		onDashboard: guard((dashboard) => {
			buffer.dashboards.push(dashboard)
			dispatch({ type: 'APPEND_DASHBOARD', value: dashboard })
			onDashboardArtifact?.(dashboard)
		}),
		onCitations: guard((citations) => {
			buffer.legacyUrlCitations = [...new Set([...buffer.legacyUrlCitations, ...citations])]
			dispatch({ type: 'MERGE_CITATIONS', value: citations })
		}),
		onToolCall: guard((call) => {
			buffer.steps = startToolStep(buffer.steps, call)
			dispatch({ type: 'APPEND_TOOL_CALL', value: call })
		}),
		onToolExecution: guard((data) => {
			buffer.toolExecutions.push(data)
			buffer.steps = completeToolStep(buffer.steps, data)
			dispatch({ type: 'APPEND_TOOL_EXECUTION', value: data })
			if (data.name === 'todo' && data.success) {
				const todos = (data.toolData as { todos?: Array<TodoItem> } | undefined)?.todos
				if (Array.isArray(todos)) {
					dispatch({ type: 'SET_TODOS', value: todos })
				}
			}
		}),
		onTodos: guard((todos) => {
			dispatch({ type: 'SET_TODOS', value: todos })
		}),
		onMessageMetadata: guard((data) => {
			buffer.messageMetadata = data
			dispatch({ type: 'SET_MESSAGE_METADATA', value: data })
		}),
		onThinking: guard((content) => {
			buffer.steps = appendReasoning(buffer.steps, content)
			dispatch({ type: 'APPEND_REASONING', value: content })
		}),
		onSpawnProgress: guard((data: SpawnProgressData) => {
			if (data.status === 'started' && !buffer.spawnStarted) {
				buffer.spawnStarted = true
				dispatch({ type: 'SET_SPAWN_START_TIME', value: data.startedAt ?? Date.now() })
				if (data.isResearchMode !== undefined) {
					dispatch({ type: 'SET_SPAWN_RESEARCH_MODE', value: data.isResearchMode })
				}
			}
			dispatch({
				type: 'UPSERT_SPAWN_PROGRESS',
				value: {
					id: data.agentId,
					status: data.status,
					tool: data.tool,
					toolCount: data.toolCount,
					chartCount: data.chartCount,
					findingsPreview: data.findingsPreview
				}
			})
		}),
		onCompaction: guard((data) => {
			dispatch({ type: 'SET_COMPACTING', value: data.status === 'started' })
		}),
		onSessionId: guard((sessionId, startedAt) => {
			onSessionId?.(sessionId)
			if (startedAt) dispatch({ type: 'SET_EXECUTION_STARTED_AT', value: startedAt })
		}),
		onMessageId: guard((messageId) => {
			buffer.executionId = messageId
			// The ref serves the async machinery, which reads it outside render; the dispatch is what the
			// streaming draft renders from.
			currentMessageIdRef.current = messageId
			dispatch({ type: 'SET_MESSAGE_ID', value: messageId })
			onMessageIdObserved?.(messageId)
		}),
		onUserMessageId: guard((messageId, queueItemId) => {
			replaceLocalUserMessageId?.(messageId, queueItemId)
			onUserMessageIdObserved?.(messageId)
		}),
		onSiblingInfo: guard((messageId, siblingInfo) => {
			setMessageSiblingInfo?.(messageId, siblingInfo)
		}),
		onTitle: guard((title) => {
			onTitle?.(title)
		}),
		onTokenLimit: guard(() => {
			onTokenLimit?.()
		}),
		onContextWarning: guard((warning) => {
			dispatch({ type: 'SET_CONTEXT_WARNING', value: warning })
		}),
		onFactCheckStatus: guard((status) => {
			dispatch({ type: 'SET_FACT_CHECK_PHASE', value: status })
			onFactCheckStatus?.(status)
		}),
		onFactCheckCitations: guard((refs, finalizedText) => {
			buffer.citations = refs
			const hasFinalizedText = typeof finalizedText === 'string' && finalizedText.length > 0
			if (hasFinalizedText) buffer.text = finalizedText
			dispatch({ type: 'SET_CITATIONS', citations: refs, ...(hasFinalizedText ? { text: finalizedText } : {}) })
			onFactCheckCitations?.(refs, finalizedText)
		}),
		onDuelStart: guard((pairId) => {
			onDuelStart?.(pairId)
		}),
		onDuelReady: guard(() => {
			onDuelReady?.()
		}),
		onArmEvent: guard((event) => {
			onArmEvent?.(event)
		}),
		onQueueUpdated: guard((snapshot) => {
			onQueueUpdated?.(snapshot)
		}),
		onTerminalOps: guard((payload) => {
			// The backend persists one terminal_ops block per message: first symbol and interval, every op.
			buffer.terminalOps = buffer.terminalOps
				? { ...buffer.terminalOps, ops: [...buffer.terminalOps.ops, ...payload.ops] }
				: payload
			applyTerminalOps(payload)
		}),
		onTerminalRequest: guard((request) => {
			onTerminalRequest?.(request)
		}),
		onError: guard((content) => {
			buffer.error = content
			dispatch({ type: 'SET_ERROR', value: content })
		}),
		onDone: guard(() => {
			// Resume probes can legitimately end with only a `done` event after the
			// backend has already persisted the result; avoid committing an empty message.
			if (committed) return
			const completedMessageId = currentMessageIdRef.current
			if (deferEmptyDone && !buffer.error && !hasStreamBufferContent(buffer)) {
				committed = true
				return
			}
			committed = true
			const answered = !buffer.error && hasStreamBufferContent(buffer)
			appendBufferedAssistantMessage(buffer, currentMessageIdRef, appendMessage)
			dispatch({ type: 'COMMIT_STREAM' })
			notify()
			if (answered) onAnswer?.()
			if (completedMessageId) onCompletion?.(completedMessageId)
		})
	}
}
