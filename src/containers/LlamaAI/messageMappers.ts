import type { ChartConfiguration, ChartDataByKey } from '~/containers/LlamaAI/chartTypes'
import type { CsvExport, MdExport } from '~/containers/LlamaAI/fetchAgenticResponse'
import type {
	DashboardArtifact,
	FactCheckReference,
	Message,
	ThinkingSegment,
	TodoItem,
	ToolExecution,
	UnifiedCitationReference
} from '~/containers/LlamaAI/types'
import { buildRestoredAlerts, type RestoredAlertMetadata } from '~/containers/LlamaAI/utils/restoredAlerts'
import type { PersistedDashboardItemConfig } from '~/containers/ProDashboard/dashboardConfig/persisted'
import type { DashboardItemConfig } from '~/containers/ProDashboard/dashboardItemConfig'
import {
	normalizeChartConfigs,
	normalizeChartArtifactRefs,
	normalizeChartDataByKey,
	normalizeDashboardArtifactOutcomes,
	normalizeDashboardChartData,
	migrateDashboardItems
} from './chartPayloads'

export interface PersistedToolExecution extends Partial<ToolExecution> {
	toolName?: string
}

export interface PersistedMessageMetadata extends RestoredAlertMetadata {
	toolExecutions?: Array<PersistedToolExecution>
	thinking?: string
	thinkingSegments?: Array<ThinkingSegment>
	quotedText?: string
	dashboardConfig?: {
		dashboardName?: string
		items?: Array<PersistedDashboardItemConfig>
		timePeriod?: string
		sourceDashboardId?: string
	}
	dashboardResult?: {
		artifactOutcomes?: unknown
		chartData?: unknown
	}
	deliveryChannel?: 'email' | 'telegram' | 'slack'
	mdExports?: Array<{ id: string; title: string; url: string; filename: string }>
	x402_cost_usd?: string
	factCheck?: {
		references?: Array<unknown>
	}
	citations?: { schemaVersion?: number; citations?: Array<unknown> }
	chartSaveContext?: { artifactRefs?: unknown }
}

export interface PersistedMessage {
	role: 'user' | 'assistant'
	content?: string
	charts?: unknown
	chartData?: unknown
	citations?: Array<string>
	csvExports?: Array<CsvExport>
	mdExports?: Array<MdExport>
	images?: Array<{
		url: string
		mimeType: string
		filename?: string
		originalFilename?: string
		textContent?: string
		size?: number
	}>
	generatedImages?: Array<{ id?: string; url: string; size?: string; prompt?: string; revised_prompt?: string }>
	metadata?: PersistedMessageMetadata
	messageMetadata?: Message['messageMetadata']
	messageId?: string
	parentId?: string
	siblingInfo?: Message['siblingInfo']
	timestamp?: string | number
	savedAlertIds?: Array<string>
}

export interface SharedSession {
	session: { sessionId: string; title: string; createdAt: string; isPublic: boolean }
	messages: Array<SharedSessionMessage>
	activeLeafMessageId?: string
	isPublicView: true
}

export interface SharedSessionMessage {
	role: 'user' | 'assistant'
	content: string
	messageId?: string
	timestamp: number
	quotedText?: string
	images?: Array<{
		url: string
		mimeType: string
		filename?: string
		originalFilename?: string
		textContent?: string
		size?: number
	}>
	generatedImages?: Array<{ id?: string; url: string; size?: string; prompt?: string; revised_prompt?: string }>
	metadata?: PersistedMessageMetadata
	charts?: unknown
	chartData?: Array<unknown> | ChartDataByKey
	citations?: Array<string>
	csvExports?: Array<CsvExport>
	mdExports?: Array<MdExport>
	savedAlertIds?: Array<string>
}

export interface SessionRestoreResult {
	messages?: Array<PersistedMessage>
	todos?: Array<TodoItem>
	activeLeafMessageId?: string
	pagination?: { hasMore?: boolean; cursor?: number | null; hasNewer?: boolean; newerCursor?: number | null }
	projectId?: string | null
	queuedMessages?: unknown
	queueRevision?: number
}

