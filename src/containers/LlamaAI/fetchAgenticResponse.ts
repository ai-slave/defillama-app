import { AI_SERVER } from '~/constants'
import {
	normalizeChartConfigs,
	normalizeChartArtifactRefs,
	normalizeChartDataByKey,
	normalizeDashboardArtifactOutcomes,
	normalizeDashboardChartData,
	migrateDashboardItems
} from '~/containers/LlamaAI/chartPayloads'
import type { ChartConfiguration, ChartDataByKey } from '~/containers/LlamaAI/chartTypes'
import { waitForAbortableDelay } from '~/containers/LlamaAI/executionCoordinator'
import {
	decodeActiveExecutionResponse,
	decodeExecutionSnapshot,
	type AgenticExecutionSnapshot
} from '~/containers/LlamaAI/executionProtocol'
import {
	decodeAgenticMutationReconciliation,
	type AgenticMutationEnvelope
} from '~/containers/LlamaAI/mutationProtocol'
import { decodeQueueSnapshot, type QueueSnapshot } from '~/containers/LlamaAI/queue/protocol'
import type {
	AlertProposedData,
	ChartArtifactRefs,
	DashboardArtifact,
	GeneratedImage,
	MessageMetadata,
	TodoItem,
	ToolExecution,
	UnifiedCitationReference
} from '~/containers/LlamaAI/types'
import { normalizeAlertProposedData } from '~/containers/LlamaAI/utils/restoredAlerts'
import type { PersistedDashboardItemConfig } from '~/containers/ProDashboard/dashboardConfig/persisted'
import { getErrorMessage } from '~/utils/error'

export interface CsvExport {
	id: string
	title: string
	url: string
	rowCount: number
	filename: string
}

export interface MdExport {
	id: string
	title: string
	url: string
	filename: string
}

export interface SpawnProgressData {
	agentId: string
	status: 'started' | 'thinking' | 'tool_call' | 'completed' | 'error'
	tool?: string
	toolCount?: number
	chartCount?: number
	findingsPreview?: string
	startedAt?: number
	isResearchMode?: boolean
}

type AgenticCursorMode = 'legacy' | 'server'

function cursorModeForResponse(response: Response): AgenticCursorMode {
	return response.headers.get('content-type')?.toLowerCase().includes('cursor=v2') ? 'server' : 'legacy'
}

export class AgenticExecutionChangedError extends Error {
	readonly execution: AgenticExecutionSnapshot | null

	constructor(execution: AgenticExecutionSnapshot | null) {
		super('The active execution changed before the stream attached.')
		this.name = 'AgenticExecutionChangedError'
		this.execution = execution
	}
}

export interface AgenticSSECallbacks {
	onToken: (content: string) => void
	onCharts: (charts: Array<ChartConfiguration>, chartData: ChartDataByKey, artifactRefs?: ChartArtifactRefs) => void
	onGeneratedImages?: (images: Array<GeneratedImage>) => void
	onProgress: (toolName: string, isPremium?: boolean) => void
	onSpawnProgress: (data: SpawnProgressData) => void
	onSessionId: (sessionId: string, startedAt?: number) => void
	onCitations: (citations: Array<string>) => void
	onFactCheckStatus?: (status: 'drafting' | 'verifying' | 'finalizing') => void
	onFactCheckCitations?: (refs: Array<UnifiedCitationReference>, finalizedText?: string) => void
	onCsvExport?: (exports: Array<CsvExport>) => void
	onMdExport?: (exports: Array<MdExport>) => void
	onAlertProposed?: (data: AlertProposedData) => void
	onDashboard?: (dashboard: DashboardArtifact) => void
	onToolExecution?: (data: ToolExecution) => void
	onTodos?: (todos: Array<TodoItem>) => void
	onMessageMetadata?: (data: MessageMetadata) => void
	onThinking?: (content: string) => void
	onCompaction?: (data: { status: 'started' | 'completed'; messagesBefore: number; messagesAfter?: number }) => void
	onTitle?: (title: string) => void
	onMessageId?: (messageId: string) => void
	onUserMessageId?: (messageId: string, queueItemId?: string) => void
	onSiblingInfo?: (messageId: string, siblingInfo: SiblingInfoEvent['siblingInfo']) => void
	onTokenLimit?: () => void
	onContextWarning?: (warning: ContextWarningPayload) => void
	onDuelStart?: (pairId: string) => void
	onDuelReady?: () => void
	onArmEvent?: (event: AgenticArmEvent) => void
	onQueueUpdated?: (snapshot: QueueSnapshot) => void
	onError: (content: string) => void
	onDone: () => void
}

