import * as React from 'react'
import { TablePager } from '~/components/Table/TablePager'
import type { YieldsFilters } from '~/containers/ProDashboard/types'
import { queryReadFailed, queryRefreshFailed } from '~/utils/query'
import type { ProYieldRow } from '../../../yieldData'
import { ProCardError, ProCardLoading, ProCardRefreshFailed } from '../../ProCardStatus'
import { TABLE_PAGE_SIZES, TableBody } from '../../Table/TableBody'
import { useYieldsData } from './useYieldsData'
import { useYieldsTable } from './useYieldsTable'
import { YieldsColumnManagementPanel } from './YieldsColumnManagementPanel'
import { YieldsFiltersPanel } from './YieldsFiltersPanel'
import { YieldsTableHeader } from './YieldsTableHeader'

const EMPTY_YIELDS_ROWS: Array<ProYieldRow> = []

interface YieldsDatasetProps {
	chains?: Array<string>
	columnOrder?: Array<string>
	columnVisibility?: Record<string, boolean>
	filters?: YieldsFilters
	onColumnsChange?: (columnOrder: Array<string>, columnVisibility: Record<string, boolean>) => void
	onFiltersChange?: (filters: YieldsFilters) => void
}

export function YieldsDataset({
	chains,
	columnOrder: initialColumnOrder,
	columnVisibility: initialColumnVisibility,
	filters: savedFilters,
	onColumnsChange = NOOP_COLUMNS_CHANGE,
	onFiltersChange = NOOP_FILTERS_CHANGE
}: YieldsDatasetProps) {
	const { query: yieldsQuery, isLoading } = useYieldsData(chains)
	const { data } = yieldsQuery
	const readFailed = queryReadFailed(yieldsQuery)
	// The header's controls act on rows, so they stay inert until rows load.
	const unavailable = isLoading || readFailed

	const {
		table,
		pageIndex,
		pageSize,
		pageCount,
		setPageIndex,
		setPageSize,
		rowCount,
		showColumnPanel,
		setShowColumnPanel,
		searchTerm,
		setSearchTerm,
		currentColumns,
		columnOrder,
		toggleColumnVisibility,
		moveColumnUp,
		moveColumnDown,
		columnPresets,
		applyPreset,
		activePreset,
		downloadCSV,
		poolName,
		setPoolName,
		showFiltersPanel,
		setShowFiltersPanel,
		filters,
		setFilters,
		availableProtocols,
		availableTokens,
		availableCategories,
		activeFilterCount,
		applyFilters,
		resetFilters
	} = useYieldsTable({
		data: data ?? EMPTY_YIELDS_ROWS,
		initialColumnOrder,
		initialColumnVisibility,
		initialFilters: savedFilters,
		onColumnsChange,
		onFiltersChange
	})

	const filtersToggleRef = React.useRef<HTMLButtonElement>(null)
	const columnsToggleRef = React.useRef<HTMLButtonElement>(null)

	return (
		<div className="isolate flex h-full w-full flex-col">
			<YieldsTableHeader
				columnPresets={columnPresets}
				applyPreset={applyPreset}
				activePreset={activePreset}
				showColumnPanel={!unavailable && showColumnPanel}
				setShowColumnPanel={unavailable ? NOOP : setShowColumnPanel}
				downloadCSV={unavailable ? undefined : downloadCSV}
				poolName={unavailable ? '' : poolName}
				setPoolName={unavailable ? NOOP : setPoolName}
				showFiltersPanel={!unavailable && showFiltersPanel}
				setShowFiltersPanel={unavailable ? NOOP : setShowFiltersPanel}
				activeFilterCount={unavailable ? 0 : activeFilterCount}
				filtersToggleRef={filtersToggleRef}
				columnsToggleRef={columnsToggleRef}
			/>

			{readFailed ? (
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col justify-center">
					<ProCardError title="Couldn't load yields data" retry={yieldsQuery} />
				</div>
			) : isLoading ? (
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col p-3">
					<ProCardLoading variant="table" label="Loading yields data" />
				</div>
			) : (
				<>
					<YieldsColumnManagementPanel
						showColumnPanel={showColumnPanel}
						setShowColumnPanel={setShowColumnPanel}
						searchTerm={searchTerm}
						setSearchTerm={setSearchTerm}
						currentColumns={currentColumns}
						columnOrder={columnOrder}
						toggleColumnVisibility={toggleColumnVisibility}
						moveColumnUp={moveColumnUp}
						moveColumnDown={moveColumnDown}
						toggleRef={columnsToggleRef}
					/>

					{showFiltersPanel ? (
						<YieldsFiltersPanel
							setShowFiltersPanel={setShowFiltersPanel}
							filters={filters}
							setFilters={setFilters}
							availableProtocols={availableProtocols}
							availableTokens={availableTokens}
							availableCategories={availableCategories}
							onApplyFilters={applyFilters}
							onResetFilters={resetFilters}
							activeFilterCount={activeFilterCount}
							toggleRef={filtersToggleRef}
						/>
					) : null}

					{queryRefreshFailed(yieldsQuery) ? <ProCardRefreshFailed retry={yieldsQuery} /> : null}
					<TableBody table={table} />
					<TablePager
						pageIndex={pageIndex}
						pageCount={pageCount}
						onPageChange={setPageIndex}
						pageSize={rowCount > 10 ? { value: pageSize, options: TABLE_PAGE_SIZES, onChange: setPageSize } : undefined}
						className="mt-2 justify-between"
					/>
				</>
			)}
		</div>
	)
}

const NOOP = () => {}
const NOOP_COLUMNS_CHANGE = (_columnOrder: Array<string>, _columnVisibility: Record<string, boolean>) => {}
const NOOP_FILTERS_CHANGE = (_filters: YieldsFilters) => {}