const mapPersistedTimestamp = (timestamp: PersistedMessage['timestamp']): number | undefined => {
	if (timestamp === undefined) return undefined
	const value = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime()
	return Number.isFinite(value) ? value : undefined
}

function mapToolExecution(tool: PersistedToolExecution): ToolExecution {
	return {
		...tool,
		name: tool.name || tool.toolName || 'unknown',
		executionTimeMs: typeof tool.executionTimeMs === 'number' ? tool.executionTimeMs : 0,
		success: tool.success === true
	}
}

function stableHash(value: string): string {
	let hash = 2_166_136_261
	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i)
		hash = Math.imul(hash, 16_777_619)
	}
	return (hash >>> 0).toString(36)
}

function hasChartData(chartData: ChartDataByKey): boolean {
	for (const key in chartData) {
		if (chartData[key]?.length) return true
	}
	return false
}

function getRestoredDashboardIdSuffix(message: PersistedMessage, index?: number): string {
	if (message.messageId) return message.messageId
	const dashboardConfig = message.metadata?.dashboardConfig
	return `fallback_${stableHash(
		[
			message.role,
			message.content ?? '',
			message.timestamp ?? '',
			message.parentId ?? '',
			dashboardConfig?.dashboardName ?? '',
			dashboardConfig?.sourceDashboardId ?? '',
			Array.isArray(dashboardConfig?.items) ? dashboardConfig.items.length : 0,
			index ?? ''
		].join('\u001f')
	)}`
}

function buildRestoredDashboard(message: PersistedMessage, index?: number): DashboardArtifact | null {
	const dashboardConfig = message.metadata?.dashboardConfig
	if (!dashboardConfig) return null
	const items = migrateDashboardItems(dashboardConfig.items)
	const charts = normalizeChartConfigs(message.charts)
	const chartData = normalizeChartDataByKey(message.chartData, charts)
	const artifactOutcomes = normalizeDashboardArtifactOutcomes(message.metadata?.dashboardResult?.artifactOutcomes)
	const restoredChartData = normalizeDashboardChartData(message.metadata?.dashboardResult?.chartData)

	// Historical persisted messages may not have a dashboard id, but the render
	// model still needs a stable artifact key for fallback rendering.
	const restoredDashboardIdSuffix = getRestoredDashboardIdSuffix(message, index)
	const artifact: DashboardArtifact = {
		id: `dashboard_restored_${restoredDashboardIdSuffix}`,
		dashboardName: dashboardConfig.dashboardName || 'Dashboard',
		items,
		...(dashboardConfig.timePeriod === undefined ? {} : { timePeriod: dashboardConfig.timePeriod }),
		...(dashboardConfig.sourceDashboardId === undefined
			? {}
			: { sourceDashboardId: dashboardConfig.sourceDashboardId }),
		...(restoredChartData && { chartData: restoredChartData }),
		...(artifactOutcomes && { artifactOutcomes })
	}
	const chartRefs = items.filter(
		(item): item is Extract<DashboardItemConfig, { kind: 'llamaai-chart' }> & { chartRef: string } =>
			item.kind === 'llamaai-chart' && typeof item.chartRef === 'string'
	)
	if (!restoredChartData && chartRefs.length > 0 && charts.length > 0) {
		const chartConfigMap = new Map(charts.map((chart) => [chart.id, chart]))
		const bundled: NonNullable<DashboardArtifact['chartData']> = {}
		for (const item of chartRefs) {
			const config = chartConfigMap.get(item.chartRef)
			const data = chartData[item.chartRef] || (config?.datasetName ? chartData[config.datasetName] : undefined)
			if (data && config) {
				bundled[item.chartRef] = { config, data, toolChain: [] }
			}
		}
		if (Object.keys(bundled).length > 0) artifact.chartData = bundled
	}

	return artifact
}

