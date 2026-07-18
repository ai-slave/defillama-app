import { useQuery } from '@tanstack/react-query'
import {
	type ExpandedState,
	getCoreRowModel,
	getExpandedRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type Row,
	type SortingState,
	useReactTable
} from '@tanstack/react-table'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { DialogForm } from '~/components/DialogForm'
import { BasicLink } from '~/components/Link'
import { Menu } from '~/components/Menu'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { selectTriggerStyles } from '~/components/Select/types'
import { PaginatedTable } from '~/components/Table/PaginatedTable'
import type { TokenMarketsListResponse } from '~/containers/Markets/api.types'
import { TokenMarketsSection } from '~/containers/Token/TokenMarketsSection'
import {
	buildTokensColumns,
	getRankColumnWidth,
	TOKENS_MARKETS_EXPANDER_COLUMN_WIDTH,
	TOKENS_TABLE_WIDTH_EXCLUDING_RANK
} from '~/containers/Tokens'
import { useWatchlistTokensTable } from '~/containers/Tokens/queries.client'
import type { TokensTableRow } from '~/containers/Tokens/types'
import { WatchListTabs } from '~/containers/Yields/views/WatchlistView'
import { DEFAULT_PORTFOLIO_NAME } from '~/contexts/LocalStorage'
import { useBookmarks } from '~/hooks/useBookmarks'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { fetchJson } from '~/utils/async'
import { mergeMarketsSummary } from './marketsMerge'

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const
const DEFAULT_SORTING: SortingState = [{ id: 'marketCap', desc: true }]

export interface TokenUniverseEntry {
	id: string
	name: string
	symbol: string
}

export function TokensWatchlistContainer({ tokenUniverse }: { tokenUniverse: TokenUniverseEntry[] }) {
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

	const handleTokenSelection = (selectedValues: string[]) => {
		const currentSet = new Set(savedTokenIds)
		const newSet = new Set(selectedValues)
		const toAdd = selectedValues.filter((id) => !currentSet.has(id))
		for (const id of toAdd) addProtocol(id)
		for (const id of savedTokenIds) if (!newSet.has(id)) removeProtocol(id)

		if (toAdd.length > 0) {
			const label = toAdd.length === 1 ? (tokenNameById.get(toAdd[0]) ?? toAdd[0]) : `${toAdd.length} tokens`
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

	const { data, isLoading, isFetching } = useWatchlistTokensTable(savedTokenIds)
	const { data: marketsList } = useQuery({
		queryKey: ['tokens-markets-summary'],
		queryFn: () => fetchJson<TokenMarketsListResponse>('/api/public/markets/tokens'),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: false,
		enabled: savedTokenIds.length > 0
	})
	const rows = useMemo(() => {
		const base = savedTokenIds.length ? (data?.rows ?? []) : []
		return mergeMarketsSummary(base, marketsList)
	}, [data?.rows, savedTokenIds.length, marketsList])

	const columns = useMemo(() => buildTokensColumns({ expandable: true }), [])
	const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING)
	const [expanded, setExpanded] = useState<ExpandedState>({})

	const table = useReactTable({
		data: rows,
		columns,
		state: { sorting, expanded },
		onSortingChange: setSorting,
		onExpandedChange: setExpanded,
		getRowId: (row) => row.id,
		getRowCanExpand: () => true,
		enableSortingRemoval: false,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getExpandedRowModel: getExpandedRowModel(),
		getPaginationRowModel: getPaginationRowModel()
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
				<Card padding="none">
					<div className="flex flex-wrap items-center gap-2 p-2">
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
					</div>
					{hasSavedTokens && isLoading ? (
						<SurfaceBodyLoadingStatus className="p-2" />
					) : hasSavedTokens && rows.length ? (
						<PaginatedTable
							table={table}
							pageSizeOptions={PAGE_SIZE_OPTIONS}
							style={tableStyle}
							tableClassName="min-w-(--tokens-table-min-width)"
							shell="none"
							interactionDisabled={isFetching}
							renderSubComponent={(row: Row<TokensTableRow>) => <ExpandedTokenMarkets symbol={row.original.symbol} />}
						/>
					) : (
						<SurfaceBodyStatus variant="empty" className="p-2" contentClassName="flex flex-col items-center">
							<Icon name="bookmark" height={32} width={32} className="mb-3" />
							<p className="body-sm text-tertiary">No tokens in your watchlist</p>
							<p className="mt-1 body-sm text-secondary opacity-75">Use the selector above to add tokens</p>
						</SurfaceBodyStatus>
					)}
				</Card>
			</div>
		</>
	)
}

// The token table scrolls horizontally, so the expanded markets panel is pinned to the left edge of the
// scroll viewport and sized to it — keeping it fully visible instead of stretched across the wide table.
function ExpandedTokenMarkets({ symbol }: { symbol: string }) {
	const ref = useRef<HTMLDivElement>(null)
	const [width, setWidth] = useState<number | null>(null)

	useEffect(() => {
		const el = ref.current
		if (!el) return
		const scroller = el.closest('[data-table-scroller]') as HTMLElement | null
		if (!scroller) return
		const update = () => setWidth(scroller.clientWidth)
		update()
		const observer = new ResizeObserver(update)
		observer.observe(scroller)
		return () => observer.disconnect()
	}, [])

	return (
		<div
			ref={ref}
			className="sticky left-0 z-10 border-t border-subtle bg-surface"
			style={{ width: width ? `${width}px` : undefined }}
		>
			<TokenMarketsSection tokenSymbol={symbol} variant="embedded" />
		</div>
	)
}

function TokensPortfolioSelection() {
	const [open, setOpen] = useState(false)
	const { portfolios, selectedPortfolio, addPortfolio, removePortfolio, setSelectedPortfolio } = useBookmarks('tokens')

	return (
		<Card padding="none">
			<div className="flex flex-wrap items-center gap-2 p-2">
				<h1 className="mr-auto heading-xs">Portfolio</h1>
				<Menu
					name={selectedPortfolio.length > 100 ? selectedPortfolio.substring(0, 100) + '...' : selectedPortfolio}
					key={`${selectedPortfolio}-${portfolios.length}`}
					options={portfolios}
					onItemClick={(value) => setSelectedPortfolio(value)}
					className={`${selectTriggerStyles('filter-responsive', 'md')} min-w-[100px]`}
				/>
				<DialogForm
					title="New Portfolio"
					description="Enter the name of your new portfolio"
					open={open}
					setOpen={setOpen}
					onSubmit={addPortfolio}
				/>
				<Button type="button" onClick={() => setOpen(true)} size="md" title="Create new portfolio">
					<Icon name="folder-plus" height={16} width={16} />
					<span>New</span>
				</Button>
				{selectedPortfolio !== DEFAULT_PORTFOLIO_NAME ? (
					<button
						type="button"
						onClick={() => removePortfolio(selectedPortfolio)}
						className="flex min-h-8 items-center gap-1 rounded-lg border border-data-down px-3 py-1.5 label-sm text-data-down hover:bg-hover-row focus-visible:bg-hover-row"
						title="Delete current portfolio"
					>
						<Icon name="trash-2" height={16} width={16} />
						<span>Delete</span>
					</button>
				) : null}
			</div>
		</Card>
	)
}
