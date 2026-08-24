import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react'
import {
	beginQueuedMessageEdit,
	cancelAllQueuedMessages,
	cancelQueuedMessage,
	cancelQueuedMessageEdit,
	continueQueuedMessages,
	queueMessage,
	renewQueuedMessageEdit,
	retryQueuedMessage,
	saveQueuedMessageEdit,
	type QueueMessagePayload,
	type QueueSnapshot,
	type QueuedMessageElement
} from '~/containers/LlamaAI/api'
import type { AuthorizedFetch } from '~/containers/LlamaAI/api/transport'
import { LlamaAITransportError } from '~/containers/LlamaAI/api/transport'
import { decodeQueueSnapshot } from '~/containers/LlamaAI/queue/protocol'

export type QueueAction =
	| 'opening_edit'
	| 'saving_edit'
	| 'canceling_edit'
	| 'dismissing'
	| 'retrying'
	| 'continuing'
	| 'clearing'

type QueueWideAction = 'continuing' | 'clearing'

export interface QueueActionError {
	action: QueueWideAction
	message: string
}

export type QueueServerRow = QueuedMessageElement & { kind: 'server' }

export interface QueueLocalRow {
	kind: 'local'
	id: string
	state: 'adding' | 'waiting' | 'failed'
	error?: string
	payload: QueueMessagePayload
}

export type QueueRow = QueueServerRow | QueueLocalRow

const EMPTY_LOCAL_ROWS: QueueLocalRow[] = []

export interface QueueRowStatus {
	action: QueueAction | null
	error: string | null
	unsavedDraft?: string
}

export interface QueueSurface {
	rows: QueueRow[]
	ownedEditId: string | null
	rowStatus: Record<string, QueueRowStatus>
	onEditStart: (id: string) => void
	onEditDraftChange: (id: string, message: string) => void
	onEditSave: (id: string, message: string) => void
	onEditCancel: (id: string) => void
	onDismiss: (id: string) => void
	onRetry: (id: string) => void
	onContinue: () => void
	onClear: () => void
	queueAction: QueueWideAction | null
	queueActionError: QueueActionError | null
}

interface QueueControllerState {
	sessionId: string | null
	queue: QueuedMessageElement[]
	localBySession: Record<string, QueueLocalRow[]>
	maxDepth: number | null
	ownedEditId: string | null
	rowStatus: Record<string, QueueRowStatus>
	queueAction: QueueWideAction | null
	queueActionError: QueueActionError | null
}

interface RememberedEdit {
	id: string
	leaseId: string
	draft: string
}

type QueueControllerEvent =
	| { type: 'reset'; sessionId: string | null }
	| { type: 'snapshot'; snapshot: QueueSnapshot; rememberedEdit?: RememberedEdit }
	| { type: 'local_add'; sessionId: string; row: QueueLocalRow }
	| { type: 'local_state'; sessionId: string; id: string; state: QueueLocalRow['state']; error?: string }
	| { type: 'local_remove'; sessionId: string; id: string }
	| { type: 'local_clear'; sessionId: string }
	| { type: 'local_adopt_session'; previousSessionId: string; nextSessionId: string }
	| { type: 'max_depth'; value: number }
	| { type: 'action'; id: string; action: QueueAction }
	| { type: 'action_done'; id: string }
	| { type: 'action_failed'; id: string; error: string; unsavedDraft?: string }
	| { type: 'own_edit'; id: string }
	| { type: 'queue_action'; action: QueueWideAction }
	| { type: 'queue_action_done' }
	| { type: 'queue_action_failed'; action: QueueWideAction; message: string }

function initialState(sessionId: string | null): QueueControllerState {
	return {
		sessionId,
		queue: [],
		localBySession: {},
		maxDepth: null,
		ownedEditId: null,
		rowStatus: {},
		queueAction: null,
		queueActionError: null
	}
}

