import type { TerminalContextPayload } from '~/containers/LlamaAI/terminal/terminalOps'
import type { AgenticAnswerMode } from '~/containers/LlamaAI/types'

// A file either rides inside the message as base64 (`data`) or was uploaded on its own request and
// is named by `workspacePath`, with its preview URL in `data`.
export interface OutgoingAttachment {
	data?: string
	workspacePath?: string
	mimeType: string
	size?: number
	filename?: string
	isPasted?: boolean
}

export interface AgenticMutationEnvelope {
	readonly blockedSkills?: ReadonlyArray<string>
	readonly clientMutationId: string
	readonly customInstructions?: string
	readonly editMessageId?: string
	readonly effort?: string
	readonly enablePremiumTools: boolean
	readonly entities?: ReadonlyArray<{ term: string; slug: string; type?: string }>
	readonly images?: ReadonlyArray<OutgoingAttachment>
	readonly isSuggestedQuestion?: true
	readonly message: string
	readonly mode?: Exclude<AgenticAnswerMode, 'quick'>
	readonly model?: string
	readonly pageContext?: { entitySlug?: string; entityType?: 'protocol' | 'chain' | 'page'; route: string }
	readonly projectId?: string
	readonly quotedText?: string
	readonly sessionId: string
	readonly shareToken?: string
	// Snapshotted when the envelope is built: the backend fingerprints the whole body, so a retry
	// that regenerated this would look like a different mutation and be rejected as a conflict.
	readonly terminalContext?: TerminalContextPayload
	readonly timezone?: string
}

export type AgenticMutationStatus = 'pending' | 'running' | 'applied'

export class AgenticMutationReconcileError extends Error {
	readonly executionId: string | undefined
	readonly messageId: string | undefined
	readonly retryAfterMs: number | undefined
	readonly sessionId: string
	readonly status: AgenticMutationStatus

	constructor(args: {
		executionId?: string
		messageId?: string
		retryAfterMs?: number
		sessionId: string
		status: AgenticMutationStatus
	}) {
		super(`The prompt is already ${args.status}.`)
		this.name = 'AgenticMutationReconcileError'
		this.executionId = args.executionId
		this.messageId = args.messageId
		this.retryAfterMs = args.retryAfterMs
		this.sessionId = args.sessionId
		this.status = args.status
	}
}

export function createAgenticMutationEnvelope(args: {
	blockedSkills?: Array<string>
	clientMutationId: string
	customInstructions?: string
	editMessageId?: string
	effort?: string
	enablePremiumTools: boolean
	entities?: Array<{ term: string; slug: string; type?: string }>
	images?: Array<OutgoingAttachment>
	isSuggestedQuestion?: boolean
	message: string
	mode: AgenticAnswerMode
	model?: string
	pageContext?: { entitySlug?: string; entityType?: 'protocol' | 'chain' | 'page'; route: string }
	projectId?: string | null
	quotedText?: string
	sessionId: string
	shareToken?: string
	terminalContext?: TerminalContextPayload
}): AgenticMutationEnvelope {
	let timezone: string | undefined
	try {
		timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
	} catch {
		// Intl can be unavailable; the timezone stays unset.
	}

	return {
		clientMutationId: args.clientMutationId,
		enablePremiumTools: args.enablePremiumTools,
		message: args.message,
		sessionId: args.sessionId,
		...(args.mode === 'quick' ? {} : { mode: args.mode }),
		...(args.entities?.length ? { entities: args.entities.map((entity) => ({ ...entity })) } : {}),
		...(args.images?.length ? { images: args.images.map((image) => ({ ...image })) } : {}),
		...(args.pageContext ? { pageContext: { ...args.pageContext } } : {}),
		...(args.customInstructions ? { customInstructions: args.customInstructions } : {}),
		...(args.quotedText ? { quotedText: args.quotedText } : {}),
		...(args.isSuggestedQuestion ? { isSuggestedQuestion: true as const } : {}),
		...(args.blockedSkills?.length ? { blockedSkills: [...args.blockedSkills] } : {}),
		...(args.model ? { model: args.model } : {}),
		...(args.effort ? { effort: args.effort } : {}),
		...(args.shareToken ? { shareToken: args.shareToken } : {}),
		...(args.projectId ? { projectId: args.projectId } : {}),
		...(args.editMessageId ? { editMessageId: args.editMessageId } : {}),
		...(args.terminalContext ? { terminalContext: args.terminalContext } : {}),
		...(timezone ? { timezone } : {})
	}
}

export function decodeAgenticMutationReconciliation(value: unknown): AgenticMutationReconcileError | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null
	const response = value as {
		code?: unknown
		executionId?: unknown
		messageId?: unknown
		retryAfterMs?: unknown
		sessionId?: unknown
		status?: unknown
	}
	const status = response.code === 'MUTATION_ALREADY_APPLIED' ? 'applied' : response.status
	if (
		(response.code !== 'MUTATION_RECONCILE' && response.code !== 'MUTATION_ALREADY_APPLIED') ||
		(status !== 'pending' && status !== 'running' && status !== 'applied') ||
		typeof response.sessionId !== 'string' ||
		response.sessionId.length === 0 ||
		(response.executionId !== undefined && typeof response.executionId !== 'string') ||
		(response.messageId !== undefined && typeof response.messageId !== 'string') ||
		(response.retryAfterMs !== undefined &&
			(typeof response.retryAfterMs !== 'number' ||
				!Number.isFinite(response.retryAfterMs) ||
				response.retryAfterMs < 0 ||
				response.retryAfterMs > 5000))
	) {
		return null
	}
	return new AgenticMutationReconcileError({
		status,
		sessionId: response.sessionId,
		...(typeof response.executionId === 'string' ? { executionId: response.executionId } : {}),
		...(typeof response.messageId === 'string' ? { messageId: response.messageId } : {}),
		...(typeof response.retryAfterMs === 'number' ? { retryAfterMs: response.retryAfterMs } : {})
	})
}
