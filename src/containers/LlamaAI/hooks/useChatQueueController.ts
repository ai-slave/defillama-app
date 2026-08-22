import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react'
import {
	beginQueuedMessageEdit,
	cancelQueuedMessage,
	cancelQueuedMessageEdit,
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

export type QueueAction = 'opening_edit' | 'saving_edit' | 'canceling_edit' | 'dismissing' | 'retrying'

export type QueueServerRow = QueuedMessageElement & { kind: 'server' }

export interface QueueCreatingRow {
	kind: 'creating'
	id: string
	state: 'pending'
	message: string
	researchMode: boolean
	factCheckMode?: boolean
	entities?: Array<{ term: string; slug: string; type?: string }>
	quotedText?: string
}

export type QueueRow = QueueServerRow | QueueCreatingRow

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
}

interface QueueControllerState {
	sessionId: string | null
	queue: QueuedMessageElement[]
	creating: QueueCreatingRow | null
	maxDepth: number | null
	ownedEditId: string | null
	rowStatus: Record<string, QueueRowStatus>
}

interface RememberedEdit {
	id: string
	leaseId: string
	draft: string
}

type QueueControllerEvent =
	| { type: 'reset'; sessionId: string | null }
	| { type: 'snapshot'; snapshot: QueueSnapshot; rememberedEdit?: RememberedEdit }
	| { type: 'creating'; row: QueueCreatingRow }
	| { type: 'creating_done'; id: string }
	| { type: 'max_depth'; value: number }
	| { type: 'action'; id: string; action: QueueAction }
	| { type: 'action_done'; id: string }
	| { type: 'action_failed'; id: string; error: string; unsavedDraft?: string }
	| { type: 'own_edit'; id: string }

function initialState(sessionId: string | null): QueueControllerState {
	return {
		sessionId,
		queue: [],
		creating: null,
		maxDepth: null,
		ownedEditId: null,
		rowStatus: {}
	}
}

