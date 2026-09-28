import type { SortingState } from '@tanstack/react-table'
import * as React from 'react'
import { FilterBetweenRange } from '~/components/Filters/FilterBetweenRange'
import { ResetFiltersButton } from '~/components/Filters/ResetFiltersButton'
import { ResponsiveFilterLayout } from '~/components/Filters/ResponsiveFilterLayout'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { RouteTableRow } from '~/containers/Yields/data/types'
import { useIsClient } from '~/hooks/useIsClient'
import type { FormSubmitEvent } from '~/types/forms'
import { Icon } from '~/ui/Icon'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { InlineStatus, LoadingIndicator, SurfaceBodyStatus } from '~/ui/Status'
import { TableToolbarControlGroup } from '~/ui/Toolbar'
import { formatNumber } from '~/utils/numberFormat'
import { DeferredPaginatedBorrowRoutesTable } from './deferred/DeferredPaginatedBorrowRoutesTable'
import { DEFAULT_TABLE_PAGE_SIZE } from './tableUtils'
import { filterBorrowRoutes, formatBorrowRoutesSummary } from './TokenBorrowSection.utils'
import { TokenDataRetry } from './TokenDataRetry'
import { TokenDeferredPaginationControls } from './TokenDeferredPaginationControls'
import type { TokenBorrowRoutesHydration } from './types'
import { useTokenBorrowRoutes } from './useTokenBorrowRoutes'

const TOKEN_BORROW_SECTION_ID = 'token-borrow'
// Token borrow routes default to net-APY DESC (the strongest carry).
// `net_apy` is the routes table column id.
const DEFAULT_BORROW_TABLE_SORTING: SortingState = [{ id: 'net_apy', desc: true }]
const DEFAULT_BORROW_TABLE_SORTING_KEY = JSON.stringify(DEFAULT_BORROW_TABLE_SORTING)
const EMPTY_ROUTE_TABLE_ROWS: Array<RouteTableRow> = []

type BorrowTabKey = 'use' | 'borrow'
type BorrowTabFilters = {
	selectedChains: Array<string> | null
	minAvailable: string
	maxAvailable: string
}

function getBorrowChainList(rows: Array<RouteTableRow>) {
	return [...new Set(rows.map((row) => row.chains[0]).filter((chain): chain is string => Boolean(chain)))].sort()
}

function getSelectedChains(selectedChains: Array<string> | null, availableChains: Array<string>) {
	return selectedChains == null ? availableChains : selectedChains.filter((chain) => availableChains.includes(chain))
}

function formatAvailableTriggerValue(value: string) {
	const numericValue = Number(value)
	return Number.isFinite(numericValue) ? formatNumber(numericValue) : value
}

function TokenBorrowAvailableRange({
	minAvailable,
	maxAvailable,
	setMinAvailable,
	setMaxAvailable,
	nestedMenu
}: {
	minAvailable: string
	maxAvailable: string
	setMinAvailable: React.Dispatch<React.SetStateAction<string>>
	setMaxAvailable: React.Dispatch<React.SetStateAction<string>>
	nestedMenu: boolean
}) {
	const handleSubmit = (event: FormSubmitEvent) => {
		event.preventDefault()
		const form = event.currentTarget

		setMinAvailable(form.min?.value ?? '')
		setMaxAvailable(form.max?.value ?? '')
	}

	const handleClear = () => {
		setMinAvailable('')
		setMaxAvailable('')
	}

	const hasRange = minAvailable !== '' || maxAvailable !== ''

	return (
		<FilterBetweenRange
			heading="Available"
			trigger={
				hasRange ? (
					<>
						<span>Available: </span>
						<span className="text-link">{`${minAvailable !== '' ? formatAvailableTriggerValue(minAvailable) : 'min'} - ${
							maxAvailable !== '' ? formatAvailableTriggerValue(maxAvailable) : 'max'
						}`}</span>
					</>
				) : (
					<span>Available</span>
				)
			}
			variant="secondary"
			onSubmit={handleSubmit}
			onClear={handleClear}
			nestedMenu={nestedMenu}
			size="md"
			min={minAvailable}
			max={maxAvailable}
			minLabel="Min Available"
			maxLabel="Max Available"
			minInputProps={{ inputMode: 'decimal', placeholder: '0' }}
			maxInputProps={{ inputMode: 'decimal', placeholder: 'Any' }}
			placement="bottom-start"
		/>
	)
}

