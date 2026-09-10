import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import type { SearchResult } from '~/containers/LlamaAI/types'

const EMPTY_RESULTS: Array<SearchResult> = []

/** The query the current results answer, and those results; `failed` when the request did not complete. */
interface SettledSearch {
	query: string
	results: Array<SearchResult>
	failed: boolean
}

const NO_RESULTS: SettledSearch = { query: '', results: EMPTY_RESULTS, failed: false }

type SemanticSearchOutcome =
	| { kind: 'results'; results: Array<SearchResult> }
	| { kind: 'failed' }
	| { kind: 'aborted' }

// Owns the try: the compiler can lower neither the finalizer nor the logical, coalescing and
// optional-chained tests inside it. The caller keeps the decisions that touch state.
async function fetchSemanticResults(
	authorizedFetch: ReturnType<typeof useAuthContext>['authorizedFetch'],
	query: string,
	signal: AbortSignal
): Promise<SemanticSearchOutcome> {
	try {
		const res = await authorizedFetch(`${AI_SERVER}/search?q=${encodeURIComponent(query)}&limit=10`, { signal })
		if (!res || !res.ok) return { kind: 'failed' }
		const data = await res.json()
		return { kind: 'results', results: data.results ?? [] }
	} catch (error) {
		return (error as { name?: string } | null)?.name === 'AbortError' ? { kind: 'aborted' } : { kind: 'failed' }
	}
}

export function useSemanticSearch(enabled: boolean) {
	const { authorizedFetch, isAuthenticated } = useAuthContext()
	const [query, setQuery] = useState('')
	// The query these results belong to. Both the result list and the spinner derive from it, so
	// neither has to be maintained by hand: a query we have not settled yet is still in flight.
	const [settled, setSettled] = useState<SettledSearch>(NO_RESULTS)
	const abortRef = useRef<AbortController | null>(null)

	const trimmed = query.trim()
	const active = enabled && isAuthenticated && trimmed !== ''
	// Forgotten as the box empties, so clearing and retyping runs the search again.
	if (!active && settled.query !== '') setSettled(NO_RESULTS)
	const isSearching = active && trimmed !== settled.query
	// Results outlive the keystroke that supersedes them, so the list does not flash empty while the
	// next search runs.
	const results = active ? settled.results : EMPTY_RESULTS
	const failed = active && settled.failed && trimmed === settled.query

	const search = useCallback(
		async (q: string) => {
			abortRef.current?.abort()
			const controller = new AbortController()
			abortRef.current = controller
			const outcome = await fetchSemanticResults(authorizedFetch, q, controller.signal)
			// A superseded search reports nothing: its results and its emptiness are both stale.
			if (controller.signal.aborted || outcome.kind === 'aborted') return
			setSettled(
				outcome.kind === 'results'
					? { query: q, results: outcome.results, failed: false }
					: { query: q, results: EMPTY_RESULTS, failed: true }
			)
		},
		[authorizedFetch]
	)

	// Forgetting the failed settlement makes the query unsettled again, so the debounce effect reruns it.
	const retry = useCallback(() => setSettled(NO_RESULTS), [])

	useEffect(() => {
		if (!active || trimmed === settled.query) return
		const timer = setTimeout(() => void search(trimmed), 300)
		return () => {
			clearTimeout(timer)
			abortRef.current?.abort()
		}
	}, [active, trimmed, settled.query, search])

	const clear = useCallback(() => {
		setQuery('')
		abortRef.current?.abort()
	}, [])

	return { query, setQuery, results, isSearching, failed, retry, clear }
}
