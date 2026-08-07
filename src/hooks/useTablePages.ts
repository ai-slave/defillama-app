import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { CursorTablePage } from '~/server/tablePages/types'

/**
 * Client half of a cursor-mode (accumulating) table page pipeline — see
 * src/server/tablePages/README.md. Owns the append/replace state machine:
 *
 * - every request carries a monotonically increasing number, and the reducer
 *   drops any response that is not the newest — a slow page landing after a
 *   query change is discarded on arrival even if its abort never fired;
 * - a query-signature change triggers a REPLACEMENT (fresh first page under
 *   the pinned version) while the existing rows stay on screen until the new
 *   page wins;
 * - a version mismatch (HTTP 409) transparently replaces at the latest
 *   version; appended rows dedupe on `getRowKey`;
 * - the returned `sentinelRef` drives loadMore via an IntersectionObserver —
 *   attach it to the status footer below the table (TablePagesStatus).
 *
 * `mode` widens as more modes land ('offset', 'local'); only 'cursor'
 * exists today, so passing the option is a type-checked statement of intent.
 */

type PageState<Row> = Omit<CursorTablePage<Row>, 'rows'>

type ClientState<Row, Page extends CursorTablePage<Row>> = Omit<Page, 'rows'> & {
	rows: Row[]
	loadedQuerySignature: string
	isReplacing: boolean
	isLoadingMore: boolean
	error: 'replace' | 'append' | null
	activeRequest: number
}

type ClientAction<Row, Page extends CursorTablePage<Row>> =
	| { type: 'source-change'; request: number; rows: Row[]; page: Omit<Page, 'rows'>; defaultQuerySignature: string }
	| { type: 'replace-start'; request: number }
	| { type: 'append-start'; request: number }
	| { type: 'success'; request: number; mode: 'replace' | 'append'; page: Page; querySignature: string }
	| { type: 'failed'; request: number; mode: 'replace' | 'append' }

export function createTablePagesReducer<Row, Page extends CursorTablePage<Row>>(getRowKey: (row: Row) => string) {
	return function reducer(state: ClientState<Row, Page>, action: ClientAction<Row, Page>): ClientState<Row, Page> {
		if (action.type === 'source-change') {
			return {
				...state,
				...action.page,
				rows: action.rows,
				loadedQuerySignature: action.defaultQuerySignature,
				isReplacing: false,
				isLoadingMore: false,
				error: null,
				activeRequest: action.request
			}
		}
		if (action.type === 'replace-start') {
			return { ...state, activeRequest: action.request, isReplacing: true, isLoadingMore: false, error: null }
		}
		if (action.type === 'append-start') {
			return { ...state, activeRequest: action.request, isLoadingMore: true, error: null }
		}
		if (action.request !== state.activeRequest) return state
		if (action.type === 'failed') {
			return { ...state, isReplacing: false, isLoadingMore: false, error: action.mode }
		}

		const rows =
			action.mode === 'replace'
				? action.page.rows
				: (() => {
						const seen = new Set(state.rows.map(getRowKey))
						return state.rows.concat(action.page.rows.filter((row) => !seen.has(getRowKey(row))))
					})()
		return {
			...state,
			...action.page,
			rows,
			loadedQuerySignature: action.querySignature,
			isReplacing: false,
			isLoadingMore: false,
			error: null,
			activeRequest: action.request
		}
	}
}

async function fetchPage<Row, Page extends CursorTablePage<Row>>(
	url: string,
	signal: AbortSignal,
	parsePage: (json: unknown) => Page
): Promise<Page | 'version_mismatch'> {
	const response = await fetch(url, { signal })
	if (response.status === 409) return 'version_mismatch'
	if (!response.ok) throw new Error(`Table page request failed with ${response.status}`)
	return parsePage(await response.json())
}

