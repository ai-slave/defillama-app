export interface AgenticExecutionSnapshot {
	cursor: number
	hasResult: boolean
	messageId: string
	queueItemId?: string
	startedAt: number
	status: 'running' | 'completed' | 'error'
}

type ExecutionFields = {
	cursor?: unknown
	eventCount?: unknown
	hasResult?: unknown
	messageId?: unknown
	queueItemId?: unknown
	startedAt?: unknown
	status?: unknown
}

export function decodeExecutionSnapshot(value: unknown): AgenticExecutionSnapshot | null {
	if (value === null || value === undefined) return null
	if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid execution snapshot')

	const fields = value as ExecutionFields
	const cursor = fields.cursor ?? fields.eventCount
	const queueItemId = fields.queueItemId
	if (
		typeof cursor !== 'number' ||
		!Number.isInteger(cursor) ||
		cursor < 0 ||
		typeof fields.hasResult !== 'boolean' ||
		typeof fields.messageId !== 'string' ||
		fields.messageId.length === 0 ||
		(queueItemId !== undefined && (typeof queueItemId !== 'string' || queueItemId.length === 0)) ||
		typeof fields.startedAt !== 'number' ||
		!Number.isFinite(fields.startedAt) ||
		fields.startedAt <= 0 ||
		(fields.status !== 'running' && fields.status !== 'completed' && fields.status !== 'error')
	) {
		throw new Error('Invalid execution snapshot')
	}
	const normalizedQueueItemId = typeof queueItemId === 'string' ? queueItemId : undefined

	return {
		cursor,
		hasResult: fields.hasResult,
		messageId: fields.messageId,
		...(normalizedQueueItemId ? { queueItemId: normalizedQueueItemId } : {}),
		startedAt: fields.startedAt,
		status: fields.status
	}
}

export function decodeActiveExecutionResponse(value: unknown): {
	active: boolean
	execution: AgenticExecutionSnapshot | null
} {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Invalid active execution response')
	}
	const response = value as { active?: unknown; execution?: unknown } & ExecutionFields
	if (typeof response.active !== 'boolean') throw new Error('Invalid active execution response')

	const execution = decodeExecutionSnapshot(
		response.execution ??
			(response.messageId === undefined
				? null
				: {
						eventCount: response.eventCount,
						hasResult: response.hasResult,
						messageId: response.messageId,
						queueItemId: response.queueItemId,
						startedAt: response.startedAt,
						status: response.status
					})
	)
	if (response.active !== (execution?.status === 'running')) {
		throw new Error('Invalid active execution response')
	}
	return { active: response.active, execution }
}