interface SessionEvent {
	type: 'session'
	sessionId: string
	startedAt?: number
}

interface ToolCallEvent {
	type: 'tool_call'
	name: string
	isPremium?: boolean
}

interface ResponseChunkEvent {
	type: 'response_chunk'
	content?: unknown
}

interface ChartsEvent {
	type: 'charts'
	charts?: unknown
	chartData?: unknown
	artifactOutcomes?: unknown
	artifactRefs?: unknown
}

interface GeneratedImagesEvent {
	type: 'generated_images'
	images?: unknown
}

interface CsvExportEvent {
	type: 'csv_export'
	exports?: unknown
}

interface MdExportEvent {
	type: 'md_export'
	exports?: unknown
}

interface AlertProposedEvent extends AlertProposedData {
	type: 'alert_proposed'
}

interface DashboardEvent {
	type: 'dashboard'
	dashboard_id?: string
	dashboardConfig?: {
		dashboardName?: unknown
		items?: Array<PersistedDashboardItemConfig>
		timePeriod?: unknown
		sourceDashboardId?: unknown
	}
	chartData?: unknown
	artifactOutcomes?: unknown
	content?: {
		dashboard_id?: string
		dashboardConfig?: {
			dashboardName?: unknown
			items?: Array<PersistedDashboardItemConfig>
			timePeriod?: unknown
			sourceDashboardId?: unknown
		}
		chartData?: unknown
		artifactOutcomes?: unknown
	}
}

interface CompactionEvent {
	type: 'compaction'
	status: 'started' | 'completed'
	messagesBefore: number
	messagesAfter?: number
}

interface ThinkingEvent {
	type: 'thinking'
	content?: unknown
}

interface CitationsEvent {
	type: 'citations'
	citations?: unknown
}

interface FactCheckStatusEvent {
	type: 'fact_check_status'
	status: 'drafting' | 'verifying' | 'finalizing'
}

interface FactCheckCitationsEvent {
	type: 'fact_check_citations'
	citations?: Array<UnifiedCitationReference>
	sources?: Array<UnifiedCitationReference>
	response?: string
	sessionId: string
}

interface TitleEvent {
	type: 'title'
	content: string
}

interface MessageIdEvent {
	type: 'message_id'
	messageId: string
}

interface UserMessageIdEvent {
	type: 'user_message_id'
	messageId: string
	queueItemId?: string
}

interface SiblingInfoEvent {
	type: 'sibling_info'
	messageId: string
	siblingInfo: {
		currentVersion: number
		totalVersions: number
		siblings: Array<{ messageId: string; leafMessageId: string }>
	}
}

interface TokenLimitEvent {
	type: 'token_limit'
	upgradeUrl?: string
}

export interface ContextWarningPayload {
	kind: 'long_thread'
	reason: 'tokens' | 'messages'
	message: string
	thresholds?: { input_tokens?: number; messages?: number }
	observed?: { input_tokens?: number; messages?: number }
}

interface ContextWarningEvent {
	type: 'context_warning'
	content: ContextWarningPayload
}

interface TodoSnapshotEvent {
	type: 'todo_snapshot'
	todos?: unknown
	summary?: Record<string, number>
}

interface ErrorEvent {
	type: 'error'
	content?: string
}

interface DoneEvent {
	type: 'done'
}

interface ResponseEndEvent {
	type: 'response_end'
}

interface DuelStartEvent {
	type: 'duel_start'
	pairId: string
	arms?: Array<string>
}

// Emitted only once both answers are confirmed persisted; until then neither can be resolved
// to a message id, so neither can be voted for.
interface DuelReadyEvent {
	type: 'duel_ready'
}

