export type QueueNotSentReason =
	| 'execution_stopped'
	| 'execution_failed'
	| 'epoch_changed'
	| 'quota_exceeded'
	| 'server_restarted'
	| 'expired'
	| 'edit_expired'

interface QueueItemBase {
	id: string
	clientMutationId?: string
	message: string
	displayMessage?: string
	entities?: Array<{ term: string; slug: string; type?: string }>
	images?: Array<{ id: string; url: string; mimeType?: string; filename?: string }>
	researchMode: boolean
	factCheckMode?: boolean
	quotedText?: string
	pageContext?: { entitySlug?: string; entityType?: string; route: string }
	timezone?: string
	client: 'web' | 'mobile'
	projectId?: string
	customInstructions?: string
	blockedSkills?: Array<string>
	queuedAt: string
}

export type QueuedMessageElement =
	| (QueueItemBase & { state: 'pending' })
	| (QueueItemBase & { state: 'firing' })
	| (QueueItemBase & { state: 'editing'; editLeaseId: string; editExpiresAt: string })
	| (QueueItemBase & { state: 'not_sent'; reason: QueueNotSentReason })

export interface QueueSnapshot {
	sessionId: string
	revision: number
	queue: Array<QueuedMessageElement>
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const NOT_SENT_REASONS = new Set<QueueNotSentReason>([
	'execution_stopped',
	'execution_failed',
	'epoch_changed',
	'quota_exceeded',
	'server_restarted',
	'expired',
	'edit_expired'
])

function isOptionalString(value: unknown) {
	return value === undefined || typeof value === 'string'
}

function isOptionalBoolean(value: unknown) {
	return value === undefined || typeof value === 'boolean'
}

function hasValidOptionalPayload(value: Record<string, unknown>) {
	return (
		isOptionalString(value.clientMutationId) &&
		isOptionalString(value.displayMessage) &&
		isOptionalBoolean(value.factCheckMode) &&
		isOptionalString(value.quotedText) &&
		isOptionalString(value.timezone) &&
		isOptionalString(value.projectId) &&
		isOptionalString(value.customInstructions) &&
		(value.blockedSkills === undefined ||
			(Array.isArray(value.blockedSkills) && value.blockedSkills.every((skill) => typeof skill === 'string'))) &&
		(value.entities === undefined ||
			(Array.isArray(value.entities) &&
				value.entities.every(
					(entity) =>
						isRecord(entity) &&
						typeof entity.term === 'string' &&
						typeof entity.slug === 'string' &&
						isOptionalString(entity.type)
				))) &&
		(value.images === undefined ||
			(Array.isArray(value.images) &&
				value.images.every(
					(image) =>
						isRecord(image) &&
						typeof image.id === 'string' &&
						typeof image.url === 'string' &&
						isOptionalString(image.mimeType) &&
						isOptionalString(image.filename)
				))) &&
		(value.pageContext === undefined ||
			(isRecord(value.pageContext) &&
				typeof value.pageContext.route === 'string' &&
				isOptionalString(value.pageContext.entitySlug) &&
				isOptionalString(value.pageContext.entityType)))
	)
}

export function isQueuedMessageElement(value: unknown): value is QueuedMessageElement {
	if (
		!isRecord(value) ||
		typeof value.id !== 'string' ||
		typeof value.message !== 'string' ||
		typeof value.researchMode !== 'boolean' ||
		(value.client !== 'web' && value.client !== 'mobile') ||
		typeof value.queuedAt !== 'string' ||
		!hasValidOptionalPayload(value)
	) {
		return false
	}
	if (value.state === 'pending' || value.state === 'firing') {
		return value.reason === undefined && value.editLeaseId === undefined && value.editExpiresAt === undefined
	}
	if (value.state === 'editing') {
		return (
			typeof value.editLeaseId === 'string' && typeof value.editExpiresAt === 'string' && value.reason === undefined
		)
	}
	return (
		value.state === 'not_sent' &&
		typeof value.reason === 'string' &&
		NOT_SENT_REASONS.has(value.reason as QueueNotSentReason) &&
		value.editLeaseId === undefined &&
		value.editExpiresAt === undefined
	)
}

export function decodeQueueSnapshot(value: unknown): QueueSnapshot | null {
	if (!isRecord(value) || typeof value.sessionId !== 'string' || typeof value.revision !== 'number') return null
	if (!Array.isArray(value.queue) || !value.queue.every(isQueuedMessageElement)) return null
	return { sessionId: value.sessionId, revision: value.revision, queue: value.queue }
}