export function TokenBorrowSection({
	tokenSymbol,
	hydration
}: {
	tokenSymbol: string
	hydration?: TokenBorrowRoutesHydration
}) {
	const [activeTab, setActiveTab] = React.useState<BorrowTabKey>('use')

	const isClient = useIsClient()
	const [requestedPageIndexByTab, setRequestedPageIndexByTab] = React.useState<Record<BorrowTabKey, number>>({
		use: 0,
		borrow: 0
	})
	const [sortingByTab, setSortingByTab] = React.useState<Record<BorrowTabKey, SortingState>>({
		use: [...DEFAULT_BORROW_TABLE_SORTING],
		borrow: [...DEFAULT_BORROW_TABLE_SORTING]
	})
	const [filtersByTab, setFiltersByTab] = React.useState<Record<BorrowTabKey, BorrowTabFilters>>({
		use: {
			selectedChains: null,
			minAvailable: '',
			maxAvailable: ''
		},
		borrow: {
			selectedChains: null,
			minAvailable: '',
			maxAvailable: ''
		}
	})
	// What the reader typed, independent of the chain list the response defines: the display predicate below
	// compares against that list, but the decision to fetch cannot wait for it.
	const tabFilterInput = filtersByTab[activeTab]
	const hasFilterInput =
		tabFilterInput.selectedChains != null || tabFilterInput.minAvailable !== '' || tabFilterInput.maxAvailable !== ''
	const sortingInputKey = JSON.stringify(sortingByTab[activeTab])
	// Without a hydration snapshot there is nothing to show but the full dataset. With one, the snapshot
	// stands until the reader needs more than it holds, and only a mounted client can want that.
	const needsFullData =
		hydration == null ||
		(isClient &&
			(hasFilterInput ||
				sortingInputKey !== DEFAULT_BORROW_TABLE_SORTING_KEY ||
				requestedPageIndexByTab[activeTab] > 0))

	const tokenKeys = hydration?.tokenKeys ?? []
	const { data, error, isFetching, isFetched, refetch } = useTokenBorrowRoutes(tokenKeys, {
		enabled: needsFullData
	})
	const useRows = data?.useAsCollateral ?? hydration?.data.useAsCollateral ?? EMPTY_ROUTE_TABLE_ROWS
	const borrowRows = data?.borrowThis ?? hydration?.data.borrowThis ?? EMPTY_ROUTE_TABLE_ROWS
	const useChainList = React.useMemo(
		() => (data ? getBorrowChainList(useRows) : (hydration?.chainLists.useAsCollateral ?? getBorrowChainList(useRows))),
		[data, hydration, useRows]
	)
	const borrowChainList = React.useMemo(
		() =>
			data ? getBorrowChainList(borrowRows) : (hydration?.chainLists.borrowThis ?? getBorrowChainList(borrowRows)),
		[data, hydration, borrowRows]
	)
	const hydrationPageSize = hydration?.pageSize ?? DEFAULT_TABLE_PAGE_SIZE

	const activeFilters = filtersByTab[activeTab]
	const rows = activeTab === 'use' ? useRows : borrowRows
	const chainList = activeTab === 'use' ? useChainList : borrowChainList
	const totalCount = data
		? activeTab === 'use'
			? useRows.length
			: borrowRows.length
		: activeTab === 'use'
			? (hydration?.counts.useAsCollateral ?? useRows.length)
			: (hydration?.counts.borrowThis ?? borrowRows.length)
	const selectedChains = React.useMemo(
		() => getSelectedChains(activeFilters.selectedChains, chainList),
		[activeFilters.selectedChains, chainList]
	)
	const minAvailable = activeFilters.minAvailable
	const maxAvailable = activeFilters.maxAvailable

	const setSelectedChains = React.useCallback(
		(value: React.SetStateAction<Array<string> | null>) => {
			setFiltersByTab((prev) => ({
				...prev,
				[activeTab]: {
					...prev[activeTab],
					selectedChains: typeof value === 'function' ? value(prev[activeTab].selectedChains) : value
				}
			}))
		},
		[activeTab]
	)

	const setMinAvailable = React.useCallback(
		(value: React.SetStateAction<string>) => {
			setFiltersByTab((prev) => ({
				...prev,
				[activeTab]: {
					...prev[activeTab],
					minAvailable: typeof value === 'function' ? value(prev[activeTab].minAvailable) : value
				}
			}))
		},
		[activeTab]
	)

	const setMaxAvailable = React.useCallback(
		(value: React.SetStateAction<string>) => {
			setFiltersByTab((prev) => ({
				...prev,
				[activeTab]: {
					...prev[activeTab],
					maxAvailable: typeof value === 'function' ? value(prev[activeTab].maxAvailable) : value
				}
			}))
		},
		[activeTab]
	)

	const filteredRows = React.useMemo(
		() =>
			filterBorrowRoutes({
				rows,
				selectedChains,
				minAvailable,
				maxAvailable
			}),
		[maxAvailable, minAvailable, rows, selectedChains]
	)

	const hasActiveFilters = selectedChains.length !== chainList.length || minAvailable !== '' || maxAvailable !== ''
	const resetFilters = React.useCallback(() => {
		setSelectedChains(null)
		setMinAvailable('')
		setMaxAvailable('')
	}, [setMaxAvailable, setMinAvailable, setSelectedChains])
	const hasPartialData = !data && totalCount > rows.length
	const sortingKey = React.useMemo(() => JSON.stringify(sortingByTab[activeTab]), [activeTab, sortingByTab])
	const hasNonDefaultSorting = sortingKey !== DEFAULT_BORROW_TABLE_SORTING_KEY
	const isFetchingFullData =
		isFetching ||
		(!error &&
			!data &&
			!needsFullData &&
			hasPartialData &&
			(hasActiveFilters || hasNonDefaultSorting || requestedPageIndexByTab[activeTab] > 0))
	const showRetry = error != null || (isFetching && isFetched && !data)
	const retryStatus = showRetry ? (
		<TokenDataRetry
			message={error?.message ?? 'Loading full dataset…'}
			isRetrying={isFetching}
			onRetry={() => {
				void refetch({ cancelRefetch: false })
			}}
		/>
	) : null
	const showInitialLoader = isFetchingFullData && rows.length === 0 && !showRetry
	const showBackgroundLoading = isFetchingFullData && rows.length > 0
	const hasPlaceholderState = showInitialLoader || (showRetry && rows.length === 0) || totalCount === 0
	const tabLabel = activeTab === 'use' ? `Use ${tokenSymbol}` : `Borrow ${tokenSymbol}`
	const summaryText = formatBorrowRoutesSummary({
		shownCount: filteredRows.length,
		totalCount,
		isPartial: hasPartialData && !hasActiveFilters
	})

	const requestFullDataPage = React.useCallback(
		(pageIndex: number) => {
			setRequestedPageIndexByTab((prev) => ({
				...prev,
				[activeTab]: pageIndex
			}))
		},
		[activeTab]
	)

	const handleSortingChange = React.useCallback(
		(sortingState: SortingState) => {
			setSortingByTab((prev) => ({
				...prev,
				[activeTab]: sortingState
			}))
			setRequestedPageIndexByTab((prev) => ({
				...prev,
				[activeTab]: 0
			}))
		},
		[activeTab]
	)

	return (
		<Panel padding="none" className={hasPlaceholderState ? 'min-h-[80dvh] sm:min-h-[572px]' : undefined}>
			<PanelHeader>
				<PanelTitle
					className="group relative flex min-w-0 scroll-mt-24 items-center gap-1"
					id={TOKEN_BORROW_SECTION_ID}
				>
					Borrow
					<a
						aria-hidden="true"
						tabIndex={-1}
						href={`#${TOKEN_BORROW_SECTION_ID}`}
						className="absolute top-0 right-0 z-10 flex size-full items-center"
					/>
					<Icon name="link" className="invisible size-3.5 group-hover:visible group-focus-visible:visible" />
				</PanelTitle>
				{!showInitialLoader && !error && summaryText ? (
					<p className="body-sm text-secondary sm:text-right">{summaryText}</p>
				) : null}
			</PanelHeader>

			<div className="flex flex-1 flex-col gap-2 p-2">
				<div className="flex flex-1 flex-col gap-2">
					<TableToolbarControlGroup>
						<SegmentedControl
							value={activeTab}
							onValueChange={(value) => setActiveTab(value as typeof activeTab)}
							options={[
								{ value: 'use', label: `Use ${tokenSymbol}` },
								{ value: 'borrow', label: `Borrow ${tokenSymbol}` }
							]}
							label="Borrow view"
							variant="default"
							size="md"
							className="mr-auto"
						/>
					</TableToolbarControlGroup>
					{showInitialLoader ? (
						<div className="flex flex-1 items-center justify-center">
							<LoadingIndicator />
						</div>
					) : showRetry && rows.length === 0 ? (
						<div className="flex flex-1 items-center justify-center px-4 text-center">{retryStatus}</div>
					) : rows.length === 0 ? (
						<div className="flex flex-1 items-center justify-center px-4 text-center">
							<p role="status" className="body-sm text-tertiary">
								{activeTab === 'use'
									? `No borrow routes found using ${tokenSymbol} as collateral.`
									: `No routes found to borrow ${tokenSymbol} with supported collateral.`}
							</p>
						</div>
					) : (
						<>
							<TableToolbarControlGroup>
								<ResponsiveFilterLayout desktopClassName="hidden min-h-8 flex-wrap gap-1.5 sm:flex">
									{(nestedMenu) => (
										<>
											<SelectWithCombobox
												heading="Chains"
												label="Chains"
												allValues={chainList}
												selectedValues={selectedChains}
												setSelectedValues={setSelectedChains}
												nestedMenu={nestedMenu}
												variant="default"
												size="md"
												labelType={selectedChains.length === chainList.length ? 'none' : 'regular'}
											/>
											<TokenBorrowAvailableRange
												minAvailable={minAvailable}
												maxAvailable={maxAvailable}
												setMinAvailable={setMinAvailable}
												setMaxAvailable={setMaxAvailable}
												nestedMenu={nestedMenu}
											/>
											<ResetFiltersButton nestedMenu={nestedMenu} onClick={resetFilters} disabled={!hasActiveFilters}>
												Reset filters
											</ResetFiltersButton>
										</>
									)}
								</ResponsiveFilterLayout>
							</TableToolbarControlGroup>
							{showRetry ? <InlineStatus variant="error">{retryStatus}</InlineStatus> : null}

							{filteredRows.length === 0 && !isFetchingFullData ? (
								<SurfaceBodyStatus variant="empty">{`No ${tabLabel.toLowerCase()} routes match current filters.`}</SurfaceBodyStatus>
							) : (
								<div className="relative flex flex-col gap-3">
									<React.Suspense fallback={<div className="min-h-[360px]" />}>
										<DeferredPaginatedBorrowRoutesTable
											key={`${activeTab}-${data ? 'full' : 'initial'}-${requestedPageIndexByTab[activeTab]}`}
											data={filteredRows}
											manualPagination={false}
											manualSorting={false}
											initialPageSize={hydrationPageSize}
											initialPageIndex={data ? requestedPageIndexByTab[activeTab] : 0}
											sortingState={sortingByTab[activeTab]}
											onSortingChange={handleSortingChange}
											interactionDisabled={showBackgroundLoading}
											loadingLabel="Loading full dataset..."
											appearance="embedded"
										/>
									</React.Suspense>
									{hasPartialData && !hasActiveFilters ? (
										<div className={showBackgroundLoading ? 'opacity-60' : ''}>
											<TokenDeferredPaginationControls
												totalCount={totalCount}
												pageSize={hydrationPageSize}
												isLoading={showBackgroundLoading}
												onRequestPage={requestFullDataPage}
											/>
										</div>
									) : null}
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</Panel>
	)
}