interface ArmMessageIdEvent {
	type: 'arm_message_id'
	messageId: string
}

interface MessageMetadataEvent {
	type: 'message_metadata'
	content: {
		inputTokens?: number
		outputTokens?: number
		executionTimeMs?: number
		x402CostUsd?: string
		completionReason?: string
	}
}

interface QueueUpdatedEvent {
	type: 'queue_updated'
	queue?: unknown
	sessionId?: string
	revision?: number
}

export type QueueWaitEndReason = 'timeout' | 'paused' | 'finished'

interface QueueWaitEndedEvent {
	type: 'queue_wait_ended'
	reason?: unknown
	queue?: unknown
	sessionId?: string
	revision?: number
}

type AgenticSSEPayload =
	| SessionEvent
	| ToolCallEvent
	| ResponseChunkEvent
	| ChartsEvent
	| GeneratedImagesEvent
	| CsvExportEvent
	| MdExportEvent
	| AlertProposedEvent
	| DashboardEvent
	| ({ type: 'spawn_progress' } & SpawnProgressData)
	| CompactionEvent
	| ({ type: 'tool_execution' } & ToolExecution)
	| TodoSnapshotEvent
	| ThinkingEvent
	| CitationsEvent
	| FactCheckStatusEvent
	| FactCheckCitationsEvent
	| TitleEvent
	| MessageIdEvent
	| UserMessageIdEvent
	| SiblingInfoEvent
	| MessageMetadataEvent
	| QueueUpdatedEvent
	| QueueWaitEndedEvent
	| TokenLimitEvent
	| ContextWarningEvent
	| ErrorEvent
	| DoneEvent
	| ResponseEndEvent
	| DuelStartEvent
	| DuelReadyEvent
	| ArmMessageIdEvent

export type AgenticSSEEvent = AgenticSSEPayload & { streamCursor?: number }

type DispatchableAgenticEvent = Exclude<
	AgenticSSEEvent,
	DuelStartEvent | DuelReadyEvent | ArmMessageIdEvent | ResponseEndEvent
>

type AgenticArmPayloadEvent = Exclude<DispatchableAgenticEvent, SessionEvent | DoneEvent>

export type AgenticArmEvent = (AgenticArmPayloadEvent | ArmMessageIdEvent | ResponseEndEvent) & { arm: 'a' | 'b' }

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeArray<T>(value: unknown, isItem: (item: unknown) => item is T): Array<T> {
	return Array.isArray(value) ? value.filter(isItem) : []
}

function isGeneratedImage(value: unknown): value is GeneratedImage {
	return (
		isRecord(value) &&
		typeof value.url === 'string' &&
		(value.id === undefined || typeof value.id === 'string') &&
		(value.size === undefined || typeof value.size === 'string') &&
		(value.prompt === undefined || typeof value.prompt === 'string') &&
		(value.revised_prompt === undefined || typeof value.revised_prompt === 'string')
	)
}

function isCsvExport(value: unknown): value is CsvExport {
	return (
		isRecord(value) &&
		typeof value.id === 'string' &&
		typeof value.title === 'string' &&
		typeof value.url === 'string' &&
		typeof value.rowCount === 'number' &&
		typeof value.filename === 'string'
	)
}

function isMdExport(value: unknown): value is MdExport {
	return (
		isRecord(value) &&
		typeof value.id === 'string' &&
		typeof value.title === 'string' &&
		typeof value.url === 'string' &&
		typeof value.filename === 'string'
	)
}

function isTodoItem(value: unknown): value is TodoItem {
	return (
		isRecord(value) &&
		typeof value.id === 'string' &&
		typeof value.content === 'string' &&
		(value.status === 'pending' ||
			value.status === 'in_progress' ||
			value.status === 'completed' ||
			value.status === 'cancelled')
	)
}

function isString(value: unknown): value is string {
	return typeof value === 'string'
}

