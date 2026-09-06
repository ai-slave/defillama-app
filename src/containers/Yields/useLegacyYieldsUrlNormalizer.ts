import { useRouter } from 'next/router'
import * as React from 'react'
import { canonicalizeLegacyYieldsQuery, tokenBySymbolFromOptions, type LegacyYieldsPage } from './data/legacyQuery'
import type { TokenOption } from './data/types'

// Bookmark shield for the v2 /yields pages. On the first ready render, rewrite any
// pre-rebuild URL (project=, token symbols, million_dollar, sortBy=tvlUsd, dead show*/attribute
// params, …) to its canonical form via a shallow, no-scroll replace BEFORE the table fetches.
// Returns false until the canonical URL is in place, so the caller can gate the fetch and its
// first request already carries canonical params.
export function useLegacyYieldsUrlNormalizer({
	page,
	tokens
}: {
	page: LegacyYieldsPage
	tokens: ReadonlyArray<TokenOption>
}): boolean {
	const router = useRouter()
	const tokenBySymbol = React.useMemo(() => tokenBySymbolFromOptions(tokens), [tokens])
	const canonical = React.useMemo(
		() => (router.isReady ? canonicalizeLegacyYieldsQuery(router.query, { page, tokenBySymbol }) : null),
		[router.isReady, router.query, page, tokenBySymbol]
	)
	const replacedRef = React.useRef<string | null>(null)

	React.useEffect(() => {
		if (!router.isReady || canonical == null) return
		const key = JSON.stringify(canonical)
		// Fire the rewrite once per distinct legacy target (guards the async replace window).
		if (replacedRef.current === key) return
		replacedRef.current = key
		void router.replace({ pathname: router.pathname, query: canonical }, undefined, { shallow: true, scroll: false })
	}, [router, canonical])

	return router.isReady && canonical == null
}