function queueControllerReducer(state: QueueControllerState, event: QueueControllerEvent): QueueControllerState {
	switch (event.type) {
		case 'reset':
			return {
				...initialState(event.sessionId),
				localBySession: state.localBySession
			}
		case 'snapshot': {
			if (event.snapshot.sessionId !== state.sessionId) return state
			const confirmedMutationIds = new Set(
				event.snapshot.queue.flatMap((item) => (item.clientMutationId ? [item.clientMutationId] : []))
			)
			const local = (state.localBySession[event.snapshot.sessionId] ?? []).filter(
				(item) => !confirmedMutationIds.has(item.payload.clientMutationId)
			)
			const rememberedItem = event.rememberedEdit
				? event.snapshot.queue.find((item) => item.id === event.rememberedEdit?.id)
				: undefined
			const ownsRememberedEdit =
				rememberedItem?.state === 'editing' && rememberedItem.editLeaseId === event.rememberedEdit?.leaseId
			const ownedEdit = event.rememberedEdit
				? ownsRememberedEdit
					? rememberedItem
					: undefined
				: event.snapshot.queue.find((item) => item.id === state.ownedEditId)
			const ids = new Set(event.snapshot.queue.map((item) => item.id))
			const rowStatus: Record<string, QueueRowStatus> = {}
			for (const id in state.rowStatus) {
				const status = state.rowStatus[id]
				if (ids.has(id) && status) rowStatus[id] = status
			}
			if (event.rememberedEdit && ownsRememberedEdit) {
				rowStatus[event.rememberedEdit.id] = {
					action: null,
					error: null,
					...(event.rememberedEdit.draft !== rememberedItem.message ? { unsavedDraft: event.rememberedEdit.draft } : {})
				}
			} else if (
				event.rememberedEdit &&
				(rememberedItem?.state === 'editing' ||
					(rememberedItem?.state === 'not_sent' && rememberedItem.reason === 'edit_expired'))
			) {
				rowStatus[event.rememberedEdit.id] = {
					action: null,
					error: 'This edit is no longer reserved. Copy your changes and try again.',
					unsavedDraft: event.rememberedEdit.draft
				}
			}
			return {
				...state,
				queue: event.snapshot.queue,
				localBySession: { ...state.localBySession, [event.snapshot.sessionId]: local },
				ownedEditId: ownedEdit?.state === 'editing' ? ownedEdit.id : null,
				rowStatus
			}
		}
		case 'local_add':
			return {
				...state,
				localBySession: {
					...state.localBySession,
					[event.sessionId]: [...(state.localBySession[event.sessionId] ?? []), event.row]
				}
			}
		case 'local_state': {
			const local = state.localBySession[event.sessionId] ?? []
			const current = local.find((item) => item.id === event.id)
			if (!current || (current.state === event.state && current.error === event.error)) return state
			return {
				...state,
				localBySession: {
					...state.localBySession,
					[event.sessionId]: local.map((item) => {
						if (item.id !== event.id) return item
						const next = { ...item, state: event.state }
						if (event.error === undefined) delete next.error
						else next.error = event.error
						return next
					})
				}
			}
		}
		case 'local_remove':
			return {
				...state,
				localBySession: {
					...state.localBySession,
					[event.sessionId]: (state.localBySession[event.sessionId] ?? []).filter((item) => item.id !== event.id)
				}
			}
		case 'local_clear':
			return { ...state, localBySession: { ...state.localBySession, [event.sessionId]: [] } }
		case 'local_adopt_session': {
			if (event.previousSessionId === event.nextSessionId) return state
			const previousRows = state.localBySession[event.previousSessionId] ?? []
			if (previousRows.length === 0) return state
			const nextRows = state.localBySession[event.nextSessionId] ?? []
			const nextMutationIds = new Set(nextRows.map((row) => row.payload.clientMutationId))
			return {
				...state,
				localBySession: {
					...state.localBySession,
					[event.previousSessionId]: [],
					[event.nextSessionId]: [
						...previousRows.filter((row) => !nextMutationIds.has(row.payload.clientMutationId)),
						...nextRows
					]
				}
			}
		}
		case 'max_depth':
			return { ...state, maxDepth: event.value }
		case 'action':
			return {
				...state,
				rowStatus: { ...state.rowStatus, [event.id]: { action: event.action, error: null } }
			}
		case 'action_done': {
			const { [event.id]: _removed, ...rowStatus } = state.rowStatus
			return { ...state, rowStatus }
		}
		case 'action_failed':
			if (!state.queue.some((item) => item.id === event.id)) return state
			return {
				...state,
				rowStatus: {
					...state.rowStatus,
					[event.id]: {
						action: null,
						error: event.error,
						...(event.unsavedDraft !== undefined ? { unsavedDraft: event.unsavedDraft } : {})
					}
				}
			}
		case 'own_edit':
			return { ...state, ownedEditId: event.id }
		case 'queue_action':
			return { ...state, queueAction: event.action, queueActionError: null }
		case 'queue_action_done':
			return { ...state, queueAction: null, queueActionError: null }
		case 'queue_action_failed':
			return {
				...state,
				queueAction: null,
				queueActionError: { action: event.action, message: event.message }
			}
	}
}