export function useTablePages<Row, Page extends CursorTablePage<Row>>({
	mode: _mode,
	enabled = true,
	sourceKey,
	initialRows,
	initialPage,
	querySignature,
	defaultQuerySignature,
	getRowKey,
	buildPageUrl,
	parsePage = (json) => json as Page,
	rootMargin = '800px 0px'
}: {
	mode: 'cursor'
	enabled?: boolean
	/** Identity of the server-rendered payload (e.g. `${chain}:${version}`); a change resets to it. */
	sourceKey: string
	initialRows: Row[]
	initialPage: Omit<Page, 'rows'>
	/** Canonical signature of the CURRENT query (schema.signature). */
	querySignature: string
	/** Signature of the default query the server-rendered rows were built with. */
	defaultQuerySignature: string
	getRowKey: (row: Row) => string
	/** Build a request URL; the hook supplies version/cursor, the surface owns everything else. */
	buildPageUrl: (args: { version?: string | null; cursor?: string | null }) => string
	/** Map a response body to the page shape (e.g. wire field `snapshot` -> `version`). */
	parsePage?: (json: unknown) => Page
	rootMargin?: string
}) {
	const reducerRef = useRef<ReturnType<typeof createTablePagesReducer<Row, Page>> | null>(null)
	reducerRef.current ??= createTablePagesReducer<Row, Page>(getRowKey)
	// Read through a ref so an inline parsePage prop can't churn the replace()
	// identity — a new identity per render would abort-and-restart in-flight
	// replacements forever via the signature-divergence effect below.
	const parsePageRef = useRef(parsePage)
	parsePageRef.current = parsePage
	const [state, dispatch] = useReducer(reducerRef.current, {
		...(initialPage as PageState<Row> as Omit<Page, 'rows'>),
		rows: initialRows,
		loadedQuerySignature: defaultQuerySignature,
		isReplacing: false,
		isLoadingMore: false,
		error: null,
		activeRequest: 0
	} as ClientState<Row, Page>)
	const requestRef = useRef(0)
	const abortRef = useRef<AbortController | null>(null)
	const requestPendingRef = useRef(false)
	const sourceKeyRef = useRef(sourceKey)
	const replacementUrl = buildPageUrl({ version: state.version })
	const latestUrl = buildPageUrl({})
	const appendUrl = state.nextCursor ? buildPageUrl({ version: state.version, cursor: state.nextCursor }) : null

	useEffect(() => {
		if (sourceKeyRef.current === sourceKey) return
		sourceKeyRef.current = sourceKey
		abortRef.current?.abort()
		requestPendingRef.current = false
		dispatch({
			type: 'source-change',
			request: ++requestRef.current,
			rows: initialRows,
			page: initialPage,
			defaultQuerySignature
		})
	}, [defaultQuerySignature, initialPage, initialRows, sourceKey])

	const replace = useCallback(async () => {
		if (!enabled) return
		abortRef.current?.abort()
		const controller = new AbortController()
		abortRef.current = controller
		const request = ++requestRef.current
		requestPendingRef.current = true
		dispatch({ type: 'replace-start', request })
		const pinned = await fetchPage<Row, Page>(replacementUrl, controller.signal, parsePageRef.current).catch(() => null)
		const retried =
			pinned === 'version_mismatch'
				? await fetchPage<Row, Page>(latestUrl, controller.signal, parsePageRef.current).catch(() => null)
				: pinned
		const page = retried === 'version_mismatch' ? null : retried
		if (requestRef.current === request) requestPendingRef.current = false
		if (controller.signal.aborted) return
		if (page) dispatch({ type: 'success', request, mode: 'replace', page, querySignature })
		else dispatch({ type: 'failed', request, mode: 'replace' })
	}, [enabled, latestUrl, querySignature, replacementUrl])

	useEffect(() => {
		if (!enabled || querySignature === state.loadedQuerySignature) return
		void replace()
		return () => abortRef.current?.abort()
	}, [enabled, querySignature, replace, state.loadedQuerySignature])

	const loadMore = useCallback(async () => {
		if (
			!enabled ||
			querySignature !== state.loadedQuerySignature ||
			!state.hasMore ||
			!appendUrl ||
			requestPendingRef.current ||
			state.isLoadingMore ||
			state.isReplacing
		) {
			return
		}
		const controller = new AbortController()
		abortRef.current = controller
		const request = ++requestRef.current
		requestPendingRef.current = true
		dispatch({ type: 'append-start', request })
		const page = await fetchPage<Row, Page>(appendUrl, controller.signal, parsePageRef.current).catch(() => null)
		if (requestRef.current === request) requestPendingRef.current = false
		if (controller.signal.aborted) return
		if (page === 'version_mismatch') {
			void replace()
			return
		}
		if (page) dispatch({ type: 'success', request, mode: 'append', page, querySignature })
		else dispatch({ type: 'failed', request, mode: 'append' })
	}, [
		appendUrl,
		enabled,
		querySignature,
		replace,
		state.hasMore,
		state.isLoadingMore,
		state.isReplacing,
		state.loadedQuerySignature
	])

	const sentinelRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const sentinel = sentinelRef.current
		// Also disconnect while a request is in flight: loadMore would no-op on
		// every intersection tick anyway, and reattaching after the load fires
		// the observer's initial callback, which continues the scroll if the
		// sentinel is still within the margin.
		if (!enabled || !sentinel || !state.hasMore || state.error || state.isReplacing || state.isLoadingMore) return
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) void loadMore()
			},
			{ rootMargin }
		)
		observer.observe(sentinel)
		return () => observer.disconnect()
	}, [enabled, loadMore, rootMargin, state.error, state.hasMore, state.isLoadingMore, state.isReplacing])

	useEffect(() => () => abortRef.current?.abort(), [])
	const retry = state.error === 'replace' ? replace : state.error === 'append' ? loadMore : undefined

	return { ...state, loadMore, retry, sentinelRef }
}
