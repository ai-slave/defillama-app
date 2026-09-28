import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { matchSorter } from 'match-sorter'
import { startTransition, useDeferredValue, useMemo, useState } from 'react'
import type { IResponseCGMarketsAPI } from '~/api/coingecko.types'
import { TokenLogo } from '~/components/TokenLogo'
import { useDebouncedValue } from '~/hooks/useDebounce'
import { DialogCloseButton, DialogHeading, dialogFullSheetSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles, searchFieldInputPlacementStyles } from '~/ui/Input'
import { LoadingIndicator } from '~/ui/Status'
import { geckoTokenIconUrl } from '~/utils/icons'
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

export function TokenSearchDialog({
	initialTokens = EMPTY_INITIAL_TOKENS,
	coinsData,
	selectToken,
	dialogStore,
	selectedTokens
}: TokenSearchDialogProps) {
	const [search, setSearch] = useState('')
	const deferredSearch = useDeferredValue(search)
	const debouncedSearch = useDebouncedValue(search, 200)
	const isOpen = Ariakit.useStoreState(dialogStore, 'open')
	const tokenSearch = useQuery({
		queryKey: ['token-search', debouncedSearch, TOKEN_SEARCH_LIMIT],
		queryFn: () => searchTokens(debouncedSearch, TOKEN_SEARCH_LIMIT),
		initialData: debouncedSearch === '' && initialTokens.length > 0 ? initialTokens : undefined,
		enabled: isOpen && !coinsData,
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
	const isLoading = !coinsData && tokenSearch.isLoading
	const hasMoreLocalResults = coinsData ? localResultsLength < filteredLocalTokens.length : false

	const showMoreLocalResults = () => {
		startTransition(() => {
			setLocalResultsLength((prev) => prev + 10)
		})
	}

	return (
		<Ariakit.DialogProvider store={dialogStore}>
			<Ariakit.Dialog className={`${dialogFullSheetSurfaceStyles} [--dialog-width:400px]`} unmountOnHide portal>
				<div className="flex items-center gap-2 border-b border-subtle px-4 py-3">
					<DialogHeading>Add Token</DialogHeading>
					<DialogCloseButton className="ml-auto" />
				</div>
				<div className="border-b border-subtle px-4 py-3">
					<label className="relative block">
						<span className="sr-only">Search token</span>
						<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
						<Input
							value={search}
							onInput={(e) => setSearch(e.currentTarget.value)}
							placeholder="Search token..."
							className={searchFieldInputPlacementStyles}
						/>
					</label>
				</div>

				<div className="flex min-h-0 flex-auto flex-col overflow-y-auto p-2">
					{visibleTokens.map((token) => (
						<button
							type="button"
							key={token.id}
							onClick={() => {
								selectToken(token)
								setSearch('')
							}}
							className="flex w-full items-center gap-2 rounded-md p-2 text-left body-sm text-secondary hover:bg-hover-row hover:text-primary focus-visible:bg-hover-row focus-visible:text-primary"
						>
							<TokenLogo src={getOptionLogo(token)} size={24} />
							<span>
								{token.name} ({getOptionSymbol(token)})
							</span>
						</button>
					))}
					{isLoading ? (
						<p role="status" aria-live="polite" className="p-3">
							<LoadingIndicator />
						</p>
					) : null}
					{!isLoading && visibleTokens.length === 0 ? (
						<p role="status" aria-live="polite" className="p-3 body-sm text-tertiary">
							No tokens found
						</p>
					) : null}
					{hasMoreLocalResults ? (
						<button
							type="button"
							className="w-full rounded-md p-3 text-left body-sm text-link hover:bg-hover-row focus-visible:bg-hover-row"
							onClick={showMoreLocalResults}
						>
							See more...
						</button>
					) : null}
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
