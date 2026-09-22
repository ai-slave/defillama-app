import type { PriceTrigger } from '~/containers/LlamaAI/components/alerts/types'
import type { TerminalOpsPayload } from '~/containers/LlamaAI/terminal/terminalOps'
import type { DashboardItemConfig } from '~/containers/ProDashboard/dashboardItemConfig'
import type { ChartConfiguration, ChartDataByKey, ChartDataSeries } from './chartTypes'

export interface CsvExport {
	id: string
	title: string
	url: string
	rowCount: number
	filename: string
}

export interface ChatSession {
	sessionId: string
	title: string
	titleIsPlaceholder?: boolean
	createdAt: string
	lastActivity: string
	isActive: boolean
	isPublic?: boolean
	shareToken?: string
	isPinned?: boolean
	pinnedAt?: string
	forkedFromShareToken?: string | null
	isOptimistic?: boolean
	projectId?: string | null
	hasUnseenCompletion?: boolean
	// Set when the session drew on a terminal chart; the symbol of its most recent chart turn.
	terminalSymbol?: string | null
}

export interface ResearchUsage {
	remainingUsage: number
	limit: number
	period: 'lifetime' | 'daily' | 'biweekly' | 'unlimited' | 'blocked'
	resetTime: string | null
}

export interface AlertProposedData {
	alertId: string
	title: string
	prompt?: string
	alertIntent: {
		frequency?: 'daily' | 'weekly'
		hour?: number
		timezone?: string
		dayOfWeek?: number
		deliveryChannel?: 'email' | 'telegram' | 'slack'
		slackTeamId?: string | null
		slackTeamName?: string | null
		slackChannelId?: string | null
		slackChannelName?: string | null
		trigger?: PriceTrigger
	}
	schedule_expression: string
	next_run_at: string
}

export interface ChartArtifactRef {
	artifactId: string
	versionId: string | null
	status: 'live' | 'snapshot-only' | 'needs-repair'
	containsPremium: boolean
	estimatedMaxCostUsd: number
}
export type ChartArtifactRefs = Record<string, ChartArtifactRef>
export type DashboardChartData = Record<
	string,
	{ config: ChartConfiguration; data: ChartDataSeries; toolChain: Array<unknown> }
>

export interface DashboardArtifact {
	id: string
	dashboardName: string
	items: Array<DashboardItemConfig>
	timePeriod?: string
	sourceDashboardId?: string
	chartData?: DashboardChartData
	artifactOutcomes?: Array<DashboardArtifactOutcome>
}

export interface DashboardArtifactOutcome {
	itemId: string
	chartRef: string
	artifactId: string | null
	versionId: string | null
	status: 'live' | 'snapshot-only' | 'needs-repair'
	reasonCode?: string
	containsPremium: boolean
	estimatedMaxCostUsd: number
}

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | Array<JsonValue>

export interface JsonObject {
	[key: string]: JsonValue
}

export interface ToolExecution {
	name: string
	/** Matches the `tool_call` event that started this call, when the backend sent one. */
	tool_call_id?: string
	executionTimeMs: number
	success: boolean
	error?: string
	resultPreview?: Array<JsonObject>
	resultCount?: number
	resultId?: string
	sqlQuery?: string
	toolData?: JsonObject
	isPremium?: boolean
	costUsd?: string
}

export interface AlertIntent {
	detected: boolean
	frequency?: 'daily' | 'weekly'
	hour?: number
	timezone?: string
	dayOfWeek?: number
	deliveryChannel?: 'email' | 'telegram' | 'slack'
	slackTeamId?: string | null
	slackTeamName?: string | null
	slackChannelId?: string | null
	slackChannelName?: string | null
	trigger?: PriceTrigger
	toolExecutions: Array<{
		toolName: string
		arguments: JsonObject
		sqlQuery: string | null
	}>
}

export interface SuggestedQuestionsResponse {
	categories: {
		find_alpha: Array<string>
		analytics: Array<string>
		speculative_guidance: Array<string>
		learn: Array<string>
		research_report: Array<string>
	}
	metadata: {
		generatedAt: string
		cacheExpiresAt: string
		totalQuestions: number
	}
}

export interface LandingQuestion {
	text: string
	tag: string
}

export interface LandingQuestionsResponse {
	questions: Array<LandingQuestion>
	metadata?: {
		generatedAt: string
		cacheExpiresAt: string
		totalQuestions: number
	}
}

export interface EntityQuestionsResponse {
	questions: Array<string>
	suggestGlobal: boolean
	entityNotFound?: boolean
	metadata?: {
		entitySlug: string
		entityType: 'protocol' | 'chain' | 'page'
		generatedAt: string
	}
}

export interface ChartItem {
	type: 'chart'
	id: string
	chart: ChartConfiguration
	chartData: ChartDataSeries | ChartDataByKey
}

export interface CsvItem {
	type: 'csv'
	id: string
	title: string
	url: string
	rowCount: number
	filename: string
}

