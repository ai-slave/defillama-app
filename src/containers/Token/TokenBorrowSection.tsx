import type { SortingState } from '@tanstack/react-table'
import * as React from 'react'
import { FilterBetweenRange } from '~/components/Filters/FilterBetweenRange'
import { ResponsiveFilterLayout } from '~/components/Filters/ResponsiveFilterLayout'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { RouteTableRow } from '~/containers/Yields/data/types'
import { PaginatedBorrowRoutesTable } from '~/containers/Yields/Tables/Borrow'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { nestedMenuActionStyles } from '~/ui/Popover'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { InlineStatus, LoadingIndicator, SurfaceBodyStatus } from '~/ui/Status'
import { TableToolbar } from '~/ui/Toolbar'
import { DEFAULT_TABLE_PAGE_SIZE } from './tableUtils'
import { filterBorrowRoutes } from './TokenBorrowSection.utils'
import { TokenDeferredPaginationControls } from './TokenDeferredPaginationControls'
import type { TokenBorrowRoutesHydration } from './types'
import { useTokenBorrowRoutes } from './useTokenBorrowRoutes'

const TOKEN_BORROW_SECTION_ID = 'token-borrow'
// Token borrow routes default to net-APY DESC (the strongest carry).
// `net_apy` is the routes table column id.
const DEFAULT_BORROW_TABLE_SORTING: SortingState = [{ id: 'net_apy', desc: true }]
const DEFAULT_BORROW_TABLE_SORTING_KEY = JSON.stringify(DEFAULT_BORROW_TABLE_SORTING)

type BorrowTabKey = 'use' | 'borrow'
type BorrowTabFilters = {
	selectedChains: string[] | null
	minAvailable: string
	maxAvailable: string
}

function getBorrowChainList(rows: RouteTableRow[]) {
	return [...new Set(rows.map((row) => row.chains[0]).filter((chain): chain is string => Boolean(chain)))].sort()
}

function getSelectedChains(selectedChains: string[] | null, availableChains: string[]) {
	return selectedChains == null ? availableChains : selectedChains.filter((chain) => availableChains.includes(chain))
}

function formatAvailableTriggerValue(value: string) {
	const numericValue = Number(value)
	return Number.isFinite(numericValue) ? numericValue.toLocaleString() : value
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
	nestedMenu?: boolean
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
	const [shouldFetchFullData, setShouldFetchFullData] = React.useState(hydration == null)
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
	const tokenKeys = hydration?.tokenKeys ?? []
	const { data, error } = useTokenBorrowRoutes(tokenKeys, { enabled: shouldFetchFullData })
	const useRows = React.useMemo(() => data?.useAsCollateral ?? hydration?.data.useAsCollateral ?? [], [data, hydration])
	const borrowRows = React.useMemo(() => data?.borrowThis ?? hydration?.data.borrowThis ?? [], [data, hydration])
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
	const totalCount = React.useMemo(() => {
		if (data) {
			return activeTab === 'use' ? useRows.length : borrowRows.length
		}

		return activeTab === 'use'
			? (hydration?.counts.useAsCollateral ?? useRows.length)
			: (hydration?.counts.borrowThis ?? borrowRows.length)
	}, [activeTab, borrowRows.length, data, hydration, useRows.length])
	const selectedChains = React.useMemo(
		() => getSelectedChains(activeFilters.selectedChains, chainList),
		[activeFilters.selectedChains, chainList]
	)
	const minAvailable = activeFilters.minAvailable
	const maxAvailable = activeFilters.maxAvailable

	const setSelectedChains = React.useCallback(
		(value: React.SetStateAction<string[] | null>) => {
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
		!data &&
		!error &&
		(shouldFetchFullData ||
			(hasPartialData && (hasActiveFilters || hasNonDefaultSorting || requestedPageIndexByTab[activeTab] > 0)))
	const showInitialLoader = isFetchingFullData && rows.length === 0
	const showBackgroundLoading = isFetchingFullData && rows.length > 0
	const hasPlaceholderState = showInitialLoader || (error != null && rows.length === 0) || totalCount === 0
	const tabLabel = activeTab === 'use' ? `Use ${tokenSymbol}` : `Borrow ${tokenSymbol}`
	const summaryText =
		filteredRows.length > 0
			? hasPartialData && !hasActiveFilters
				? `Showing ${filteredRows.length} of ${totalCount} ${totalCount === 1 ? 'route' : 'routes'}`
				: `Tracking ${filteredRows.length} ${filteredRows.length === 1 ? 'route' : 'routes'}`
			: null

	React.useEffect(() => {
		if ((hasActiveFilters || hasNonDefaultSorting) && !shouldFetchFullData) {
			setShouldFetchFullData(true)
		}
	}, [hasActiveFilters, hasNonDefaultSorting, shouldFetchFullData])

	const requestFullDataPage = React.useCallback(
		(pageIndex: number) => {
			setRequestedPageIndexByTab((prev) => ({
				...prev,
				[activeTab]: pageIndex
			}))
			setShouldFetchFullData(true)
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
			if (hasPartialData && !data) {
				setShouldFetchFullData(true)
			}
		},
		[activeTab, data, hasPartialData]
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
					<TableToolbar>
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
						/>
					</TableToolbar>
					{showInitialLoader ? (
						<div className="flex flex-1 items-center justify-center">
							<LoadingIndicator />
						</div>
					) : error && rows.length === 0 ? (
						<div className="flex flex-1 items-center justify-center px-4 text-center">
							<p className="body-sm text-secondary">{error.message}</p>
						</div>
					) : rows.length === 0 ? (
						<div className="flex flex-1 items-center justify-center px-4 text-center">
							<p className="body-sm text-secondary">
								{activeTab === 'use'
									? `No borrow routes found using ${tokenSymbol} as collateral.`
									: `No routes found to borrow ${tokenSymbol} with supported collateral.`}
							</p>
						</div>
					) : (
						<>
							<TableToolbar>
								<ResponsiveFilterLayout desktopClassName="hidden min-h-8 flex-wrap gap-1.5 sm:flex">
									{(nestedMenu) => (
										<>
											<SelectWithCombobox
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
											{hasActiveFilters && nestedMenu ? (
												<button type="button" onClick={resetFilters} className={nestedMenuActionStyles}>
													Reset filters
												</button>
											) : hasActiveFilters ? (
												<Button type="button" size="md" onClick={resetFilters}>
													Reset filters
												</Button>
											) : null}
										</>
									)}
								</ResponsiveFilterLayout>
							</TableToolbar>
							{error ? <InlineStatus variant="error">{error.message}</InlineStatus> : null}

							{filteredRows.length === 0 && !isFetchingFullData ? (
								<SurfaceBodyStatus variant="empty">{`No ${tabLabel.toLowerCase()} routes match current filters.`}</SurfaceBodyStatus>
							) : (
								<div className="relative flex flex-col gap-3">
									<PaginatedBorrowRoutesTable
										key={`${activeTab}-${data ? 'full' : 'initial'}-${requestedPageIndexByTab[activeTab]}-${sortingKey}`}
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
