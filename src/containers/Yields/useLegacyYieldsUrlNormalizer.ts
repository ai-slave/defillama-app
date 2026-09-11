import { useRouter } from 'next/router'
import * as React from 'react'
import { canonicalizeLegacyYieldsQuery, tokenBySymbolFromOptions, type LegacyYieldsPage } from './data/legacyQuery'
import type { TokenOption } from './data/types'
import { YIELDS_TABLE_PREFS } from './stickyQueryPrefs'
import { useStickyPrefsOverlay, useStickyQueryReplace } from './useStickyQueryReplace'

// Normalize legacy URLs and restore preferences in one replace before fetching.
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
	const overlay = useStickyPrefsOverlay(router.isReady ? (canonical ?? router.query) : null, YIELDS_TABLE_PREFS)

	return useStickyQueryReplace(overlay ?? canonical)
}
