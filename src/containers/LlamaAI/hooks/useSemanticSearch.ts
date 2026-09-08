import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import type { SearchResult } from '~/containers/LlamaAI/types'

type SemanticSearchOutcome = { kind: 'results'; results: Array<SearchResult> } | { kind: 'empty' } | { kind: 'aborted' }

// Owns the try: the compiler can lower neither the finalizer nor the logical, coalescing and
// optional-chained tests inside it. The caller keeps the decisions that touch state.
async function fetchSemanticResults(
	authorizedFetch: ReturnType<typeof useAuthContext>['authorizedFetch'],
	query: string,
	signal: AbortSignal
): Promise<SemanticSearchOutcome> {
	try {
		const res = await authorizedFetch(`${AI_SERVER}/search?q=${encodeURIComponent(query)}&limit=10`, { signal })
		if (!res || !res.ok) return { kind: 'empty' }
		const data = await res.json()
		return { kind: 'results', results: data.results ?? [] }
	} catch (error) {
		return (error as { name?: string } | null)?.name === 'AbortError' ? { kind: 'aborted' } : { kind: 'empty' }
	}
}

export function useSemanticSearch(enabled: boolean) {
	const { authorizedFetch, isAuthenticated } = useAuthContext()
	const [query, setQuery] = useState('')
	const [results, setResults] = useState<Array<SearchResult>>([])
	const [isSearching, setIsSearching] = useState(false)
	const abortRef = useRef<AbortController | null>(null)
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const search = useCallback(
		async (q: string) => {
			if (!q.trim() || !isAuthenticated) {
				setResults([])
				setIsSearching(false)
				return
			}

			abortRef.current?.abort()
			const controller = new AbortController()
			abortRef.current = controller

			setIsSearching(true)
			const outcome = await fetchSemanticResults(authorizedFetch, q.trim(), controller.signal)
			// The same two guards the finalizer and its early return carried: an aborted search touches
			// neither the results nor the spinner, and an aborted request reports nothing at all.
			if (outcome.kind === 'results') {
				if (!controller.signal.aborted) setResults(outcome.results)
			} else if (outcome.kind === 'empty') {
				setResults([])
			}
			if (!controller.signal.aborted) setIsSearching(false)
		},
		[authorizedFetch, isAuthenticated]
	)

	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current)
		abortRef.current?.abort()

		if (!enabled || !query.trim()) {
			setResults([])
			setIsSearching(false)
			return
		}

		setIsSearching(true)
		debounceRef.current = setTimeout(() => search(query), 300)

		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current)
			abortRef.current?.abort()
		}
	}, [query, search, enabled])

	useEffect(() => {
		return () => {
			abortRef.current?.abort()
		}
	}, [])

	const clear = useCallback(() => {
		setQuery('')
		setResults([])
		setIsSearching(false)
		abortRef.current?.abort()
	}, [])

	return { query, setQuery, results, isSearching, clear }
}
