import type { Dispatch } from 'react'
import type { ContextWarningPayload, CsvExport, MdExport } from '~/containers/LlamaAI/fetchAgenticResponse'
import type {
	AlertProposedData,
	ChartSet,
	DashboardArtifact,
	GeneratedImage,
	Message,
	MessageMetadata,
	SpawnAgentStatus,
	TodoItem,
	ToolCall,
	ToolExecution,
	UnifiedCitationReference
} from '~/containers/LlamaAI/types'
import { stripBeforeReportStart } from '~/containers/LlamaAI/utils/reportMarkers'

export interface ChatPageContext {
	entitySlug?: string
	entityType?: 'protocol' | 'chain' | 'page'
	route: string
}

export interface RateLimitDetails {
	period: string
	limit: number
	resetTime: string | null
}

export interface RecoveryState {
	status: 'idle' | 'reconnecting'
	startedAt: number | null
	attemptCount: number
	lastErrorMessage: string | null
}

export type StreamPhase =
	| { status: 'idle' }
	| { status: 'streaming' }
	| { status: 'stopping' }
	| { status: 'reconnecting'; startedAt: number; attemptCount: number; lastErrorMessage: string | null }
	| { status: 'failed'; error: string }
	| { status: 'committed' }

export interface StreamState {
	phase: StreamPhase
	isStreaming: boolean
	pendingQueueItemId: string | null
	isCompacting: boolean
	text: string
	charts: Array<ChartSet>
	csvExports: Array<CsvExport>
	mdExports: Array<MdExport>
	alerts: Array<AlertProposedData>
	dashboards: Array<DashboardArtifact>
	generatedImages: Array<GeneratedImage>
	citations: Array<UnifiedCitationReference>
	legacyUrlCitations: Array<string>
	toolExecutions: Array<ToolExecution>
	thinking: string
	activeToolCalls: Array<ToolCall>
	spawnProgress: Map<string, SpawnAgentStatus>
	spawnStartTime: number
	spawnIsResearchMode: boolean
	todos: Array<TodoItem>
	todosStartTime: number
	executionStartedAt: number
	recovery: RecoveryState
	messageMetadata?: MessageMetadata
	error: string | null
	rateLimitDetails: RateLimitDetails | null
	contextWarning: ContextWarningPayload | null
	factCheckPhase: 'drafting' | 'verifying' | 'finalizing' | null
}

export interface StreamAccumulator {
	executionId: string | null
	text: string
	charts: Array<ChartSet>
	csvExports: Array<CsvExport>
	mdExports: Array<MdExport>
	alerts: Array<AlertProposedData>
	dashboards: Array<DashboardArtifact>
	generatedImages: Array<GeneratedImage>
	citations: Array<UnifiedCitationReference>
	legacyUrlCitations: Array<string>
	toolExecutions: Array<ToolExecution>
	thinking: string
	error: string | null
	hasStartedText: boolean
	spawnStarted: boolean
	receivedEventCount: number
	messageMetadata?: MessageMetadata
}

export type StreamBuffer = StreamAccumulator

type ResettableStreamState = Omit<
	StreamState,
	'phase' | 'messageMetadata' | 'error' | 'rateLimitDetails' | 'contextWarning'
>

