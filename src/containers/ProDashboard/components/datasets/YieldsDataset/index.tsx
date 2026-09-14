import * as React from 'react'
import type { YieldsFilters } from '~/containers/ProDashboard/types'
import type { ProYieldRow } from '../../../yieldData'
import { ProCardLoading } from '../../ProCardStatus'
import { TableBody } from '../../Table/TableBody'
import { TablePagination } from '../../Table/TablePagination'
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
	const { data, isLoading, error } = useYieldsData(chains)

	const {
		table,
		pageIndex,
		pageSize,
		pageCount,
		canPreviousPage,
		canNextPage,
		previousPage,
		nextPage,
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

	return (
		<div className="isolate flex h-full w-full flex-col">
			<YieldsTableHeader
				columnPresets={columnPresets}
				applyPreset={applyPreset}
				activePreset={activePreset}
				showColumnPanel={!isLoading && !error && showColumnPanel}
				setShowColumnPanel={isLoading || error ? NOOP : setShowColumnPanel}
				downloadCSV={isLoading || error ? undefined : downloadCSV}
				poolName={isLoading || error ? '' : poolName}
				setPoolName={isLoading || error ? NOOP : setPoolName}
				showFiltersPanel={!isLoading && !error && showFiltersPanel}
				setShowFiltersPanel={isLoading || error ? NOOP : setShowFiltersPanel}
				activeFilterCount={isLoading || error ? 0 : activeFilterCount}
			/>

			{isLoading ? (
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 flex-col p-3">
					<ProCardLoading variant="table" label="Loading yields data…" />
				</div>
			) : error ? (
				<div className="flex min-h-[calc(500px*var(--card-scale,1))] flex-1 items-center justify-center">
					<div className="text-center text-pro-text-secondary">Failed to load yields data</div>
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
						/>
					) : null}

					<TableBody table={table} />
					<TablePagination
						pageSize={pageSize}
						pageIndex={pageIndex}
						pageCount={pageCount}
						canPreviousPage={canPreviousPage}
						canNextPage={canNextPage}
						previousPage={previousPage}
						nextPage={nextPage}
						setPageSize={setPageSize}
						showPageSizes={rowCount > 10}
					/>
				</>
			)}
		</div>
	)
}

const NOOP = () => {}
const NOOP_COLUMNS_CHANGE = (_columnOrder: Array<string>, _columnVisibility: Record<string, boolean>) => {}
const NOOP_FILTERS_CHANGE = (_filters: YieldsFilters) => {}