function normalizeLegacyFactCheckRefs(refs: unknown): Array<UnifiedCitationReference> {
	if (!Array.isArray(refs)) return []
	return refs
		.filter((r): r is FactCheckReference => !!r && typeof r === 'object')
		.map((r, i) => ({
			...r,
			id: typeof r.id === 'number' ? r.id : i + 1,
			sourceType: canonicalizeLegacyCitationSourceType(r.sourceType, r.url),
			label: r.label?.trim() ? r.label : 'Source'
		}))
		.filter((r) => r.label !== '')
}

function canonicalizeLegacyCitationSourceType(
	sourceType: string | undefined,
	url: string | undefined
): UnifiedCitationReference['sourceType'] {
	if (!sourceType) return url ? 'web' : 'data'

	if (/tweet|twitter|x_/i.test(sourceType) || sourceType.toLowerCase() === 'x') return 'x'
	if (/web|url|article|news|http/i.test(sourceType)) return 'web'
	if (/sql|warehouse|defillama|data/i.test(sourceType)) return 'data'
	if (/code|computed/i.test(sourceType)) return 'computed'

	return sourceType
}

function resolveCitationFields(
	metadata: PersistedMessageMetadata | undefined,
	urlCitations: Array<string> | undefined
) {
	const envelopeCitations =
		Array.isArray(metadata?.citations?.citations) && metadata.citations.citations.length > 0
			? (metadata.citations.citations as Array<UnifiedCitationReference>)
			: undefined
	const legacyFactCheck =
		!envelopeCitations && Array.isArray(metadata?.factCheck?.references) && metadata.factCheck.references.length > 0
			? normalizeLegacyFactCheckRefs(metadata.factCheck.references)
			: undefined
	const citations = envelopeCitations ?? (legacyFactCheck && legacyFactCheck.length > 0 ? legacyFactCheck : undefined)
	const legacyUrlCitations =
		!citations && Array.isArray(urlCitations) && urlCitations.length > 0 ? urlCitations : undefined
	return { citations, legacyUrlCitations }
}

export function mapPersistedMessage(message: PersistedMessage, index?: number): Message {
	const restoredDashboard = buildRestoredDashboard(message, index)
	const charts = normalizeChartConfigs(message.charts)
	const chartData = normalizeChartDataByKey(message.chartData, charts)
	const artifactRefs = normalizeChartArtifactRefs(message.metadata?.chartSaveContext?.artifactRefs)
	const { citations, legacyUrlCitations } = resolveCitationFields(message.metadata, message.citations)
	const chartsForMessage =
		charts.length > 0 && hasChartData(chartData)
			? [{ charts, chartData, ...(artifactRefs && { artifactRefs }) }]
			: undefined
	const alerts = buildRestoredAlerts({
		...(message.content === undefined ? {} : { content: message.content }),
		...(message.messageId === undefined ? {} : { messageId: message.messageId }),
		...(message.metadata === undefined ? {} : { metadata: message.metadata }),
		...(message.savedAlertIds === undefined ? {} : { savedAlertIds: message.savedAlertIds })
	})
	const mdExports = message.mdExports ?? message.metadata?.mdExports
	const toolExecutions = message.metadata?.toolExecutions?.map(mapToolExecution)
	const id = message.messageId ?? (index != null ? `persisted-${index}` : undefined)
	const timestamp = mapPersistedTimestamp(message.timestamp)
	const mapped: Message = { role: message.role }
	if (message.content !== undefined) mapped.content = message.content
	if (chartsForMessage !== undefined) mapped.charts = chartsForMessage
	if (citations !== undefined) mapped.citations = citations
	if (legacyUrlCitations !== undefined) mapped.legacyUrlCitations = legacyUrlCitations
	if (message.csvExports !== undefined) mapped.csvExports = message.csvExports
	if (mdExports !== undefined) mapped.mdExports = mdExports
	if (restoredDashboard) mapped.dashboards = [restoredDashboard]
	if (alerts !== undefined) mapped.alerts = alerts
	if (message.savedAlertIds !== undefined) mapped.savedAlertIds = message.savedAlertIds
	if (message.images !== undefined) mapped.images = message.images
	if (message.generatedImages !== undefined) mapped.generatedImages = message.generatedImages
	if (toolExecutions !== undefined) mapped.toolExecutions = toolExecutions
	if (message.metadata?.thinking !== undefined) mapped.thinking = message.metadata.thinking
	if (message.metadata?.thinkingSegments !== undefined) mapped.thinkingSegments = message.metadata.thinkingSegments
	if (message.metadata?.quotedText !== undefined) mapped.quotedText = message.metadata.quotedText
	if (message.messageMetadata !== undefined) mapped.messageMetadata = message.messageMetadata
	if (id !== undefined) mapped.id = id
	if (message.parentId !== undefined) mapped.parentId = message.parentId
	if (message.siblingInfo !== undefined) mapped.siblingInfo = message.siblingInfo
	if (timestamp !== undefined) mapped.timestamp = timestamp
	return mapped
}

