import { useQuery } from '@tanstack/react-query'
import {
	createExpandedRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	type ExpandedState,
	type Row,
	type SortingState,
	tableFeatures,
	useTable
} from '@tanstack/react-table'
import { useMemo, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { DeletePortfolioButton } from '~/components/DeletePortfolioButton'
import { BasicLink } from '~/components/Link'
import { Menu } from '~/components/Menu'
import { NewPortfolioDialog } from '~/components/NewPortfolioDialog'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { PaginatedTable } from '~/components/Table/PaginatedTable'
import type { TokenMarketsListResponse } from '~/containers/Markets/api.types'
import { TokenMarketsSection } from '~/containers/Token/TokenMarketsSection'
import {
	EXPANDABLE_TOKENS_COLUMNS,
	getRankColumnWidth,
	TOKENS_MARKETS_EXPANDER_COLUMN_WIDTH,
	TOKENS_TABLE_WIDTH_EXCLUDING_RANK
} from '~/containers/Tokens'
import { useWatchlistTokensTable } from '~/containers/Tokens/queries.client'
import { TokensSourceAvailability } from '~/containers/Tokens/SourceAvailability'
import { tokenTableFeatures, type TokenTableFeatures } from '~/containers/Tokens/tableFeatures'
import type { TokensTableRow } from '~/containers/Tokens/types'
import { WatchListTabs } from '~/containers/Yields/views/WatchlistView'
import { useBookmarks } from '~/hooks/useBookmarks'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { InlineStatus, SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { TableToolbar } from '~/ui/Toolbar'
import { fetchJson } from '~/utils/async'
import { queryReadFailed } from '~/utils/query'
import { mergeMarketsSummary } from './marketsMerge'

const tableFeaturesConfig: TokenTableFeatures = tableFeatures({
	...tokenTableFeatures,
	sortedRowModel: createSortedRowModel(),
	expandedRowModel: createExpandedRowModel(),
	paginatedRowModel: createPaginatedRowModel()
})

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const
const DEFAULT_SORTING: SortingState = [{ id: 'marketCap', desc: true }]
export interface TokenUniverseEntry {
	id: string
	name: string
	symbol: string
}

export function TokensWatchlistContainer({ tokenUniverse }: { tokenUniverse: Array<TokenUniverseEntry> }) {
	const {
		selectedPortfolio,
		savedProtocols: savedTokens,
		addProtocol,
		removeProtocol,
		isLoadingWatchlist
	} = useBookmarks('tokens')

	const savedTokenIds = useMemo(() => Array.from(savedTokens), [savedTokens])

	const tokenOptions = useMemo(
		() => tokenUniverse.map((token) => ({ key: token.id, name: `${token.name} (${token.symbol})` })),
		[tokenUniverse]
	)

	const tokenNameById = useMemo(() => {
		const map = new Map<string, string>()
		for (const token of tokenUniverse) map.set(token.id, token.name)
		return map
	}, [tokenUniverse])

	const handleTokenSelection = (selectedValues: Array<string>) => {
		const currentSet = new Set(savedTokenIds)
		const newSet = new Set(selectedValues)
		const toAdd = selectedValues.filter((id) => !currentSet.has(id))
		for (const id of toAdd) addProtocol(id)
		for (const id of savedTokenIds) if (!newSet.has(id)) removeProtocol(id)

		const firstAddedId = toAdd[0]
		if (firstAddedId !== undefined) {
			const label = toAdd.length === 1 ? (tokenNameById.get(firstAddedId) ?? firstAddedId) : `${toAdd.length} tokens`
			toast.success(
				<span>
					Added {label} to{' '}
					<BasicLink href="/watchlist?tab=tokens" className="font-medium underline">
						watchlist
					</BasicLink>
				</span>
			)
		}
	}

	const tokensQuery = useWatchlistTokensTable(savedTokenIds)
	const { data, isLoading, isFetching, refetch } = tokensQuery
	const failed = queryReadFailed(tokensQuery)
	const { data: marketsList } = useQuery({
		queryKey: ['tokens-markets-summary'],
		queryFn: () => fetchJson<TokenMarketsListResponse>('/api/public/markets/tokens'),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: false,
		enabled: savedTokenIds.length > 0
	})
	const rows = useMemo(() => {
		const base = savedTokenIds.length > 0 ? (data?.rows ?? []) : []
		return mergeMarketsSummary(base, marketsList)
	}, [data?.rows, savedTokenIds.length, marketsList])

	const columns = EXPANDABLE_TOKENS_COLUMNS
	const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING)
	const [expanded, setExpanded] = useState<ExpandedState>({})

	const table = useTable({
		features: tableFeaturesConfig,
		defaultColumn: { sortUndefined: 'last' },
		data: rows,
		columns,
		state: { sorting, expanded },
		onSortingChange: setSorting,
		onExpandedChange: setExpanded,
		getRowId: (row) => row.id,
		getRowCanExpand: () => true,
		enableSortingRemoval: false
	})

	const rankColumnWidth = getRankColumnWidth(rows)
	const tableStyle = {
		'--tokens-rank-column-width': `${rankColumnWidth}px`,
		'--tokens-table-min-width': `${TOKENS_TABLE_WIDTH_EXCLUDING_RANK + TOKENS_MARKETS_EXPANDER_COLUMN_WIDTH + rankColumnWidth}px`
	} as React.CSSProperties

	if (isLoadingWatchlist) {
		return (
			<>
				<WatchListTabs />
				<Card padding="none" className="flex-1">
					<SurfaceBodyLoadingStatus className="p-2" />
				</Card>
			</>
		)
	}

	const hasSavedTokens = savedTokenIds.length > 0

	return (
		<>
			<WatchListTabs />
			<div className="flex flex-col gap-2">
				<TokensPortfolioSelection />
				{hasSavedTokens && data && failed ? (
					<InlineStatus variant="error">Unable to refresh token data. Showing the last available data.</InlineStatus>
				) : null}
				{data ? (
					<TokensSourceAvailability
						sources={data.unavailableSources.filter((source) => source !== 'markets' || !marketsList)}
					/>
				) : null}
				<Card padding="none">
					<TableToolbar>
						<div className="mr-auto">
							<h2 className="heading-xs">Tokens</h2>
							<p className="body-xs text-secondary">
								Select or deselect tokens for the "{selectedPortfolio}" portfolio
							</p>
						</div>
						<SelectWithCombobox
							allValues={tokenOptions}
							selectedValues={savedTokenIds}
							setSelectedValues={handleTokenSelection}
							label={savedTokenIds.length > 0 ? 'Tokens' : 'Add tokens'}
							labelType="smol"
							variant="filter"
							size="md"
						/>
					</TableToolbar>
					{hasSavedTokens && !data && failed ? (
						<SurfaceBodyStatus variant="error" className="p-2">
							<p>Token data is unavailable. Your saved tokens are unchanged.</p>
							<Button
								size="md"
								className="mt-2"
								pendingLabel={isFetching ? 'Retrying…' : null}
								onClick={() => void refetch()}
							>
								Retry
							</Button>
						</SurfaceBodyStatus>
					) : hasSavedTokens && isLoading ? (
						<SurfaceBodyLoadingStatus className="p-2" />
					) : hasSavedTokens && rows.length > 0 ? (
						<PaginatedTable
							table={table}
							pageSizeOptions={PAGE_SIZE_OPTIONS}
							style={tableStyle}
							tableClassName="min-w-(--tokens-table-min-width)"
							interactionDisabled={isFetching}
							renderSubComponent={(row: Row<typeof tableFeaturesConfig, TokensTableRow>) => (
								<ExpandedTokenMarkets geckoId={row.original.id} symbol={row.original.symbol} />
							)}
						/>
					) : (
						<SurfaceBodyStatus variant="empty" className="p-2" contentClassName="flex flex-col items-center">
							<Icon name="bookmark" height={32} width={32} className="mb-3" />
							<p className="body-sm text-tertiary">
								{hasSavedTokens ? 'No ranking data for your saved tokens' : 'No tokens in your watchlist'}
							</p>
							{!hasSavedTokens ? (
								<p className="mt-1 body-sm text-secondary opacity-75">Use the selector above to add tokens</p>
							) : null}
						</SurfaceBodyStatus>
					)}
				</Card>
			</div>
		</>
	)
}

// The token table scrolls horizontally, so the expanded markets panel is pinned to the left edge of the
// scroll viewport and sized to it — keeping it fully visible instead of stretched across the wide table.
function ExpandedTokenMarkets({ geckoId, symbol }: { geckoId: string; symbol: string }) {
	const [width, setWidth] = useState<number | null>(null)
	const pinToScroller = (panel: HTMLDivElement | null) => {
		const scroller = panel?.closest<HTMLElement>('[data-table-scroller]')
		if (!scroller) return
		const update = () => setWidth(scroller.clientWidth)
		update()
		const observer = new ResizeObserver(update)
		observer.observe(scroller)
		return () => observer.disconnect()
	}

	return (
		<div
			ref={pinToScroller}
			className="sticky left-0 z-10 border-t border-subtle bg-surface"
			style={{ width: width ? `${width}px` : undefined }}
		>
			<TokenMarketsSection geckoId={geckoId} tokenSymbol={symbol} variant="embedded" />
		</div>
	)
}

function TokensPortfolioSelection() {
	const [open, setOpen] = useState(false)
	const newButtonRef = useRef<HTMLButtonElement>(null)
	const { portfolios, selectedPortfolio, addPortfolio, removePortfolio, setSelectedPortfolio } = useBookmarks('tokens')

	return (
		<Card padding="none">
			<TableToolbar>
				<h1 className="mr-auto heading-xs">Portfolio</h1>
				<Menu
					name={selectedPortfolio.length > 100 ? `${selectedPortfolio.substring(0, 100)}...` : selectedPortfolio}
					key={`${selectedPortfolio}-${portfolios.length}`}
					options={portfolios}
					onItemClick={(value) => setSelectedPortfolio(value)}
					className="min-w-[100px]"
				/>
				<NewPortfolioDialog open={open} setOpen={setOpen} portfolios={portfolios} onCreate={addPortfolio} />
				<Button ref={newButtonRef} type="button" onClick={() => setOpen(true)} size="md" title="Create new portfolio">
					<Icon name="folder-plus" height={16} width={16} />
					<span>New</span>
				</Button>
				<DeletePortfolioButton portfolio={selectedPortfolio} onDelete={removePortfolio} finalFocus={newButtonRef} />
			</TableToolbar>
		</Card>
	)
}