function dashboardItemsHash(items: DashboardArtifact['items']): string {
	const normalized = items.map((item) => {
		return [item.kind, item.kind === 'llamaai-chart' ? (item.chartRef ?? item.savedChartId ?? item.id) : item.id]
	})
	const serialized = JSON.stringify(normalized)
	let hash = 0xcb_f2_9c_e4_84_22_23_25n
	for (let i = 0; i < serialized.length; i++) {
		hash ^= BigInt(serialized.charCodeAt(i))
		hash = BigInt.asUintN(64, hash * 0x1_00_00_00_01_b3n)
	}
	return hash.toString(16).padStart(16, '0')
}

interface RateLimitErrorDetails {
	period?: string
	limit?: number
	resetTime?: string | null
}

type RateLimitCode =
	| 'USAGE_LIMIT_EXCEEDED'
	| 'FREE_QUESTION_LIMIT'
	| 'FREE_FORM_LIMIT'
	| 'FREE_DAILY_LIMIT'
	| 'FACT_CHECKED_REQUIRES_SUBSCRIPTION'

class RateLimitError extends Error {
	readonly code: RateLimitCode
	readonly details?: RateLimitErrorDetails
	readonly upgradeUrl?: string

	constructor(
		message: string,
		code: RateLimitCode,
		options: { details?: RateLimitErrorDetails; upgradeUrl?: string } = {}
	) {
		super(message)
		this.code = code
		if (options.details !== undefined) this.details = options.details
		if (options.upgradeUrl !== undefined) this.upgradeUrl = options.upgradeUrl
	}
}

interface AgenticErrorResponse {
	code?: string
	content?: string
	error?: string
	message?: string
	details?: RateLimitErrorDetails
	upgradeUrl?: string
}

function parseRateLimitErrorDetails(value: unknown): RateLimitErrorDetails | undefined {
	if (typeof value !== 'object' || value === null) return undefined
	const period = 'period' in value && typeof value.period === 'string' ? value.period : undefined
	const limit = 'limit' in value && typeof value.limit === 'number' ? value.limit : undefined
	let resetTime: string | null | undefined
	if ('resetTime' in value) {
		const candidate = value.resetTime
		if (typeof candidate === 'string') resetTime = candidate
		else if (candidate === null) resetTime = null
	}
	if (period === undefined && limit === undefined && resetTime === undefined) return undefined
	return {
		...(period === undefined ? {} : { period }),
		...(limit === undefined ? {} : { limit }),
		...(resetTime === undefined ? {} : { resetTime })
	}
}

function parseAgenticErrorResponse(value: unknown): AgenticErrorResponse | null {
	if (typeof value !== 'object' || value === null) return null
	const code = 'code' in value && typeof value.code === 'string' ? value.code : undefined
	const content = 'content' in value && typeof value.content === 'string' ? value.content : undefined
	const error = 'error' in value && typeof value.error === 'string' ? value.error : undefined
	const message = 'message' in value && typeof value.message === 'string' ? value.message : undefined
	const details = 'details' in value ? parseRateLimitErrorDetails(value.details) : undefined
	const upgradeUrl = 'upgradeUrl' in value && typeof value.upgradeUrl === 'string' ? value.upgradeUrl : undefined
	return {
		...(code === undefined ? {} : { code }),
		...(content === undefined ? {} : { content }),
		...(error === undefined ? {} : { error }),
		...(message === undefined ? {} : { message }),
		...(details === undefined ? {} : { details }),
		...(upgradeUrl === undefined ? {} : { upgradeUrl })
	}
}

interface FetchAgenticResponseParams {
	mutation: AgenticMutationEnvelope
	callbacks: AgenticSSECallbacks
	abortSignal?: AbortSignal
	fetchFn: typeof fetch
	eventCounter?: { count: number }
}

async function getResponseErrorMessage(response: Response, fallback: string) {
	const contentType = response.headers.get('content-type') || ''
	const text = await response.text().catch(() => '')
	if (contentType.includes('application/json') && text) {
		try {
			const errorData = parseAgenticErrorResponse(JSON.parse(text))
			const detailedMessage = errorData?.error || errorData?.message || errorData?.content
			if (detailedMessage) return `${fallback}: ${detailedMessage}`
		} catch {}
	}
	if (text) return `${fallback}: ${text}`

	return fallback
}

