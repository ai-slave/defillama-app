import { useQuery } from '@tanstack/react-query'
import type { SortingState } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { ResponsiveFilterLayout } from '~/components/Filters/ResponsiveFilterLayout'
import { TVLRange } from '~/components/Filters/TVLRange'
import { YIELD_EARN_DATASET_API } from '~/containers/Yields/constants'
import { TOKEN_PAGE_EARN_QUERY } from '~/containers/Yields/data/tokenPageQuery'
import { APYRange } from '~/containers/Yields/Filters/APYRange'
import { FilterByChain } from '~/containers/Yields/Filters/Chains'
import { useFormatYieldQueryParams } from '~/containers/Yields/hooks'
import type { IYieldTableRow } from '~/containers/Yields/Tables/types'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { nestedMenuActionStyles } from '~/ui/Popover'
import { InlineStatus, SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { TableToolbar } from '~/ui/Toolbar'
import { fetchJson } from '~/utils/async'
import { formatPercent } from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'
import { DeferredPaginatedYieldsPoolTable } from './deferred/DeferredPaginatedYieldsPoolTable'
import { DEFAULT_TABLE_PAGE_SIZE } from './tableUtils'
import { TokenDataRetry } from './TokenDataRetry'
import { TokenDeferredPaginationControls } from './TokenDeferredPaginationControls'
import type { TokenYieldsHydration } from './types'
import { getTokenYieldStats } from './yieldStats'

// Client-side chain/TVL/APY filters over the earn rows (the rows are already
// scoped to the page token server-side via the resolved token option keys).
const FILTER_QUERY_PARAMS = ['chain', 'excludeChain', 'minTvl', 'maxTvl', 'minApy', 'maxApy']

const TOKEN_YIELDS_SECTION_ID = 'token-yields'
const DEFAULT_TABLE_SORTING: SortingState = [{ id: 'tvl', desc: true }]
const DEFAULT_TABLE_SORTING_KEY = JSON.stringify(DEFAULT_TABLE_SORTING)
const EMPTY_YIELD_TABLE_ROWS: Array<IYieldTableRow> = []

type EarnRowsResponse = { rows: Array<IYieldTableRow> }

async function fetchTokenYieldRows(tokenKeys: Array<string>): Promise<Array<IYieldTableRow>> {
	const params = new URLSearchParams(TOKEN_PAGE_EARN_QUERY)
	for (const key of tokenKeys) params.append('token', key)
	const data = await fetchJson<EarnRowsResponse>(`${YIELD_EARN_DATASET_API}?${params.toString()}`)
	return data.rows
}

interface TokenYieldsSectionProps {
	hydration?: TokenYieldsHydration
}

export function TokenYieldsSection({ hydration }: TokenYieldsSectionProps) {
	const router = useRouter()
	const [shouldFetchFullData, setShouldFetchFullData] = React.useState(hydration == null)
	const [requestedPageIndex, setRequestedPageIndex] = React.useState(0)
	const [tableSorting, setTableSorting] = React.useState<SortingState>([...DEFAULT_TABLE_SORTING])
	const tokenKeys = hydration?.tokenKeys ?? []
	const {
		data: fetchedRows,
		error,
		isFetching,
		isFetched,
		refetch
	} = useQuery({
		queryKey: ['token-yields', 'token-page', TOKEN_PAGE_EARN_QUERY, ...tokenKeys],
		queryFn: () => fetchTokenYieldRows(tokenKeys),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: false,
		enabled: tokenKeys.length > 0 && shouldFetchFullData
	})
	const poolsList = fetchedRows ?? hydration?.rows ?? EMPTY_YIELD_TABLE_ROWS
	const hydrationPageSize = hydration?.pageSize ?? DEFAULT_TABLE_PAGE_SIZE
	const totalRowCount = fetchedRows?.length ?? hydration?.rowCount ?? poolsList.length

	const chainList = React.useMemo(
		() =>
			fetchedRows
				? [
						...new Set(poolsList.map((pool) => pool.chains[0]).filter((chain): chain is string => Boolean(chain)))
					].sort()
				: (hydration?.chainList ??
					[
						...new Set(poolsList.map((pool) => pool.chains[0]).filter((chain): chain is string => Boolean(chain)))
					].sort()),
		[fetchedRows, hydration, poolsList]
	)

	const { selectedChains, minTvl, maxTvl, minApy, maxApy } = useFormatYieldQueryParams({ chainList })

	const filteredPools = React.useMemo(() => {
		let pools = poolsList

		if (selectedChains.length > 0 && selectedChains.length < chainList.length) {
			const chainSet = new Set(selectedChains)
			pools = pools.filter((pool) => chainSet.has(pool.chains[0]))
		}

		if (minTvl != null) {
			pools = pools.filter((pool) => pool.tvl != null && pool.tvl >= minTvl)
		}
		if (maxTvl != null) {
			pools = pools.filter((pool) => pool.tvl != null && pool.tvl <= maxTvl)
		}

		if (minApy != null) {
			pools = pools.filter((pool) => pool.apy != null && pool.apy >= minApy)
		}
		if (maxApy != null) {
			pools = pools.filter((pool) => pool.apy != null && pool.apy <= maxApy)
		}

		return pools
	}, [chainList.length, maxApy, maxTvl, minApy, minTvl, poolsList, selectedChains])

	const filteredStats = React.useMemo(() => {
		return getTokenYieldStats(filteredPools)
	}, [filteredPools])

	const hasActiveFilters = React.useMemo(
		() =>
			FILTER_QUERY_PARAMS.some((key) => {
				const value = router.query[key]
				return Array.isArray(value) ? value.length > 0 : value != null && value !== ''
			}),
		[router.query]
	)
	const hasPartialData = !fetchedRows && totalRowCount > poolsList.length
	const tableSortingKey = React.useMemo(() => JSON.stringify(tableSorting), [tableSorting])
	const hasNonDefaultSorting = tableSortingKey !== DEFAULT_TABLE_SORTING_KEY
	const isFetchingFullData =
		isFetching ||
		(!error &&
			!fetchedRows &&
			!shouldFetchFullData &&
			hasPartialData &&
			(hasActiveFilters || hasNonDefaultSorting || requestedPageIndex > 0))
	const showRetry = error != null || (isFetching && isFetched && !fetchedRows)
	const retryStatus = showRetry ? (
		<TokenDataRetry
			message={error?.message ?? 'Loading full dataset…'}
			isRetrying={isFetching}
			onRetry={() => {
				void refetch({ cancelRefetch: false })
			}}
		/>
	) : null
	const showInitialLoader = isFetchingFullData && poolsList.length === 0 && !showRetry
	const showBackgroundLoading = isFetchingFullData && poolsList.length > 0

	React.useEffect(() => {
		// Deliberately after commit: the server renders the hydration snapshot, and only the mounted client
		// switches to the full dataset. Setting this during render would change the server markup.
		if ((hasActiveFilters || hasNonDefaultSorting) && !shouldFetchFullData) {
			// oxlint-disable-next-line react/set-state-in-effect -- see above
			setShouldFetchFullData(true)
		}
	}, [hasActiveFilters, hasNonDefaultSorting, shouldFetchFullData])

	const resetFilters = () => {
		const updates: Record<string, undefined> = {}
		for (const key of FILTER_QUERY_PARAMS) {
			updates[key] = undefined
		}
		pushShallowQuery(router, updates)
	}

	const isFilteredEmpty = filteredPools.length === 0 && totalRowCount > 0 && !isFetchingFullData
	const hasPlaceholderState =
		showInitialLoader || (showRetry && poolsList.length === 0) || (totalRowCount === 0 && !isFetchingFullData)
	const summaryText =
		filteredStats.noOfPoolsTracked > 0
			? hasPartialData && !hasActiveFilters
				? `Showing ${filteredStats.noOfPoolsTracked} of ${totalRowCount} ${totalRowCount > 1 ? 'pools' : 'pool'}`
				: `Tracking ${filteredStats.noOfPoolsTracked} ${filteredStats.noOfPoolsTracked > 1 ? 'pools' : 'pool'}${
						filteredStats.averageAPY != null
							? `, average APY ${formatPercent(filteredStats.averageAPY, { input: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
							: ''
					}`
			: null

	const requestFullDataPage = React.useCallback((pageIndex: number) => {
		setRequestedPageIndex(pageIndex)
		setShouldFetchFullData(true)
	}, [])

	const handleSortingChange = React.useCallback(
		(sortingState: SortingState) => {
			setTableSorting(sortingState)
			setRequestedPageIndex(0)
			if (hasPartialData && !fetchedRows) {
				setShouldFetchFullData(true)
			}
		},
		[fetchedRows, hasPartialData]
	)

	return (
		<Panel padding="none" className={hasPlaceholderState ? 'min-h-[80dvh] sm:min-h-[572px]' : undefined}>
			<PanelHeader>
				<PanelTitle
					className="group relative flex min-w-0 scroll-mt-24 items-center gap-1"
					id={TOKEN_YIELDS_SECTION_ID}
				>
					Yields
					<a
						aria-hidden="true"
						tabIndex={-1}
						href={`#${TOKEN_YIELDS_SECTION_ID}`}
						className="absolute top-0 right-0 z-10 flex size-full items-center"
					/>
					<Icon name="link" className="invisible size-3.5 group-hover:visible group-focus-visible:visible" />
				</PanelTitle>
				{!showInitialLoader && !error && summaryText ? (
					<p className="body-sm text-secondary sm:text-right">{summaryText}</p>
				) : null}
			</PanelHeader>

			<div className="flex flex-1 flex-col gap-2 p-2">
				{showInitialLoader ? (
					<SurfaceBodyLoadingStatus />
				) : showRetry && poolsList.length === 0 ? (
					<SurfaceBodyStatus variant="error">{retryStatus}</SurfaceBodyStatus>
				) : poolsList.length === 0 ? (
					<SurfaceBodyStatus variant="empty">No yield pools found.</SurfaceBodyStatus>
				) : (
					<div className="flex flex-1 flex-col">
						<TableToolbar>
							<ResponsiveFilterLayout desktopClassName="hidden min-h-8 flex-wrap gap-1.5 sm:flex">
								{(nestedMenu) => (
									<>
										<FilterByChain
											chainList={chainList}
											selectedChains={selectedChains}
											nestedMenu={nestedMenu}
											size="md"
										/>
										<TVLRange label="TVL" variant="secondary" nestedMenu={nestedMenu} size="md" />
										<APYRange nestedMenu={nestedMenu} size="md" />
										{hasActiveFilters ? (
											nestedMenu ? (
												<button type="button" onClick={resetFilters} className={nestedMenuActionStyles}>
													Reset filters
												</button>
											) : (
												<Button type="button" size="md" onClick={resetFilters}>
													Reset filters
												</Button>
											)
										) : null}
									</>
								)}
							</ResponsiveFilterLayout>
						</TableToolbar>
						{showRetry ? <InlineStatus variant="error">{retryStatus}</InlineStatus> : null}

						{isFilteredEmpty ? (
							<SurfaceBodyStatus variant="empty">No pools match current filters</SurfaceBodyStatus>
						) : (
							<div className="relative flex flex-col gap-3">
								<React.Suspense fallback={<div className="min-h-[360px]" />}>
									<DeferredPaginatedYieldsPoolTable
										key={`${fetchedRows ? 'full' : 'initial'}-${requestedPageIndex}`}
										data={filteredPools}
										initialPageSize={hydrationPageSize}
										initialPageIndex={fetchedRows ? requestedPageIndex : 0}
										sortingState={tableSorting}
										onSortingChange={handleSortingChange}
										interactionDisabled={showBackgroundLoading}
										loadingLabel="Loading full dataset..."
										appearance="embedded"
									/>
								</React.Suspense>
								{hasPartialData && !hasActiveFilters ? (
									<div className={showBackgroundLoading ? 'opacity-60' : ''}>
										<TokenDeferredPaginationControls
											totalCount={totalRowCount}
											pageSize={hydrationPageSize}
											isLoading={showBackgroundLoading}
											onRequestPage={requestFullDataPage}
										/>
									</div>
								) : null}
							</div>
						)}
					</div>
				)}
			</div>
		</Panel>
	)
}