function errorCode(error: unknown): string | null {
	if (!(error instanceof LlamaAITransportError)) return null
	return (error.body as { error?: string } | null)?.error ?? null
}

function snapshotFromError(error: unknown): QueueSnapshot | null {
	if (!(error instanceof LlamaAITransportError)) return null
	return decodeQueueSnapshot((error.body as { snapshot?: unknown } | null)?.snapshot)
}

const PAUSED_QUEUE_REASONS = new Set(['execution_stopped', 'execution_failed', 'quota_exceeded', 'server_restarted'])

function isServerQueuePaused(queue: QueuedMessageElement[]): boolean {
	return queue.some((item) => item.state === 'not_sent' && PAUSED_QUEUE_REASONS.has(item.reason))
}

function actionError(action: QueueAction, error: unknown): string {
	const code = errorCode(error)
	if (action === 'opening_edit') {
		if (code === 'firing') return 'This message already started.'
		if (code === 'already_editing') return 'This message is already being edited.'
		return 'Could not open the editor. Try again.'
	}
	if (action === 'saving_edit') {
		if (code === 'lease_mismatch' || code === 'lease_expired' || code === 'already_editing') {
			return 'This edit is no longer reserved. Copy your changes and try again.'
		}
		return 'Could not save your edit. Try again.'
	}
	if (action === 'canceling_edit') return 'Could not cancel the edit. Try again.'
	if (action === 'dismissing') return 'Could not remove this message. Try again.'
	if (code === 'queue_full') return 'Queue is full. Wait for a message to send first.'
	return 'Could not retry this message. Try again.'
}