export function dispatchAgenticEvent(data: DispatchableAgenticEvent, callbacks: AgenticSSECallbacks) {
	switch (data.type) {
		case 'session':
			callbacks.onSessionId(data.sessionId, data.startedAt)
			break
		case 'tool_call':
			callbacks.onProgress(data.name, data.isPremium)
			break
		case 'response_chunk': {
			const chunk = typeof data.content === 'string' ? data.content.replace(/<bill\s*\/>/g, '') : ''
			if (chunk) callbacks.onToken(chunk)
			break
		}
		case 'charts': {
			const charts = normalizeChartConfigs(data.charts)
			const chartData = normalizeChartDataByKey(data.chartData, charts)
			const artifactRefs = normalizeChartArtifactRefs(data.artifactRefs)
			if (artifactRefs) callbacks.onCharts(charts, chartData, artifactRefs)
			else callbacks.onCharts(charts, chartData)
			break
		}
		case 'generated_images':
			callbacks.onGeneratedImages?.(normalizeArray(data.images, isGeneratedImage))
			break
		case 'csv_export':
			callbacks.onCsvExport?.(normalizeArray(data.exports, isCsvExport))
			break
		case 'md_export':
			callbacks.onMdExport?.(normalizeArray(data.exports, isMdExport))
			break
		case 'alert_proposed':
			callbacks.onAlertProposed?.(normalizeAlertProposedData(data))
			break
		case 'dashboard': {
			const config = data.dashboardConfig || data.content?.dashboardConfig
			const chartData = data.chartData || data.content?.chartData
			const artifactOutcomes = data.artifactOutcomes || data.content?.artifactOutcomes
			if (config && callbacks.onDashboard) {
				// Dashboard events can arrive in both top-level and nested `content`
				// forms around PR #2790; normalize both shapes here.
				const items = migrateDashboardItems(config.items)
				const dashboardName =
					typeof config.dashboardName === 'string' && config.dashboardName.trim() ? config.dashboardName : 'Dashboard'
				const sourceDashboardId = typeof config.sourceDashboardId === 'string' ? config.sourceDashboardId : undefined
				const dashboardChartData = normalizeDashboardChartData(chartData)
				const normalizedArtifactOutcomes = normalizeDashboardArtifactOutcomes(artifactOutcomes)
				const stableId =
					data.dashboard_id ||
					data.content?.dashboard_id ||
					`dashboard_${dashboardName}_${sourceDashboardId ?? ''}_${dashboardItemsHash(items)}`
				callbacks.onDashboard({
					id: stableId,
					dashboardName,
					items,
					...(typeof config.timePeriod === 'string' && { timePeriod: config.timePeriod }),
					...(sourceDashboardId && { sourceDashboardId }),
					...(dashboardChartData && { chartData: dashboardChartData }),
					...(normalizedArtifactOutcomes && { artifactOutcomes: normalizedArtifactOutcomes })
				})
			}
			break
		}
		case 'spawn_progress':
			callbacks.onSpawnProgress(data)
			break
		case 'compaction':
			callbacks.onCompaction?.(data)
			break
		case 'tool_execution':
			callbacks.onToolExecution?.(data)
			break
		case 'todo_snapshot':
			callbacks.onTodos?.(normalizeArray(data.todos, isTodoItem))
			break
		case 'message_metadata':
			callbacks.onMessageMetadata?.(data.content)
			break
		case 'thinking':
			if (typeof data.content === 'string') callbacks.onThinking?.(data.content)
			break
		case 'citations':
			callbacks.onCitations(normalizeArray(data.citations, isString))
			break
		case 'fact_check_status':
			callbacks.onFactCheckStatus?.(data.status)
			break
		case 'queue_updated':
			{
				const snapshot = decodeQueueSnapshot({
					sessionId: data.sessionId,
					revision: data.revision,
					queue: data.queue
				})
				if (snapshot) callbacks.onQueueUpdated?.(snapshot)
			}
			break
		case 'queue_wait_ended':
			break
		case 'fact_check_citations':
			callbacks.onFactCheckCitations?.(
				data.sources || data.citations || [],
				typeof data.response === 'string' ? data.response : undefined
			)
			break
		case 'title':
			if (typeof data.content === 'string') callbacks.onTitle?.(data.content)
			break
		case 'message_id':
			callbacks.onMessageId?.(data.messageId)
			break
		case 'user_message_id':
			callbacks.onUserMessageId?.(data.messageId, data.queueItemId)
			break
		case 'sibling_info':
			callbacks.onSiblingInfo?.(data.messageId, data.siblingInfo)
			break
		case 'token_limit':
			callbacks.onTokenLimit?.()
			break
		case 'context_warning':
			if (data.content) callbacks.onContextWarning?.(data.content)
			break
		case 'error':
			callbacks.onError(data.content || 'Unknown error')
			break
		case 'done':
			callbacks.onDone()
			break
	}
}