export type StreamAction =
	| { type: 'START_STREAM' }
	| { type: 'START_QUEUED_STREAM'; queueItemId: string }
	| { type: 'QUEUED_USER_MESSAGE_READY'; queueItemId: string }
	| { type: 'RESET_STREAM' }
	| { type: 'STOP_REQUESTED' }
	| { type: 'STOP_FAILED'; error: string }
	| { type: 'COMMIT_STREAM' }
	| { type: 'SET_COMPACTING'; value: boolean }
	| { type: 'SET_ERROR'; value: string | null }
	| { type: 'SET_RATE_LIMIT_DETAILS'; value: RateLimitDetails | null }
	| { type: 'APPEND_TOKEN'; value: string }
	| { type: 'APPEND_CHARTS'; value: ChartSet }
	| { type: 'APPEND_CSV_EXPORTS'; value: Array<CsvExport> }
	| { type: 'APPEND_MD_EXPORTS'; value: Array<MdExport> }
	| { type: 'APPEND_ALERT'; value: AlertProposedData }
	| { type: 'APPEND_DASHBOARD'; value: DashboardArtifact }
	| { type: 'APPEND_GENERATED_IMAGES'; value: Array<GeneratedImage> }
	| { type: 'MERGE_CITATIONS'; value: Array<string> }
	| { type: 'APPEND_TOOL_EXECUTION'; value: ToolExecution }
	| { type: 'SET_MESSAGE_METADATA'; value: MessageMetadata }
	| { type: 'APPEND_THINKING'; value: string }
	| { type: 'APPEND_TOOL_CALL'; value: ToolCall }
	| { type: 'CLEAR_ACTIVITY' }
	| { type: 'SET_SPAWN_START_TIME'; value: number }
	| { type: 'SET_SPAWN_RESEARCH_MODE'; value: boolean }
	| { type: 'SET_EXECUTION_STARTED_AT'; value: number }
	| { type: 'UPSERT_SPAWN_PROGRESS'; value: SpawnAgentStatus }
	| { type: 'SET_TODOS'; value: unknown }
	| { type: 'START_RECOVERY'; startedAt: number; lastErrorMessage: string | null }
	| { type: 'UPDATE_RECOVERY'; attemptCount: number; lastErrorMessage: string | null }
	| { type: 'RESET_RECOVERY' }
	| { type: 'SET_CONTEXT_WARNING'; value: ContextWarningPayload | null }
	| { type: 'SET_FACT_CHECK_PHASE'; value: 'drafting' | 'verifying' | 'finalizing' | null }
	| { type: 'SET_CITATIONS'; citations: Array<UnifiedCitationReference>; text?: string }

// Reset only the in-flight runtime fields; persistent errors are layered on top separately.
const createEmptyRuntimeState = (): ResettableStreamState => ({
	isStreaming: false,
	pendingQueueItemId: null,
	isCompacting: false,
	text: '',
	charts: [],
	csvExports: [],
	mdExports: [],
	alerts: [],
	dashboards: [],
	generatedImages: [],
	citations: [],
	legacyUrlCitations: [],
	toolExecutions: [],
	thinking: '',
	activeToolCalls: [],
	spawnProgress: new Map<string, SpawnAgentStatus>(),
	spawnStartTime: 0,
	spawnIsResearchMode: false,
	todos: [],
	todosStartTime: 0,
	executionStartedAt: 0,
	recovery: {
		status: 'idle',
		startedAt: null,
		attemptCount: 0,
		lastErrorMessage: null
	},
	factCheckPhase: null
})

// Full stream state starts from the empty runtime snapshot plus error/retry metadata.
export const createInitialStreamState = (): StreamState => ({
	phase: { status: 'idle' },
	...createEmptyRuntimeState(),
	error: null,
	rateLimitDetails: null,
	contextWarning: null
})

// Keep a mutable buffer while SSE events arrive, then commit it as one assistant message at the end.
export const createStreamAccumulator = (): StreamAccumulator => ({
	executionId: null,
	text: '',
	charts: [],
	csvExports: [],
	mdExports: [],
	alerts: [],
	dashboards: [],
	generatedImages: [],
	citations: [],
	legacyUrlCitations: [],
	toolExecutions: [],
	thinking: '',
	error: null,
	hasStartedText: false,
	spawnStarted: false,
	receivedEventCount: 0
})

export const createStreamBuffer = createStreamAccumulator

export function hasStreamBufferContent(buffer: StreamBuffer) {
	return Boolean(
		buffer.text ||
		buffer.charts.length > 0 ||
		buffer.csvExports.length > 0 ||
		buffer.mdExports.length > 0 ||
		buffer.alerts.length > 0 ||
		buffer.dashboards.length > 0 ||
		buffer.generatedImages.length > 0 ||
		buffer.citations.length > 0 ||
		buffer.legacyUrlCitations.length > 0 ||
		buffer.toolExecutions.length > 0 ||
		buffer.thinking
	)
}