export function useChatQueueController({
	sessionId,
	enabled,
	admissionPaused,
	authorizedFetch
}: {
	sessionId: string | null
	enabled: boolean
	admissionPaused: boolean
	authorizedFetch: AuthorizedFetch
}) {
	const [state, dispatch] = useReducer(queueControllerReducer, sessionId, initialState)
	const stateRef = useRef(state)
	stateRef.current = state
	const send = useCallback((event: QueueControllerEvent) => {
		stateRef.current = queueControllerReducer(stateRef.current, event)
		dispatch(event)
	}, [])
	const activeSessionIdRef = useRef(sessionId)
	activeSessionIdRef.current = sessionId
	const enabledRef = useRef(enabled)
	enabledRef.current = enabled
	const admissionPausedRef = useRef(admissionPaused)
	admissionPausedRef.current = admissionPaused
	const controllersRef = useRef(new Set<AbortController>())
	const outboxDrainsRef = useRef(new Set<string>())
	const drainOutboxRef = useRef<(sessionId: string) => void>(() => {})
	const queuedRowsRef = useRef<{ sessionId: string; rows: Map<string, QueuedMessageElement> } | null>(null)
	const rememberedEditsRef = useRef(new Map<string, RememberedEdit>())
	const pendingSnapshotRef = useRef<QueueSnapshot | null>(null)
	const snapshotCursorRef = useRef({ sessionId, revision: -1 })
	const latestSnapshotRef = useRef<QueueSnapshot | null>(null)
	const renewalTimerRef = useRef<number | null>(null)
	const renewalControllerRef = useRef<AbortController | null>(null)
	const abortCommands = useCallback(() => {
		for (const controller of controllersRef.current) controller.abort()
		controllersRef.current.clear()
		if (renewalTimerRef.current !== null) window.clearInterval(renewalTimerRef.current)
		renewalTimerRef.current = null
		renewalControllerRef.current?.abort()
		renewalControllerRef.current = null
	}, [])
	const snapshotEvent = useCallback((snapshot: QueueSnapshot): QueueControllerEvent => {
		const rememberedEdit = rememberedEditsRef.current.get(snapshot.sessionId)
		if (!rememberedEdit) return { type: 'snapshot', snapshot }
		const item = snapshot.queue.find((candidate) => candidate.id === rememberedEdit.id)
		if (item?.state !== 'editing' && !(item?.state === 'not_sent' && item.reason === 'edit_expired')) {
			rememberedEditsRef.current.delete(snapshot.sessionId)
			return { type: 'snapshot', snapshot }
		}
		return { type: 'snapshot', snapshot, rememberedEdit }
	}, [])

	useLayoutEffect(() => {
		if (stateRef.current.sessionId !== sessionId) send({ type: 'reset', sessionId })
		snapshotCursorRef.current = { sessionId, revision: -1 }
		latestSnapshotRef.current = null
		queuedRowsRef.current = sessionId ? { sessionId, rows: new Map() } : null
		if (pendingSnapshotRef.current?.sessionId === sessionId) {
			snapshotCursorRef.current.revision = pendingSnapshotRef.current.revision
			latestSnapshotRef.current = pendingSnapshotRef.current
			send(snapshotEvent(pendingSnapshotRef.current))
			pendingSnapshotRef.current = null
		}
		return () => {
			abortCommands()
		}
	}, [abortCommands, send, sessionId, snapshotEvent])

	useLayoutEffect(() => {
		if (!enabled) abortCommands()
	}, [abortCommands, enabled])

	const applySnapshot = useCallback(
		(snapshot: QueueSnapshot) => {
			if (!enabledRef.current) return false
			if (snapshot.sessionId !== activeSessionIdRef.current) return false
			const cursor = snapshotCursorRef.current
			if (cursor.sessionId === snapshot.sessionId && snapshot.revision <= cursor.revision) return false
			snapshotCursorRef.current = { sessionId: snapshot.sessionId, revision: snapshot.revision }
			latestSnapshotRef.current = snapshot
			const queuedRows = queuedRowsRef.current
			if (queuedRows?.sessionId === snapshot.sessionId) {
				for (const item of snapshot.queue) {
					if (item.state !== 'pending' && item.state !== 'firing') continue
					queuedRows.rows.set(item.id, item)
					if (queuedRows.rows.size > 20) queuedRows.rows.delete(queuedRows.rows.keys().next().value!)
				}
			}
			send(snapshotEvent(snapshot))
			queueMicrotask(() => drainOutboxRef.current(snapshot.sessionId))
			return true
		},
		[send, snapshotEvent]
	)
	const restoreSnapshot = useCallback(
		(snapshot: QueueSnapshot) => {
			if (snapshot.sessionId === activeSessionIdRef.current) return applySnapshot(snapshot)
			pendingSnapshotRef.current = snapshot
			return true
		},
		[applySnapshot]
	)

	const runCommand = useCallback(
		async <T extends { snapshot: QueueSnapshot }>(
			targetSessionId: string,
			command: (signal: AbortSignal) => Promise<T>
		) => {
			const controller = new AbortController()
			controllersRef.current.add(controller)
			try {
				const result = await command(controller.signal)
				if (!enabledRef.current || activeSessionIdRef.current !== targetSessionId) {
					throw new DOMException('Session changed', 'AbortError')
				}
				if (result.snapshot.sessionId !== targetSessionId) throw new Error('Queue response belongs to another session')
				applySnapshot(result.snapshot)
				return result
			} catch (error) {
				const snapshot = snapshotFromError(error)
				if (enabledRef.current && snapshot) applySnapshot(snapshot)
				throw error
			} finally {
				controllersRef.current.delete(controller)
			}
		},
		[applySnapshot]
	)

	const drainLocalOutbox = useCallback(
		async (targetSessionId: string) => {
			if (
				outboxDrainsRef.current.has(targetSessionId) ||
				!enabledRef.current ||
				activeSessionIdRef.current !== targetSessionId
			)
				return
			outboxDrainsRef.current.add(targetSessionId)
			try {
				while (enabledRef.current && activeSessionIdRef.current === targetSessionId && !admissionPausedRef.current) {
					const current = stateRef.current
					if (current.queueAction === 'clearing' || current.queueActionError) return
					const head = current.localBySession[targetSessionId]?.[0]
					if (!head || head.state === 'failed' || isServerQueuePaused(current.queue)) return
					let activeDepth = 0
					for (const item of current.queue) {
						if (item.state !== 'not_sent') activeDepth += 1
					}
					if (current.maxDepth !== null && activeDepth >= current.maxDepth) {
						send({ type: 'local_state', sessionId: targetSessionId, id: head.id, state: 'waiting' })
						return
					}

					send({ type: 'local_state', sessionId: targetSessionId, id: head.id, state: 'adding' })
					try {
						const result = await runCommand(targetSessionId, (signal) =>
							queueMessage(authorizedFetch, targetSessionId, head.payload, signal)
						)
						send({ type: 'max_depth', value: result.maxDepth })
						if (stateRef.current.localBySession[targetSessionId]?.some((item) => item.id === head.id)) {
							send({ type: 'local_remove', sessionId: targetSessionId, id: head.id })
						}
					} catch (error) {
						const stillLocal = stateRef.current.localBySession[targetSessionId]?.some((item) => item.id === head.id)
						if (!stillLocal) continue
						if (error instanceof DOMException && error.name === 'AbortError') {
							send({ type: 'local_state', sessionId: targetSessionId, id: head.id, state: 'waiting' })
							return
						}
						if (error instanceof LlamaAITransportError) {
							const maxDepth = (error.body as { maxDepth?: number } | null)?.maxDepth
							if (typeof maxDepth === 'number') send({ type: 'max_depth', value: maxDepth })
							if (errorCode(error) === 'queue_full') {
								send({ type: 'local_state', sessionId: targetSessionId, id: head.id, state: 'waiting' })
								return
							}
						}
						send({
							type: 'local_state',
							sessionId: targetSessionId,
							id: head.id,
							state: 'failed',
							error: 'Could not add this prompt. Retry or dismiss it.'
						})
						return
					}
				}
			} finally {
				outboxDrainsRef.current.delete(targetSessionId)
			}
		},
		[authorizedFetch, runCommand, send]
	)
	drainOutboxRef.current = (targetSessionId) => void drainLocalOutbox(targetSessionId)

	useEffect(() => {
		if (enabled && sessionId && !admissionPaused) void drainLocalOutbox(sessionId)
	}, [admissionPaused, drainLocalOutbox, enabled, sessionId])

	const enqueue = useCallback(
		(payload: Omit<QueueMessagePayload, 'clientMutationId'>): 'queued' | 'session_idle' | 'aborted' => {
			if (!enabledRef.current) return 'aborted'
			const targetSessionId = activeSessionIdRef.current
			if (!targetSessionId) return 'session_idle'
			const clientMutationId = crypto.randomUUID()
			const id = `temp-${clientMutationId}`
			send({
				type: 'local_add',
				sessionId: targetSessionId,
				row: {
					kind: 'local',
					id,
					state: 'waiting',
					payload: { ...payload, clientMutationId }
				}
			})
			queueMicrotask(() => drainOutboxRef.current(targetSessionId))
			return 'queued'
		},
		[send]
	)

	const runRowAction = useCallback(
		async (
			id: string,
			action: QueueAction,
			command: (sessionId: string, signal: AbortSignal) => Promise<QueueSnapshot>,
			unsavedDraft?: string
		) => {
			if (!enabledRef.current) return null
			const targetSessionId = activeSessionIdRef.current
			if (!targetSessionId) return null
			send({ type: 'action', id, action })
			try {
				const result = await runCommand(targetSessionId, async (signal) => ({
					snapshot: await command(targetSessionId, signal)
				}))
				send({ type: 'action_done', id })
				return result.snapshot
			} catch (error) {
				if (
					activeSessionIdRef.current === targetSessionId &&
					!(error instanceof DOMException && error.name === 'AbortError')
				) {
					send({
						type: 'action_failed',
						id,
						error: actionError(action, error),
						...(unsavedDraft !== undefined ? { unsavedDraft } : {})
					})
				}
				return null
			}
		},
		[runCommand, send]
	)

	const beginEdit = useCallback(
		async (id: string) => {
			const snapshot = await runRowAction(id, 'opening_edit', async (targetSessionId, signal) => {
				const result = await beginQueuedMessageEdit(authorizedFetch, targetSessionId, id, signal)
				return result.snapshot
			})
			if (!snapshot) return
			const reserved = snapshot.queue.find((item) => item.id === id)
			const current = latestSnapshotRef.current?.queue.find((item) => item.id === id)
			if (
				reserved?.state === 'editing' &&
				current?.state === 'editing' &&
				reserved.editLeaseId === current.editLeaseId
			) {
				rememberedEditsRef.current.set(snapshot.sessionId, {
					id,
					leaseId: reserved.editLeaseId,
					draft: reserved.message
				})
				send({ type: 'own_edit', id })
			}
		},
		[authorizedFetch, runRowAction, send]
	)

	const updateEditDraft = useCallback((id: string, draft: string) => {
		const targetSessionId = activeSessionIdRef.current
		if (!targetSessionId) return
		const rememberedEdit = rememberedEditsRef.current.get(targetSessionId)
		if (rememberedEdit?.id === id) rememberedEdit.draft = draft
	}, [])

	const saveEdit = useCallback(
		async (id: string, message: string) => {
			const item = stateRef.current.queue.find((candidate) => candidate.id === id)
			if (item?.state !== 'editing' || stateRef.current.ownedEditId !== id) return
			await runRowAction(
				id,
				'saving_edit',
				async (targetSessionId, signal) => {
					const result = await saveQueuedMessageEdit(
						authorizedFetch,
						targetSessionId,
						id,
						item.editLeaseId,
						{ message },
						signal
					)
					return result.snapshot
				},
				message
			)
		},
		[authorizedFetch, runRowAction]
	)

	const cancelEdit = useCallback(
		async (id: string) => {
			const item = stateRef.current.queue.find((candidate) => candidate.id === id)
			if (item?.state !== 'editing' || stateRef.current.ownedEditId !== id) return
			await runRowAction(id, 'canceling_edit', async (targetSessionId, signal) => {
				const result = await cancelQueuedMessageEdit(authorizedFetch, targetSessionId, id, item.editLeaseId, signal)
				return result.snapshot
			})
		},
		[authorizedFetch, runRowAction]
	)

	const dismiss = useCallback(
		async (id: string) => {
			const targetSessionId = activeSessionIdRef.current
			if (!targetSessionId) return
			if (stateRef.current.localBySession[targetSessionId]?.some((item) => item.id === id)) {
				send({ type: 'local_remove', sessionId: targetSessionId, id })
				queueMicrotask(() => drainOutboxRef.current(targetSessionId))
				return
			}
			await runRowAction(id, 'dismissing', async (commandSessionId, signal) => {
				const result = await cancelQueuedMessage(authorizedFetch, commandSessionId, id, signal)
				return result.snapshot
			})
		},
		[authorizedFetch, runRowAction, send]
	)

	const retry = useCallback(
		async (id: string) => {
			const targetSessionId = activeSessionIdRef.current
			if (!targetSessionId) return
			const local = stateRef.current.localBySession[targetSessionId]?.find((item) => item.id === id)
			if (local) {
				if (local.state !== 'failed') return
				send({ type: 'local_state', sessionId: targetSessionId, id, state: 'waiting' })
				queueMicrotask(() => drainOutboxRef.current(targetSessionId))
				return
			}
			await runRowAction(id, 'retrying', async (commandSessionId, signal) => {
				const result = await retryQueuedMessage(authorizedFetch, commandSessionId, id, signal)
				return result.snapshot
			})
		},
		[authorizedFetch, runRowAction, send]
	)

	const continueQueue = useCallback(async () => {
		const targetSessionId = activeSessionIdRef.current
		if (!targetSessionId) return
		send({ type: 'queue_action', action: 'continuing' })
		try {
			await runCommand(targetSessionId, (signal) => continueQueuedMessages(authorizedFetch, targetSessionId, signal))
			send({ type: 'queue_action_done' })
			queueMicrotask(() => drainOutboxRef.current(targetSessionId))
		} catch (error) {
			if (!(error instanceof DOMException && error.name === 'AbortError')) {
				send({
					type: 'queue_action_failed',
					action: 'continuing',
					message: 'Could not continue the queue. Try again.'
				})
			}
		}
	}, [authorizedFetch, runCommand, send])

	const clearQueue = useCallback(async () => {
		const targetSessionId = activeSessionIdRef.current
		if (!targetSessionId) return
		send({ type: 'queue_action', action: 'clearing' })
		try {
			await runCommand(targetSessionId, (signal) => cancelAllQueuedMessages(authorizedFetch, targetSessionId, signal))
			send({ type: 'local_clear', sessionId: targetSessionId })
			send({ type: 'queue_action_done' })
		} catch (error) {
			if (!(error instanceof DOMException && error.name === 'AbortError')) {
				send({
					type: 'queue_action_failed',
					action: 'clearing',
					message: 'Could not clear the queue. Try again.'
				})
			}
		}
	}, [authorizedFetch, runCommand, send])
	const forgetSession = useCallback(
		(targetSessionId: string) => send({ type: 'local_clear', sessionId: targetSessionId }),
		[send]
	)
	const adoptSession = useCallback(
		(previousSessionId: string, nextSessionId: string) => {
			if (previousSessionId === nextSessionId) return
			activeSessionIdRef.current = nextSessionId
			abortCommands()
			send({ type: 'local_adopt_session', previousSessionId, nextSessionId })
		},
		[abortCommands, send]
	)

	const takeStartedItem = useCallback((id: string) => {
		const queuedRows = queuedRowsRef.current
		if (!queuedRows || queuedRows.sessionId !== activeSessionIdRef.current) return null
		const item = queuedRows.rows.get(id) ?? null
		queuedRows.rows.delete(id)
		return item
	}, [])
	const getServerQueue = useCallback(
		() => (stateRef.current.sessionId === activeSessionIdRef.current ? stateRef.current.queue : []),
		[]
	)

	const visibleState = state.sessionId === sessionId ? state : initialState(sessionId)
	const localRows = sessionId ? (visibleState.localBySession[sessionId] ?? EMPTY_LOCAL_ROWS) : EMPTY_LOCAL_ROWS
	const rows = useMemo<QueueRow[]>(
		() => [...visibleState.queue.map((item): QueueServerRow => ({ ...item, kind: 'server' })), ...localRows],
		[localRows, visibleState.queue]
	)
	let activeDepth = 0
	for (const item of visibleState.queue) {
		if (item.state !== 'not_sent') activeDepth += 1
	}
	const atCapacity = visibleState.maxDepth !== null && activeDepth >= visibleState.maxDepth
	const paused = isServerQueuePaused(visibleState.queue)
	const ownedEdit = visibleState.queue.find((item) => item.id === visibleState.ownedEditId && item.state === 'editing')
	const ownedEditId = ownedEdit?.id ?? null
	const ownedEditLeaseId = ownedEdit?.state === 'editing' ? ownedEdit.editLeaseId : null

	useEffect(() => {
		if (!enabled || !sessionId || !ownedEditId || !ownedEditLeaseId) return
		const renew = async () => {
			const renewalController = new AbortController()
			renewalControllerRef.current = renewalController
			try {
				const result = await renewQueuedMessageEdit(
					authorizedFetch,
					sessionId,
					ownedEditId,
					ownedEditLeaseId,
					renewalController.signal
				)
				applySnapshot(result.snapshot)
			} catch (error) {
				const snapshot = snapshotFromError(error)
				if (snapshot) applySnapshot(snapshot)
			} finally {
				if (renewalControllerRef.current === renewalController) renewalControllerRef.current = null
			}
		}
		const timer = window.setInterval(() => void renew(), 30_000)
		renewalTimerRef.current = timer
		return () => {
			window.clearInterval(timer)
			if (renewalTimerRef.current === timer) renewalTimerRef.current = null
			renewalControllerRef.current?.abort()
			renewalControllerRef.current = null
		}
	}, [applySnapshot, authorizedFetch, enabled, ownedEditId, ownedEditLeaseId, sessionId])

	return {
		rows,
		serverQueue: visibleState.queue,
		maxDepth: visibleState.maxDepth,
		atCapacity,
		hasLocalRows: localRows.length > 0,
		paused,
		ownedEditId: visibleState.ownedEditId,
		rowStatus: visibleState.rowStatus,
		queueAction: visibleState.queueAction,
		queueActionError: visibleState.queueActionError,
		applySnapshot,
		restoreSnapshot,
		enqueue,
		beginEdit,
		updateEditDraft,
		saveEdit,
		cancelEdit,
		dismiss,
		retry,
		continueQueue,
		clearQueue,
		forgetSession,
		adoptSession,
		takeStartedItem,
		getServerQueue,
		abortCommands
	}
}