/** @internal Exported for testing only. */
export function parseSSEStream(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	callbacks: AgenticSSECallbacks,
	abortSignal?: AbortSignal,
	eventCounter?: { count: number },
	cursorMode: AgenticCursorMode = 'server'
): Promise<{ sawDone: boolean; queueWaitEndReason?: QueueWaitEndReason }> {
	const decoder = new TextDecoder()
	let lineBuffer = ''
	let sawDone = false
	let queueWaitEndReason: QueueWaitEndReason | undefined

	const handleLine = (line: string) => {
		if (!line.startsWith('data:')) return

		try {
			const data = JSON.parse(line.slice(5).trimStart()) as AgenticSSEEvent
			const streamCursor = data.streamCursor
			delete data.streamCursor
			if (data.type === 'queue_wait_ended') {
				const snapshot = decodeQueueSnapshot({
					sessionId: data.sessionId,
					revision: data.revision,
					queue: data.queue
				})
				if (snapshot && (data.reason === 'timeout' || data.reason === 'paused' || data.reason === 'finished')) {
					queueWaitEndReason = data.reason
					callbacks.onQueueUpdated?.(snapshot)
				}
				return
			}
			if (eventCounter) {
				if (cursorMode === 'legacy') eventCounter.count += 1
				else if (streamCursor !== undefined) eventCounter.count = streamCursor
			}
			if (data.type === 'done') sawDone = true

			if (data.type === 'duel_start') {
				callbacks.onDuelStart?.(data.pairId)
				return
			}
			if (data.type === 'duel_ready') {
				callbacks.onDuelReady?.()
				return
			}
			// Arm-tagged events belong to one side of a duel; feeding them into the
			// single-answer pipeline would interleave both answers into one message.
			if ('arm' in data) {
				callbacks.onArmEvent?.(data as AgenticArmEvent)
				return
			}
			// These events are valid only when tagged with an arm.
			if (data.type === 'arm_message_id' || data.type === 'response_end') return

			dispatchAgenticEvent(data, callbacks)
		} catch (error) {
			console.debug('[llama-ai] [sse] failed to parse event:', line, error)
		}
	}

	// A stalled reader should enter the same recovery path as a dropped stream.
	const HEARTBEAT_TIMEOUT_MS = 15_000

	const process = async () => {
		try {
			while (true) {
				if (abortSignal?.aborted) break

				let timeoutId: ReturnType<typeof setTimeout> | undefined
				const { done, value } = await Promise.race([
					reader.read(),
					new Promise<never>((_, reject) => {
						timeoutId = setTimeout(() => {
							void reader
								.cancel('Stream heartbeat timeout')
								.catch(() => undefined)
								.finally(() => reject(new Error('Stream heartbeat timeout')))
						}, HEARTBEAT_TIMEOUT_MS)
					})
				]).finally(() => clearTimeout(timeoutId))
				if (done) {
					// Some backends terminate the stream without a trailing newline, so flush the final buffered event on EOF.
					if (lineBuffer.trim()) {
						handleLine(lineBuffer.trim())
					}
					break
				}

				const chunk = decoder.decode(value, { stream: true })
				lineBuffer += chunk

				const lines = lineBuffer.split('\n')

				if (lines.length > 0 && !chunk.endsWith('\n')) {
					lineBuffer = lines.pop() || ''
				} else {
					lineBuffer = ''
				}

				for (const line of lines) {
					handleLine(line)
				}
			}
			return { sawDone, ...(queueWaitEndReason ? { queueWaitEndReason } : {}) }
		} finally {
			try {
				reader.releaseLock()
			} catch {}
		}
	}

	return process()
}

