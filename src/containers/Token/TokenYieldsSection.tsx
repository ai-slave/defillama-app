/**
 * Token page Yields (Earn) section.
 *
 * - SSR hydration and browser full-data requests use one population, `TOKEN_PAGE_EARN_QUERY`: the resolved asset keys,
 *   `tokenMatch=contains`, `tokenOn=both` and meme pools included. Pagination, sorting and filtering never fall back
 *   to the general Yields defaults (`tokenMatch=exact`, `tokenOn=reference`, meme pools excluded).
 * - The directory's `hasEarn` and `hasBorrow` flags gate the SSR Yields lookups independently and never affect page
 *   discovery. With neither flag the page acquires no Yields snapshot; with both, Earn and Borrow share one snapshot
 *   handle. Each section still needs matching rows to show.
 * - Browser refreshes acquire current data and are not pinned to the SSR snapshot.
 * - A failed full-data load keeps the existing rows and offers Retry beside the section error, or in the error
 *   placeholder when there are no rows. Retry shows loading, blocks duplicate requests and keeps the page and sorting.
 */

import { useQuery } from '@tanstack/react-query'
import type { SortingState } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { ResetFiltersButton } from '~/components/Filters/ResetFiltersButton'
import { ResponsiveFilterLayout } from '~/components/Filters/ResponsiveFilterLayout'
import { TVLRange } from '~/components/Filters/TVLRange'
import { YIELD_EARN_DATASET_API, YIELD_EARN_PRIVATE_API } from '~/containers/Yields/constants'
import { TOKEN_PAGE_EARN_QUERY } from '~/containers/Yields/data/tokenPageQuery'
import { APYRange } from '~/containers/Yields/Filters/APYRange'
import { FilterByChain } from '~/containers/Yields/Filters/Chains'
import { resolveEarnColumnAccess } from '~/containers/Yields/Filters/columnOptions'
import { useFormatYieldQueryParams } from '~/containers/Yields/hooks'
import type { IYieldTableRow } from '~/containers/Yields/Tables/types'
import { useVerifiedAccess } from '~/containers/Yields/useVerifiedAccess'
import { useIsClient } from '~/hooks/useIsClient'
import { Icon } from '~/ui/Icon'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { InlineStatus, SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { TableToolbarControlGroup } from '~/ui/Toolbar'
import { fetchJson, handleSimpleFetchResponse } from '~/utils/async'
import { pushShallowQuery } from '~/utils/routerQuery'
import { DeferredPaginatedYieldsPoolTable } from './deferred/DeferredPaginatedYieldsPoolTable'
import { DEFAULT_TABLE_PAGE_SIZE } from './tableUtils'
import { TokenDataRetry } from './TokenDataRetry'
import { TokenDeferredPaginationControls } from './TokenDeferredPaginationControls'
import {
	filterTokenYieldPools,
	formatTokenYieldsSummary,
	hasActiveTokenYieldsFilters,
	TOKEN_YIELDS_FILTER_QUERY_PARAMS
} from './TokenYieldsSection.utils'
import type { TokenYieldsHydration } from './types'
import { getTokenYieldStats } from './yieldStats'

const TOKEN_YIELDS_SECTION_ID = 'token-yields'
const DEFAULT_TABLE_SORTING: SortingState = [{ id: 'tvl', desc: true }]
const DEFAULT_TABLE_SORTING_KEY = JSON.stringify(DEFAULT_TABLE_SORTING)
const EMPTY_YIELD_TABLE_ROWS: Array<IYieldTableRow> = []

type EarnRowsResponse = { rows: Array<IYieldTableRow> }
type AuthorizedFetch = ReturnType<typeof useVerifiedAccess>['authorizedFetch']

// A subscriber reads the private mirror, whose rows carry the measured APY and exit outcome;
// everyone else reads the public, redacted document.
async function fetchTokenYieldRows(
	tokenKeys: Array<string>,
	authorizedFetch: AuthorizedFetch | null
): Promise<Array<IYieldTableRow>> {
	const params = new URLSearchParams(TOKEN_PAGE_EARN_QUERY)
	for (const key of tokenKeys) params.append('token', key)
	if (!authorizedFetch) {
		const data = await fetchJson<EarnRowsResponse>(`${YIELD_EARN_DATASET_API}?${params.toString()}`)
		return data.rows
	}
	const res = await authorizedFetch(`${YIELD_EARN_PRIVATE_API}?${params.toString()}`)
	if (!res) throw new Error('Authentication required')
	const data = (await handleSimpleFetchResponse(res).then((r) => r.json())) as EarnRowsResponse
	return data.rows
}

interface TokenYieldsSectionProps {
	hydration?: TokenYieldsHydration
}

export function TokenYieldsSection({ hydration }: TokenYieldsSectionProps) {
	const router = useRouter()
	const isClient = useIsClient()
	const [requestedPageIndex, setRequestedPageIndex] = React.useState(0)
	const [tableSorting, setTableSorting] = React.useState<SortingState>([...DEFAULT_TABLE_SORTING])
	const hasActiveFilters = React.useMemo(() => hasActiveTokenYieldsFilters(router.query), [router.query])
	const tableSortingKey = React.useMemo(() => JSON.stringify(tableSorting), [tableSorting])
	const hasNonDefaultSorting = tableSortingKey !== DEFAULT_TABLE_SORTING_KEY
	const { authorizedFetch, hasAccess: paid, isPending, isDenied } = useVerifiedAccess()
	const { defaultColumns } = resolveEarnColumnAccess({ hasAccess: paid, initialVerifiedAccess: false, isDenied })
	// Without a hydration snapshot there is nothing to show but the full dataset. With one, the snapshot
	// stands until the reader needs more than it holds — a filter, a different sort or a later page — and
	// only a mounted client can want that, since the server has no reader yet. The snapshot is the
	// public tier, so a subscriber always needs the private rows.
	const needsFullData =
		hydration == null || paid || (isClient && (hasActiveFilters || hasNonDefaultSorting || requestedPageIndex > 0))

	const tokenKeys = hydration?.tokenKeys ?? []
	const {
		data: fetchedRows,
		error,
		isFetching,
		isFetched,
		refetch
	} = useQuery({
		// Tier in the key: a lapsed subscription must not read the paid entry.
		queryKey: ['token-yields', 'token-page', TOKEN_PAGE_EARN_QUERY, paid, ...tokenKeys],
		queryFn: () => fetchTokenYieldRows(tokenKeys, paid ? authorizedFetch : null),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: false,
		// Not while the tier is unknown: a public fetch then would be waste for a subscriber.
		enabled: tokenKeys.length > 0 && needsFullData && !isPending
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

	const filtered = React.useMemo(
		() =>
			filterTokenYieldPools({
				pools: poolsList,
				chainCount: chainList.length,
				selectedChains,
				minTvl,
				maxTvl,
				minApy,
				maxApy
			}),
		[chainList.length, maxApy, maxTvl, minApy, minTvl, poolsList, selectedChains]
	)
	const filteredPools = filtered.pools
	// Until the full rows load, the snapshot's chips cover every pool; the first page alone would not.
	const quickPicks = fetchedRows || !hydration ? filtered : hydration

	const filteredStats = React.useMemo(() => {
		return getTokenYieldStats(filteredPools)
	}, [filteredPools])

	const hasPartialData = !fetchedRows && totalRowCount > poolsList.length
	const isFetchingFullData =
		isFetching ||
		(!error &&
			!fetchedRows &&
			!needsFullData &&
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

	const resetFilters = () => {
		const updates: Record<string, undefined> = {}
		for (const key of TOKEN_YIELDS_FILTER_QUERY_PARAMS) {
			updates[key] = undefined
		}
		pushShallowQuery(router, updates)
	}

	const isFilteredEmpty = filteredPools.length === 0 && totalRowCount > 0 && !isFetchingFullData
	const hasPlaceholderState =
		showInitialLoader || (showRetry && poolsList.length === 0) || (totalRowCount === 0 && !isFetchingFullData)
	const summaryText = formatTokenYieldsSummary({
		stats: filteredStats,
		totalRowCount,
		isPartial: hasPartialData && !hasActiveFilters
	})

	const requestFullDataPage = React.useCallback((pageIndex: number) => {
		setRequestedPageIndex(pageIndex)
	}, [])

	const handleSortingChange = React.useCallback((sortingState: SortingState) => {
		setTableSorting(sortingState)
		setRequestedPageIndex(0)
	}, [])

	return (
		// tabIndex: the deferred pager hands focus here when the full table replaces it.
		<Panel padding="none" tabIndex={-1} className={hasPlaceholderState ? 'min-h-[80dvh] sm:min-h-[572px]' : undefined}>
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
						<TableToolbarControlGroup>
							<ResponsiveFilterLayout desktopClassName="hidden min-h-8 flex-wrap gap-1.5 sm:flex">
								{(nestedMenu) => (
									<>
										<FilterByChain chainList={chainList} nestedMenu={nestedMenu} size="md" />
										<TVLRange
											label="TVL"
											variant="secondary"
											nestedMenu={nestedMenu}
											size="md"
											quickPicks={quickPicks.tvlQuickPicks}
										/>
										<APYRange nestedMenu={nestedMenu} size="md" quickPicks={quickPicks.apyQuickPicks} />
										<ResetFiltersButton nestedMenu={nestedMenu} onClick={resetFilters} disabled={!hasActiveFilters}>
											Reset filters
										</ResetFiltersButton>
									</>
								)}
							</ResponsiveFilterLayout>
						</TableToolbarControlGroup>
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
										loadingLabel="Loading full dataset…"
										appearance="embedded"
										defaultColumns={defaultColumns}
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
