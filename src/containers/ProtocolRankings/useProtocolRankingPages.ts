import { useCallback, useEffect, useReducer, useRef } from 'react'
import {
	DEFAULT_PROTOCOL_RANKING_QUERY,
	PROTOCOL_RANKINGS_PAGE_LIMIT,
	protocolRankingQuerySignature,
	type ProtocolRankingInitialPage,
	type ProtocolRankingPage as GenericProtocolRankingPage,
	type ProtocolRankingQuery
} from './query'
import type { IProtocol } from './types'

type ProtocolRankingPage = GenericProtocolRankingPage<IProtocol>

type ClientState = ProtocolRankingInitialPage & {
	rows: IProtocol[]
	loadedQuerySignature: string
	isReplacing: boolean
	isLoadingMore: boolean
	error: 'replace' | 'append' | null
	activeRequest: number
}

type ClientAction =
	| {
			type: 'source-change'
			request: number
			rows: IProtocol[]
			page: ProtocolRankingInitialPage
	  }
	| { type: 'replace-start'; request: number }
	| { type: 'append-start'; request: number }
	| {
			type: 'success'
			request: number
			mode: 'replace' | 'append'
			page: ProtocolRankingPage
			querySignature: string
	  }
	| { type: 'failed'; request: number; mode: 'replace' | 'append' }

export function protocolRankingClientReducer(state: ClientState, action: ClientAction): ClientState {
	if (action.type === 'source-change') {
		return {
			...action.page,
			rows: action.rows,
			loadedQuerySignature: protocolRankingQuerySignature(DEFAULT_PROTOCOL_RANKING_QUERY),
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
					const seen = new Set(state.rows.map((row) => row.id ?? row.slug))
					return state.rows.concat(action.page.rows.filter((row) => !seen.has(row.id ?? row.slug)))
				})()
	return {
		rows,
		nextCursor: action.page.nextCursor,
		snapshot: action.page.snapshot,
		total: action.page.total,
		hasMore: action.page.hasMore,
		availableActivityMetrics: action.page.availableActivityMetrics,
		loadedQuerySignature: action.querySignature,
		isReplacing: false,
		isLoadingMore: false,
		error: null,
		activeRequest: action.request
	}
}

export function buildProtocolRankingApiUrl({
	chain,
	query,
	snapshot,
	cursor
}: {
	chain: string
	query: ProtocolRankingQuery
	snapshot?: string | null
	cursor?: string | null
}): string {
	const params = new URLSearchParams({
		chain,
		sort: query.sort,
		order: query.order,
		limit: String(PROTOCOL_RANKINGS_PAGE_LIMIT)
	})
	if (query.search) params.set('search', query.search)
	if (query.minTvl !== null) params.set('minTvl', String(query.minTvl))
	if (query.maxTvl !== null) params.set('maxTvl', String(query.maxTvl))
	if (query.tvlKeys.length) params.set('tvlKeys', query.tvlKeys.join(','))
	if (query.sort === 'custom' && query.customSort) {
		params.set('customFormula', query.customSort.formula)
		params.set('customFormat', query.customSort.formatType)
	}
	if (snapshot) params.set('snapshot', snapshot)
	if (cursor) params.set('cursor', cursor)
	return `/api/public/protocol-rankings?${params.toString()}`
}

async function fetchPage(url: string, signal: AbortSignal): Promise<ProtocolRankingPage | 'snapshot_mismatch'> {
	const response = await fetch(url, { signal })
	if (response.status === 409) return 'snapshot_mismatch'
	if (!response.ok) throw new Error(`Protocol rankings request failed with ${response.status}`)
	return response.json() as Promise<ProtocolRankingPage>
}

async function fetchPageOrNull(
	url: string,
	signal: AbortSignal
): Promise<ProtocolRankingPage | 'snapshot_mismatch' | null> {
	return fetchPage(url, signal).catch(() => null)
}

async function fetchReplacementPage(args: {
	url: string
	latestUrl: string
	signal: AbortSignal
}): Promise<ProtocolRankingPage | null> {
	let page = await fetchPageOrNull(args.url, args.signal)
	if (page === 'snapshot_mismatch') page = await fetchPageOrNull(args.latestUrl, args.signal)
	return page === 'snapshot_mismatch' ? null : page
}

export function shouldReplaceProtocolRankingRows({
	enabled,
	querySignature,
	loadedQuerySignature
}: {
	enabled: boolean
	querySignature: string
	loadedQuerySignature: string
}): boolean {
	return enabled && querySignature !== loadedQuerySignature
}

export function useProtocolRankingPages({
	chain,
	initialRows,
	initialPage,
	query,
	enabled = true
}: {
	chain: string
	initialRows: IProtocol[]
	initialPage: ProtocolRankingInitialPage
	query: ProtocolRankingQuery
	enabled?: boolean
}) {
	const [state, dispatch] = useReducer(protocolRankingClientReducer, {
		...initialPage,
		rows: initialRows,
		loadedQuerySignature: protocolRankingQuerySignature(DEFAULT_PROTOCOL_RANKING_QUERY),
		isReplacing: false,
		isLoadingMore: false,
		error: null,
		activeRequest: 0
	})
	const requestRef = useRef(0)
	const abortRef = useRef<AbortController | null>(null)
	const requestPendingRef = useRef(false)
	const querySignature = protocolRankingQuerySignature(query)
	const sourceKey = `${chain}:${initialPage.snapshot}`
	const sourceKeyRef = useRef(sourceKey)
	const replacementUrl = buildProtocolRankingApiUrl({ chain, query, snapshot: state.snapshot })
	const latestUrl = buildProtocolRankingApiUrl({ chain, query })
	const appendUrl = state.nextCursor
		? buildProtocolRankingApiUrl({ chain, query, snapshot: state.snapshot, cursor: state.nextCursor })
		: null

	useEffect(() => {
		if (sourceKeyRef.current === sourceKey) return
		sourceKeyRef.current = sourceKey
		abortRef.current?.abort()
		requestPendingRef.current = false
		dispatch({ type: 'source-change', request: ++requestRef.current, rows: initialRows, page: initialPage })
	}, [initialPage, initialRows, sourceKey])

	const replace = useCallback(async () => {
		if (!enabled) return
		abortRef.current?.abort()
		const controller = new AbortController()
		abortRef.current = controller
		const request = ++requestRef.current
		requestPendingRef.current = true
		dispatch({ type: 'replace-start', request })
		const page = await fetchReplacementPage({ url: replacementUrl, latestUrl, signal: controller.signal })
		if (requestRef.current === request) requestPendingRef.current = false
		if (controller.signal.aborted) return
		if (page) dispatch({ type: 'success', request, mode: 'replace', page, querySignature })
		else dispatch({ type: 'failed', request, mode: 'replace' })
	}, [enabled, latestUrl, querySignature, replacementUrl])

	useEffect(() => {
		if (
			!shouldReplaceProtocolRankingRows({
				enabled,
				querySignature,
				loadedQuerySignature: state.loadedQuerySignature
			})
		) {
			return
		}
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
		const page = await fetchPageOrNull(appendUrl, controller.signal)
		if (requestRef.current === request) requestPendingRef.current = false
		if (controller.signal.aborted) return
		if (page === 'snapshot_mismatch') {
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

	useEffect(() => () => abortRef.current?.abort(), [])
	const retry = state.error === 'replace' ? replace : state.error === 'append' ? loadMore : undefined

	return { ...state, loadMore, retry }
}