export interface MessageMetadata {
	timestamp?: number
	inputTokens?: number
	outputTokens?: number
	executionTimeMs?: number
	x402CostUsd?: string
	completionReason?: string
}

export interface FreeLimitOffer {
	code: 'FREE_QUESTION_LIMIT' | 'FREE_FORM_LIMIT' | 'FREE_DAILY_LIMIT'
	resetTime?: string | null
}

export interface Message {
	role: 'user' | 'assistant'
	content?: string
	charts?: Array<{ charts: Array<ChartConfiguration>; chartData: ChartDataByKey; artifactRefs?: ChartArtifactRefs }>
	csvExports?: Array<CsvExport>
	mdExports?: Array<{ id: string; title: string; url: string; filename: string }>
	citations?: Array<UnifiedCitationReference>
	legacyUrlCitations?: Array<string>
	alerts?: Array<AlertProposedData>
	savedAlertIds?: Array<string>
	dashboards?: Array<DashboardArtifact>
	images?: Array<{
		url: string
		mimeType: string
		filename?: string
		originalFilename?: string
		textContent?: string
		size?: number
	}>
	generatedImages?: Array<GeneratedImage>
	id?: string
	parentId?: string
	siblingInfo?: {
		currentVersion: number
		totalVersions: number
		siblings: Array<{ messageId: string; leafMessageId: string }>
	}
	timestamp?: number
	toolExecutions?: Array<ToolExecution>
	/**
	 * Restored messages carry reasoning as one string plus segments keyed by how many tool executions
	 * preceded each one; live and committed ones carry ordered steps.
	 */
	thinking?: string
	thinkingSegments?: Array<ThinkingSegment>
	steps?: Array<AgentStep>
	terminalOps?: TerminalOpsPayload
	quotedText?: string
	messageMetadata?: MessageMetadata
	freeLimitOffer?: FreeLimitOffer
}

export interface ChartSet {
	charts: Array<ChartConfiguration>
	chartData: ChartDataByKey
	artifactRefs?: ChartArtifactRefs
}

export interface GeneratedImage {
	id?: string
	url: string
	size?: string
	prompt?: string
	revised_prompt?: string
}

/** A tool call as the backend announces it, before its result arrives. */
export interface ToolCall {
	name: string
	params: JsonObject | null
	toolCallId: string | null
	isPremium?: boolean
}

/**
 * One row of what the agent did, in the order it happened: a stretch of reasoning, or a tool call
 * that moves from running to done or error in place when its result lands.
 */
export interface ThinkingSegment {
	text: string
	toolIndex: number
}

export type AgentStep =
	| { kind: 'reasoning'; id: string; text: string }
	| {
			kind: 'tool'
			id: string
			toolCallId: string | null
			name: string
			label: string
			params: JsonObject | null
			isPremium?: boolean
			status: 'running' | 'done' | 'error'
			execution?: ToolExecution
	  }

export interface SpawnAgentStatus {
	id: string
	status: 'started' | 'thinking' | 'tool_call' | 'completed' | 'error'
	tool?: string
	toolCount?: number
	chartCount?: number
	findingsPreview?: string
}

export interface TodoItem {
	id: string
	content: string
	status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
}

export interface SearchMatch {
	message_id: string | null
	source_type: 'session_title' | 'user_message' | 'assistant_chunk'
	content_preview: string
	score: number
}

export interface SearchResult {
	session_id: string
	session_title: string | null
	last_activity: string | null
	matches: Array<SearchMatch>
}

export type AgenticAnswerMode = 'quick' | 'fact_checked' | 'research'

export interface FactCheckReference {
	id?: number
	label: string
	url?: string
	detail?: string
	checked?: string
	asOf?: string
	evidence?: Array<string>
	sourceType?: string
}

export interface UnifiedCitationReference {
	id: number
	handle?: string
	sourceType: 'data' | 'computed' | 'web' | 'x' | 'tool' | 'file' | (string & {})
	label: string
	value?: string
	formula?: string
	asOf?: string
	resultId?: string
	sql?: Array<string>
	code?: Array<string>
	rows?: Array<Record<string, unknown>>
	rowCount?: number
	columns?: Array<string>
	field?: string
	rowIndex?: number
	url?: string
	toolName?: string
	toolArgs?: Record<string, unknown>
	resultText?: string
	outputs?: Array<{ key: string; value: string }>
	fileName?: string
	fileUrl?: string
	locator?: string
	excerpt?: string
	sources?: Array<UnifiedCitationReference>
	verification?: {
		claimType: 'quantitative' | 'qualitative'
		grounded: boolean
		valueMatch?: 'match' | 'mismatch' | 'unverified'
		delta?: number
	}
	detail?: string
	checked?: string
	evidence?: Array<string>
	rows_omitted?: boolean
}

export interface FactCheckedUsage {
	allowed: boolean
	currentUsage: number
	limit: number
	period: 'daily' | 'lifetime' | 'unlimited' | 'blocked' | 'biweekly'
	remaining: number
	remainingUsage: number
	resetTime?: string
	message?: string
}