export function mapPersistedMessages(messages: Array<PersistedMessage> | undefined): Array<Message> {
	if (!messages || messages.length === 0) return []
	return messages.map((msg, i) => mapPersistedMessage(msg, i))
}

export function normalizeSharedChartDataByChartId(
	charts: Array<ChartConfiguration> | undefined,
	chartData: SharedSessionMessage['chartData']
): ChartDataByKey | undefined {
	if (!charts || charts.length === 0 || !chartData) return undefined
	return normalizeChartDataByKey(chartData, charts)
}

export function mapSharedSessionMessage(message: SharedSessionMessage, index?: number): Message {
	const charts = normalizeChartConfigs(message.charts)
	const chartData = normalizeSharedChartDataByChartId(charts, message.chartData)
	const { citations, legacyUrlCitations } = resolveCitationFields(message.metadata, message.citations)
	const content = message.content || undefined
	const chartsForMessage =
		charts.length > 0 && chartData && hasChartData(chartData) ? [{ charts, chartData }] : undefined
	const mdExports = message.mdExports ?? message.metadata?.mdExports
	const alerts = buildRestoredAlerts({
		content: message.content,
		...(message.messageId === undefined ? {} : { messageId: message.messageId }),
		...(message.metadata === undefined ? {} : { metadata: message.metadata }),
		...(message.savedAlertIds === undefined ? {} : { savedAlertIds: message.savedAlertIds })
	})
	const toolExecutions = message.metadata?.toolExecutions?.map(mapToolExecution)
	const quotedText = message.quotedText ?? message.metadata?.quotedText
	const id = message.messageId ?? (index != null ? `shared-${index}` : undefined)
	const timestamp = mapPersistedTimestamp(message.timestamp)
	const mapped: Message = { role: message.role }
	if (content !== undefined) mapped.content = content
	if (chartsForMessage !== undefined) mapped.charts = chartsForMessage
	if (message.csvExports !== undefined) mapped.csvExports = message.csvExports
	if (mdExports !== undefined) mapped.mdExports = mdExports
	if (citations !== undefined) mapped.citations = citations
	if (legacyUrlCitations !== undefined) mapped.legacyUrlCitations = legacyUrlCitations
	if (alerts !== undefined) mapped.alerts = alerts
	if (message.savedAlertIds !== undefined) mapped.savedAlertIds = message.savedAlertIds
	if (message.images !== undefined) mapped.images = message.images
	if (message.generatedImages !== undefined) mapped.generatedImages = message.generatedImages
	if (toolExecutions !== undefined) mapped.toolExecutions = toolExecutions
	if (message.metadata?.thinking !== undefined) mapped.thinking = message.metadata.thinking
	if (message.metadata?.thinkingSegments !== undefined) mapped.thinkingSegments = message.metadata.thinkingSegments
	if (quotedText !== undefined) mapped.quotedText = quotedText
	if (id !== undefined) mapped.id = id
	if (timestamp !== undefined) mapped.timestamp = timestamp
	return mapped
}