export async function fetchAgenticResponse({
	mutation,
	callbacks,
	abortSignal,
	fetchFn,
	eventCounter
}: FetchAgenticResponseParams) {
	const pendingStartedAt = Date.now()
	const pendingSignal = abortSignal ?? new AbortController().signal
	let response: Response
	while (true) {
		response = await fetchFn(`${AI_SERVER}/agentic`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...mutation, stream: true, duelCapable: true }),
			...(abortSignal === undefined ? {} : { signal: abortSignal })
		})
		if (response.ok) break

		// Map backend usage-limit and concurrency responses into UI-specific error shapes.
		const errorPayload: unknown = await response.json().catch(() => null)
		const mutationReconciliation = response.status === 409 ? decodeAgenticMutationReconciliation(errorPayload) : null
		if (
			mutationReconciliation?.status === 'pending' &&
			Date.now() - pendingStartedAt < 35_000 &&
			!pendingSignal.aborted
		) {
			await waitForAbortableDelay(mutationReconciliation.retryAfterMs ?? 1000, pendingSignal)
			continue
		}
		if (mutationReconciliation) throw mutationReconciliation
		const errorData = parseAgenticErrorResponse(errorPayload)
		if (
			response.status === 403 &&
			(errorData?.code === 'FREE_QUESTION_LIMIT' ||
				errorData?.code === 'FREE_FORM_LIMIT' ||
				errorData?.code === 'FREE_DAILY_LIMIT')
		) {
			throw new RateLimitError(errorData.content || 'Upgrade required', errorData.code, {
				...(errorData.upgradeUrl === undefined ? {} : { upgradeUrl: errorData.upgradeUrl }),
				...(errorData.details === undefined ? {} : { details: errorData.details })
			})
		}
		if (response.status === 403 && errorData?.code === 'FACT_CHECKED_REQUIRES_SUBSCRIPTION') {
			throw new RateLimitError(
				errorData.content || 'Fact-checked answers require an active subscription.',
				'FACT_CHECKED_REQUIRES_SUBSCRIPTION',
				errorData.upgradeUrl === undefined ? {} : { upgradeUrl: errorData.upgradeUrl }
			)
		}
		if (response.status === 403 && errorData?.code === 'USAGE_LIMIT_EXCEEDED') {
			throw new RateLimitError(
				errorData.content || 'Usage limit exceeded',
				'USAGE_LIMIT_EXCEEDED',
				errorData.details === undefined ? {} : { details: errorData.details }
			)
		}
		if (response.status === 429) {
			throw new Error(errorData?.error || 'Too many concurrent requests. Please wait.')
		}
		throw new Error(errorData?.error || `HTTP error status: ${response.status}`)
	}

	if (!response.body) {
		throw new Error('No response body')
	}

	const { sawDone } = await parseSSEStream(
		response.body.getReader(),
		callbacks,
		abortSignal,
		eventCounter,
		cursorModeForResponse(response)
	)
	if (!sawDone && !abortSignal?.aborted) {
		// Server stream closed cleanly but never sent a `done` event — likely a
		// dropped final chunk or upstream restart. Surface it as a connectivity
		// error so the recovery cycle can probe /agentic/active and replay.
		throw new Error('Stream ended without done event')
	}
}

export async function stopAgenticExecution(
	sessionId: string,
	fetchFn: typeof fetch,
	signal?: AbortSignal
): Promise<
	{ stopped: boolean; active: true; snapshot?: never } | { stopped: boolean; active: false; snapshot: QueueSnapshot }
> {
	const response = await fetchFn(`${AI_SERVER}/agentic/stop/${encodeURIComponent(sessionId)}`, {
		method: 'POST',
		...(signal ? { signal } : {})
	})
	if (!response.ok) throw new Error(`Failed to stop execution (${response.status})`)
	const value = (await response.json()) as { stopped?: unknown; active?: unknown; snapshot?: unknown }
	if (typeof value.stopped !== 'boolean') throw new Error('Invalid stop response')
	if (value.active === true) return { stopped: value.stopped, active: true }
	if (value.active === false) {
		const snapshot = decodeQueueSnapshot(value.snapshot)
		if (snapshot) return { stopped: value.stopped, active: false, snapshot }
	}
	throw new Error('Invalid stop response')
}