function queueControllerReducer(state: QueueControllerState, event: QueueControllerEvent): QueueControllerState {
	switch (event.type) {
		case 'reset':
			return initialState(event.sessionId)
		case 'snapshot': {
			if (event.snapshot.sessionId !== state.sessionId) return state
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
				if (ids.has(id)) rowStatus[id] = state.rowStatus[id]
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
				ownedEditId: ownedEdit?.state === 'editing' ? ownedEdit.id : null,
				rowStatus
			}
		}
		case 'creating':
			return { ...state, creating: event.row }
		case 'creating_done':
			return state.creating?.id === event.id ? { ...state, creating: null } : state
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
					[event.id]: { action: null, error: event.error, unsavedDraft: event.unsavedDraft }
				}
			}
		case 'own_edit':
			return { ...state, ownedEditId: event.id }
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
	authorizedFetch
}: {
	sessionId: string | null
	authorizedFetch: AuthorizedFetch
}) {
	const [state, dispatch] = useReducer(queueControllerReducer, sessionId, initialState)
	const stateRef = useRef(state)
	stateRef.current = state
	const activeSessionIdRef = useRef(sessionId)
	activeSessionIdRef.current = sessionId
	const controllersRef = useRef(new Set<AbortController>())
	const enqueueInFlightRef = useRef(false)
	const queuedRowsRef = useRef<{ sessionId: string; rows: Map<string, QueuedMessageElement> } | null>(null)
	const rememberedEditsRef = useRef(new Map<string, RememberedEdit>())
	const pendingSnapshotRef = useRef<QueueSnapshot | null>(null)
	const snapshotCursorRef = useRef({ sessionId, revision: -1 })
	const latestSnapshotRef = useRef<QueueSnapshot | null>(null)
	const commandControllers = controllersRef.current
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
		if (stateRef.current.sessionId !== sessionId) dispatch({ type: 'reset', sessionId })
		snapshotCursorRef.current = { sessionId, revision: -1 }
		latestSnapshotRef.current = null
		queuedRowsRef.current = sessionId ? { sessionId, rows: new Map() } : null
		if (pendingSnapshotRef.current?.sessionId === sessionId) {
			snapshotCursorRef.current.revision = pendingSnapshotRef.current.revision
			latestSnapshotRef.current = pendingSnapshotRef.current
			dispatch(snapshotEvent(pendingSnapshotRef.current))
			pendingSnapshotRef.current = null
		}
		return () => {
			enqueueInFlightRef.current = false
			for (const controller of commandControllers) controller.abort()
			commandControllers.clear()
		}
	}, [commandControllers, sessionId, snapshotEvent])

	const applySnapshot = useCallback(
		(snapshot: QueueSnapshot) => {
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
			dispatch(snapshotEvent(snapshot))
			return true
		},
		[snapshotEvent]
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
				if (activeSessionIdRef.current !== targetSessionId) throw new DOMException('Session changed', 'AbortError')
				if (result.snapshot.sessionId !== targetSessionId) throw new Error('Queue response belongs to another session')
				applySnapshot(result.snapshot)
				return result
			} catch (error) {
				const snapshot = snapshotFromError(error)
				if (snapshot) applySnapshot(snapshot)
				throw error
			} finally {
				controllersRef.current.delete(controller)
			}
		},
		[applySnapshot]
	)

	const enqueue = useCallback(
		async (
			payload: Omit<QueueMessagePayload, 'clientMutationId'>
		): Promise<'queued' | 'session_idle' | 'busy' | 'aborted'> => {
			const targetSessionId = activeSessionIdRef.current
			if (!targetSessionId) return 'session_idle'
			if (enqueueInFlightRef.current) return 'busy'
			enqueueInFlightRef.current = true
			const clientMutationId = crypto.randomUUID()
			const optimisticId = `temp-${clientMutationId}`
			dispatch({
				type: 'creating',
				row: {
					kind: 'creating',
					id: optimisticId,
					state: 'pending',
					message: payload.message,
					researchMode: payload.researchMode,
					factCheckMode: payload.factCheckMode,
					entities: payload.entities,
					quotedText: payload.quotedText
				}
			})
			try {
				const result = await runCommand(targetSessionId, (signal) =>
					queueMessage(authorizedFetch, targetSessionId, { ...payload, clientMutationId }, signal)
				)
				dispatch({ type: 'max_depth', value: result.maxDepth })
				return 'queued'
			} catch (error) {
				if (
					activeSessionIdRef.current !== targetSessionId ||
					(error instanceof DOMException && error.name === 'AbortError')
				) {
					return 'aborted'
				}
				if (errorCode(error) === 'session_idle') return 'session_idle'
				if (error instanceof LlamaAITransportError) {
					const maxDepth = (error.body as { maxDepth?: number } | null)?.maxDepth
					if (typeof maxDepth === 'number') dispatch({ type: 'max_depth', value: maxDepth })
				}
				throw error
			} finally {
				enqueueInFlightRef.current = false
				dispatch({ type: 'creating_done', id: optimisticId })
			}
		},
		[authorizedFetch, runCommand]
	)

	const runRowAction = useCallback(
		async (
			id: string,
			action: QueueAction,
			command: (sessionId: string, signal: AbortSignal) => Promise<QueueSnapshot>,
			unsavedDraft?: string
		) => {
			const targetSessionId = activeSessionIdRef.current
			if (!targetSessionId) return null
			dispatch({ type: 'action', id, action })
			try {
				const result = await runCommand(targetSessionId, async (signal) => ({
					snapshot: await command(targetSessionId, signal)
				}))
				dispatch({ type: 'action_done', id })
				return result.snapshot
			} catch (error) {
				if (
					activeSessionIdRef.current === targetSessionId &&
					!(error instanceof DOMException && error.name === 'AbortError')
				) {
					dispatch({ type: 'action_failed', id, error: actionError(action, error), unsavedDraft })
				}
				return null
			}
		},
		[runCommand]
	)

	const beginEdit = useCallback(
		async (id: string) => {
			const snapshot = await runRowAction(id, 'opening_edit', async (targetSessionId, signal) => {
				const result = await beginQueuedMessageEdit(authorizedFetch, targetSessionId, id, signal)
				return result.snapshot
			})
			const reserved = snapshot?.queue.find((item) => item.id === id)
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
				dispatch({ type: 'own_edit', id })
			}
		},
		[authorizedFetch, runRowAction]
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
			await runRowAction(id, 'dismissing', async (targetSessionId, signal) => {
				const result = await cancelQueuedMessage(authorizedFetch, targetSessionId, id, signal)
				return result.snapshot
			})
		},
		[authorizedFetch, runRowAction]
	)

	const retry = useCallback(
		async (id: string) => {
			await runRowAction(id, 'retrying', async (targetSessionId, signal) => {
				const result = await retryQueuedMessage(authorizedFetch, targetSessionId, id, signal)
				return result.snapshot
			})
		},
		[authorizedFetch, runRowAction]
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
	const rows = useMemo<QueueRow[]>(
		() => [
			...visibleState.queue.map((item): QueueServerRow => ({ ...item, kind: 'server' })),
			...(visibleState.creating ? [visibleState.creating] : [])
		],
		[visibleState.queue, visibleState.creating]
	)
	let activeDepth = visibleState.creating ? 1 : 0
	for (const item of visibleState.queue) {
		if (item.state !== 'not_sent') activeDepth += 1
	}
	const atCapacity = visibleState.maxDepth !== null && activeDepth >= visibleState.maxDepth
	const ownedEdit = visibleState.queue.find((item) => item.id === visibleState.ownedEditId && item.state === 'editing')
	const ownedEditId = ownedEdit?.id ?? null
	const ownedEditLeaseId = ownedEdit?.state === 'editing' ? ownedEdit.editLeaseId : null

	useEffect(() => {
		if (!sessionId || !ownedEditId || !ownedEditLeaseId) return
		let renewalController: AbortController | null = null
		const renew = async () => {
			renewalController = new AbortController()
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
				renewalController = null
			}
		}
		const timer = window.setInterval(() => void renew(), 30_000)
		return () => {
			window.clearInterval(timer)
			renewalController?.abort()
		}
	}, [applySnapshot, authorizedFetch, ownedEditId, ownedEditLeaseId, sessionId])

	return {
		rows,
		serverQueue: visibleState.queue,
		maxDepth: visibleState.maxDepth,
		atCapacity,
		ownedEditId: visibleState.ownedEditId,
		rowStatus: visibleState.rowStatus,
		applySnapshot,
		restoreSnapshot,
		enqueue,
		beginEdit,
		updateEditDraft,
		saveEdit,
		cancelEdit,
		dismiss,
		retry,
		takeStartedItem,
		getServerQueue
	}
}
