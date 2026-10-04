import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { matchSorter } from 'match-sorter'
import { startTransition, useDeferredValue, useMemo, useState } from 'react'
import type { IResponseCGMarketsAPI } from '~/api/coingecko.types'
import { TokenLogo } from '~/components/TokenLogo'
import { useDebouncedValue } from '~/hooks/useDebounce'
import { useMedia } from '~/hooks/useMedia'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogHeader, DialogToolbar } from '~/ui/Dialog'
import { NoResults } from '~/ui/NoResults'
import { popoverRowStyles, popoverSeeMoreStyles } from '~/ui/Popover'
import { SearchField } from '~/ui/SearchField'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import { geckoTokenIconUrl } from '~/utils/icons'
import { queryReadFailed } from '~/utils/query'
import { searchTokens } from './search'
import { TOKEN_SEARCH_LIMIT, type TokenSearchResult } from './types'

export type TokenSearchOption = TokenSearchResult | IResponseCGMarketsAPI

interface TokenSearchDialogProps {
	initialTokens?: Array<TokenSearchResult>
	coinsData?: Array<IResponseCGMarketsAPI>
	selectToken: (token: TokenSearchOption) => void
	dialogStore: Ariakit.DialogStore
	selectedTokens: Record<string, TokenSearchOption>
}

function getOptionLogo(token: TokenSearchOption): string {
	return 'coinKey' in token ? token.logo : (token.image ?? geckoTokenIconUrl(token.id))
}

function getOptionSymbol(token: TokenSearchOption): string {
	return token.symbol.toUpperCase()
}

export function toTokenSearchOption(token: TokenSearchOption): TokenSearchResult {
	if ('coinKey' in token) return token
	return {
		id: token.id,
		searchId: `coingecko:${token.id}`,
		coinKey: `coingecko:${token.id}`,
		name: token.name,
		symbol: getOptionSymbol(token),
		logo: getOptionLogo(token),
		rank: token.market_cap_rank_with_rehypothecated ?? token.market_cap_rank ?? Number.MAX_SAFE_INTEGER
	}
}

const EMPTY_INITIAL_TOKENS: NonNullable<TokenSearchDialogProps['initialTokens']> = []

export function TokenSearchDialog({ dialogStore, ...props }: TokenSearchDialogProps) {
	return (
		<Ariakit.DialogProvider store={dialogStore}>
			<Dialog size="sm" fullSheet unmountOnHide portal>
				<DialogHeader title="Add token" />
				<TokenSearch {...props} />
			</Dialog>
		</Ariakit.DialogProvider>
	)
}

/** Mounts with each opening, so the search starts empty and only searches while the dialog is open. */
function TokenSearch({
	initialTokens = EMPTY_INITIAL_TOKENS,
	coinsData,
	selectToken,
	selectedTokens
}: Omit<TokenSearchDialogProps, 'dialogStore'>) {
	const isSmallScreen = useMedia('(max-width: 639px)')
	const [search, setSearch] = useState('')
	const deferredSearch = useDeferredValue(search)
	const debouncedSearch = useDebouncedValue(search, 200)
	const tokenSearch = useQuery({
		queryKey: ['token-search', debouncedSearch, TOKEN_SEARCH_LIMIT],
		queryFn: () => searchTokens(debouncedSearch, TOKEN_SEARCH_LIMIT),
		initialData: debouncedSearch === '' && initialTokens.length > 0 ? initialTokens : undefined,
		enabled: !coinsData,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	const filteredRemoteTokens = (tokenSearch.data ?? []).filter((token) => !selectedTokens[token.id])
	const filteredLocalTokens = useMemo(() => {
		if (!coinsData) return []
		const filteredTokens =
			deferredSearch === ''
				? coinsData
				: matchSorter(coinsData, deferredSearch, {
						keys: [(coin) => coin.symbol ?? '', (coin) => coin.name ?? ''],
						threshold: matchSorter.rankings.CONTAINS
					})

		return filteredTokens.filter((token) => !selectedTokens[token.id])
	}, [coinsData, deferredSearch, selectedTokens])

	const [localResultsLength, setLocalResultsLength] = useState(10)
	const visibleTokens = coinsData ? filteredLocalTokens.slice(0, localResultsLength + 1) : filteredRemoteTokens
	const failed = !coinsData && queryReadFailed(tokenSearch)
	const isLoading = !coinsData && !failed && tokenSearch.isLoading
	const hasMoreLocalResults = coinsData ? localResultsLength < filteredLocalTokens.length : false

	const showMoreLocalResults = () => {
		startTransition(() => {
			setLocalResultsLength((prev) => prev + 10)
		})
	}

	return (
		<>
			<DialogToolbar>
				{/* Phones skip the autofocus: the keyboard would cover the list before anyone asked to search. */}
				<SearchField
					label="Search token"
					placeholder="Search token..."
					value={search}
					onChange={setSearch}
					autoFocus={!isSmallScreen}
				/>
			</DialogToolbar>
			<DialogBody kind="list">
				{visibleTokens.map((token) => (
					<button
						type="button"
						key={token.id}
						onClick={() => {
							selectToken(token)
							setSearch('')
						}}
						className={`${popoverRowStyles} w-full rounded-md text-left`}
					>
						<span className="flex min-w-0 items-center gap-2">
							<TokenLogo src={getOptionLogo(token)} size={24} />
							<span className="truncate">
								{token.name} ({getOptionSymbol(token)})
							</span>
						</span>
					</button>
				))}
				{isLoading ? (
					<p role="status" aria-live="polite" className="p-3">
						<LoadingIndicator />
					</p>
				) : failed ? (
					<InlineStatus variant="error">
						<span className="flex flex-wrap items-center justify-between gap-2">
							Couldn&rsquo;t search tokens.
							<Button
								type="button"
								size="sm"
								pendingLabel={tokenSearch.isFetching ? 'Retrying…' : null}
								onClick={() => void tokenSearch.refetch()}
							>
								Try again
							</Button>
						</span>
					</InlineStatus>
				) : visibleTokens.length === 0 ? (
					<NoResults>No tokens found</NoResults>
				) : null}
				{hasMoreLocalResults ? (
					<button type="button" className={`${popoverSeeMoreStyles} rounded-md`} onClick={showMoreLocalResults}>
						See more…
					</button>
				) : null}
			</DialogBody>
		</>
	)
}