// Probe whether a restored session still has a live execution that needs to be resumed client-side.
export async function checkActiveExecution(
	sessionId: string,
	fetchFn: typeof fetch,
	abortSignal: AbortSignal
): Promise<{ active: boolean; execution: AgenticExecutionSnapshot | null }> {
	try {
		const res = await fetchFn(`${AI_SERVER}/agentic/active/${encodeURIComponent(sessionId)}`, { signal: abortSignal })
		if (!res) {
			throw new Error('Failed to check active execution: no response received')
		}
		if (res.status === 404) return { active: false, execution: null }
		if (!res.ok) {
			const statusLabel = `${res.status} ${res.statusText}`.trim()
			throw new Error(await getResponseErrorMessage(res, `Failed to check active execution (${statusLabel})`))
		}
		return decodeActiveExecutionResponse(await res.json())
	} catch (error) {
		if (!abortSignal.aborted) console.error('[llama-ai] [checkActiveExecution] failed:', getErrorMessage(error))
		const status =
			typeof error === 'object' && error !== null
				? 'status' in error && typeof error.status === 'number'
					? error.status
					: 'response' in error &&
						  typeof error.response === 'object' &&
						  error.response !== null &&
						  'status' in error.response &&
						  typeof error.response.status === 'number'
						? error.response.status
						: null
				: null
		if (status === 404) return { active: false, execution: null }
		throw error
	}
}

// Reattach the client to an existing server-side execution for a restored session.
export async function resumeAgenticStream({
	sessionId,
	callbacks,
	abortSignal,
	fetchFn,
	from,
	waitMs,
	expectedMessageId,
	eventCounter
}: {
	sessionId: string
	callbacks: AgenticSSECallbacks
	abortSignal?: AbortSignal
	fetchFn: typeof fetch
	from?: number
	waitMs?: number
	expectedMessageId?: string
	eventCounter?: { count: number }
}) {
	const params = new URLSearchParams()
	if (from != null) params.set('from', String(from))
	if (waitMs != null) params.set('waitMs', String(waitMs))
	if (expectedMessageId) params.set('expectedMessageId', expectedMessageId)
	const query = params.toString()
	const url = `${AI_SERVER}/agentic/stream/${encodeURIComponent(sessionId)}${query ? `?${query}` : ''}`
	const res = await fetchFn(url, abortSignal === undefined ? {} : { signal: abortSignal })

	if (!res.ok) {
		if (res.status === 409) {
			const payload = (await res.json().catch(() => null)) as { error?: string; execution?: unknown } | null
			if (payload?.error === 'execution_changed') {
				throw new AgenticExecutionChangedError(decodeExecutionSnapshot(payload.execution))
			}
		}
		const statusLabel = `${res.status} ${res.statusText}`.trim()
		const message = await getResponseErrorMessage(res, `Failed to resume active execution (${statusLabel})`)
		const error = new Error(message) as Error & { status?: number }
		error.status = res.status
		throw error
	}

	if (!res.body) {
		throw new Error('No response body')
	}

	const { sawDone, queueWaitEndReason } = await parseSSEStream(
		res.body.getReader(),
		callbacks,
		abortSignal,
		eventCounter,
		cursorModeForResponse(res)
	)
	if (queueWaitEndReason) return queueWaitEndReason
	if (!sawDone && !abortSignal?.aborted) {
		throw new Error('Stream ended without done event')
	}
	return 'done' as const
}

export async function attachAgenticStream(
	params: Omit<Parameters<typeof resumeAgenticStream>[0], 'waitMs'> & { waitMs: number }
): Promise<'done' | QueueWaitEndReason | 'not_found'> {
	try {
		return await resumeAgenticStream(params)
	} catch (error) {
		if (error instanceof Error && (error as Error & { status?: number }).status === 404) return 'not_found'
		throw error
	}
}