// Drive the live streaming UI without mutating message history until the request is complete.
export function streamReducer(state: StreamState, action: StreamAction): StreamState {
	switch (action.type) {
		case 'START_STREAM':
		case 'START_QUEUED_STREAM':
			return {
				...state,
				...createEmptyRuntimeState(),
				phase: { status: 'streaming' },
				isStreaming: true,
				pendingQueueItemId: action.type === 'START_QUEUED_STREAM' ? action.queueItemId : null,
				error: null,
				rateLimitDetails: null
			}
		case 'QUEUED_USER_MESSAGE_READY':
			return state.pendingQueueItemId === action.queueItemId ? { ...state, pendingQueueItemId: null } : state
		case 'RESET_STREAM':
			// Clear only in-flight runtime fields. Error/rate-limit metadata is managed
			// by separate actions so callers can reset the draft without hiding failures.
			return { ...state, ...createEmptyRuntimeState(), phase: { status: 'idle' } }
		case 'STOP_REQUESTED':
			return { ...state, phase: { status: 'stopping' }, isStreaming: true, error: null }
		case 'STOP_FAILED':
			return { ...state, phase: { status: 'streaming' }, isStreaming: true, error: action.error }
		case 'COMMIT_STREAM':
			return {
				...state,
				...createEmptyRuntimeState(),
				phase: state.phase.status === 'stopping' ? state.phase : { status: 'committed' },
				isStreaming: state.phase.status === 'stopping'
			}
		case 'SET_COMPACTING':
			return { ...state, isCompacting: action.value }
		case 'SET_ERROR':
			return {
				...state,
				error: action.value,
				phase: action.value
					? { status: 'failed', error: action.value }
					: state.phase.status === 'failed'
						? { status: 'idle' }
						: state.phase
			}
		case 'SET_RATE_LIMIT_DETAILS':
			return { ...state, rateLimitDetails: action.value }
		case 'APPEND_TOKEN': {
			const newText = stripBeforeReportStart(state.text + action.value)
			return { ...state, text: newText }
		}
		case 'APPEND_CHARTS':
			return { ...state, charts: [...state.charts, action.value] }
		case 'APPEND_CSV_EXPORTS':
			return { ...state, csvExports: [...state.csvExports, ...action.value] }
		case 'APPEND_MD_EXPORTS':
			return { ...state, mdExports: [...state.mdExports, ...action.value] }
		case 'APPEND_ALERT':
			return { ...state, alerts: [...state.alerts, action.value] }
		case 'APPEND_DASHBOARD':
			return { ...state, dashboards: [...state.dashboards, action.value] }
		case 'APPEND_GENERATED_IMAGES':
			return { ...state, generatedImages: [...state.generatedImages, ...action.value] }
		case 'MERGE_CITATIONS':
			return { ...state, legacyUrlCitations: [...new Set([...state.legacyUrlCitations, ...action.value])] }
		case 'APPEND_TOOL_EXECUTION':
			return { ...state, toolExecutions: [...state.toolExecutions, action.value] }
		case 'SET_MESSAGE_METADATA':
			return { ...state, messageMetadata: action.value }
		case 'APPEND_THINKING':
			return { ...state, thinking: state.thinking + action.value }
		case 'APPEND_TOOL_CALL':
			return { ...state, activeToolCalls: [...state.activeToolCalls, action.value] }
		case 'CLEAR_ACTIVITY':
			return {
				...state,
				activeToolCalls: [],
				spawnProgress: new Map<string, SpawnAgentStatus>(),
				spawnStartTime: 0,
				todos: [],
				todosStartTime: 0
			}
		case 'SET_SPAWN_START_TIME':
			return { ...state, spawnStartTime: action.value }
		case 'SET_SPAWN_RESEARCH_MODE':
			return { ...state, spawnIsResearchMode: action.value }
		case 'SET_EXECUTION_STARTED_AT':
			return { ...state, executionStartedAt: action.value }
		case 'UPSERT_SPAWN_PROGRESS': {
			const next = new Map(state.spawnProgress)
			const existing = next.get(action.value.id)
			const progress: SpawnAgentStatus = {
				...existing,
				id: action.value.id,
				status: action.value.status
			}
			if (action.value.tool !== undefined) progress.tool = action.value.tool
			if (action.value.toolCount !== undefined) progress.toolCount = action.value.toolCount
			if (action.value.chartCount !== undefined) progress.chartCount = action.value.chartCount
			if (action.value.findingsPreview !== undefined) progress.findingsPreview = action.value.findingsPreview
			next.set(action.value.id, progress)
			return { ...state, spawnProgress: next }
		}
		case 'SET_TODOS': {
			const todos = Array.isArray(action.value) ? (action.value as Array<TodoItem>) : []
			if (state.isStreaming && todos.length === 0 && state.todos.length > 0) return state
			// Keep the first non-empty todo timestamp stable while later snapshots
			// update item statuses; the elapsed timer should not restart per update.
			const todosStartTime = todos.length > 0 ? state.todosStartTime || Date.now() : state.todosStartTime
			return { ...state, todos, todosStartTime }
		}
		case 'START_RECOVERY':
			return {
				...state,
				recovery: {
					status: 'reconnecting',
					startedAt: action.startedAt,
					attemptCount: 0,
					lastErrorMessage: action.lastErrorMessage
				},
				phase: {
					status: 'reconnecting',
					startedAt: action.startedAt,
					attemptCount: 0,
					lastErrorMessage: action.lastErrorMessage
				}
			}
		case 'UPDATE_RECOVERY':
			return {
				...state,
				recovery: {
					...state.recovery,
					status: 'reconnecting',
					attemptCount: action.attemptCount,
					lastErrorMessage: action.lastErrorMessage
				},
				phase: {
					status: 'reconnecting',
					startedAt: state.recovery.startedAt ?? Date.now(),
					attemptCount: action.attemptCount,
					lastErrorMessage: action.lastErrorMessage
				}
			}
		case 'RESET_RECOVERY':
			return {
				...state,
				recovery: {
					status: 'idle',
					startedAt: null,
					attemptCount: 0,
					lastErrorMessage: null
				},
				phase: state.phase.status === 'reconnecting' ? { status: 'idle' } : state.phase
			}
		case 'SET_CONTEXT_WARNING':
			return { ...state, contextWarning: action.value }
		case 'SET_FACT_CHECK_PHASE':
			return { ...state, factCheckPhase: action.value }
		case 'SET_CITATIONS':
			return { ...state, citations: action.citations, ...(action.text ? { text: action.text } : {}) }
		default:
			return state
	}
}

// Convert the buffered stream payload into the same message shape used for restored history.
export function buildAssistantMessage(buffer: StreamBuffer, messageId?: string): Message {
	const nonEmpty = <T>(value: Array<T> | undefined) => (value && value.length > 0 ? value : undefined)

	return {
		role: 'assistant',
		content: buffer.text || undefined,
		charts: nonEmpty(buffer.charts),
		csvExports: nonEmpty(buffer.csvExports),
		mdExports: nonEmpty(buffer.mdExports),
		alerts: nonEmpty(buffer.alerts),
		dashboards: nonEmpty(buffer.dashboards),
		generatedImages: nonEmpty(buffer.generatedImages),
		citations: nonEmpty(buffer.citations),
		legacyUrlCitations: nonEmpty(buffer.legacyUrlCitations),
		toolExecutions: nonEmpty(buffer.toolExecutions),
		thinking: buffer.thinking || undefined,
		messageMetadata: buffer.messageMetadata,
		id: messageId
	}
}

export type StreamDispatch = Dispatch<StreamAction>
