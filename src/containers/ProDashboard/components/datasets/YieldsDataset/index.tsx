import * as React from 'react'
import { useProDashboardEditorActions } from '../../../ProDashboardAPIContext'
import { LoadingSpinner } from '../../LoadingSpinner'
import { TableBody } from '../../ProTable/TableBody'
import { TablePagination } from '../../ProTable/TablePagination'
import type { ProYieldRow } from './data'
import { useYieldsData } from './useYieldsData'
import { useYieldsTable } from './useYieldsTable'
import { YieldsColumnManagementPanel } from './YieldsColumnManagementPanel'
import { type YieldsFilters, YieldsFiltersPanel } from './YieldsFiltersPanel'
import { YieldsTableHeader } from './YieldsTableHeader'

const EMPTY_YIELDS_ROWS: ProYieldRow[] = []

interface YieldsDatasetProps {
	chains?: string[]
	tableId?: string
	columnOrder?: string[]
	columnVisibility?: Record<string, boolean>
	filters?: YieldsFilters
}

export function YieldsDataset({
	chains,
	tableId,
	columnOrder: initialColumnOrder,
	columnVisibility: initialColumnVisibility,
	filters: savedFilters
}: YieldsDatasetProps) {
	const { data, isLoading, error } = useYieldsData(chains)
	const { handleTableColumnsChange, handleTableFiltersChange } = useProDashboardEditorActions()

	const [fallbackTableId] = React.useState(() => `yields-table-${Date.now()}`)
	const uniqueTableId = tableId || fallbackTableId

	const {
		table,
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
		onColumnsChange: React.useMemo(() => {
			if (!uniqueTableId) return undefined
			return (order: string[], visibility: Record<string, boolean>) => {
				handleTableColumnsChange(uniqueTableId, order, visibility, [])
			}
		}, [handleTableColumnsChange, uniqueTableId]),
		onFiltersChange: React.useMemo(() => {
			if (!uniqueTableId) return undefined
			return (nextFilters: YieldsFilters) => {
				handleTableFiltersChange(uniqueTableId, nextFilters)
			}
		}, [handleTableFiltersChange, uniqueTableId])
	})

	return (
		<div className="isolate flex h-full w-full flex-col p-4">
			<YieldsTableHeader
				chains={chains}
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
				<div className="flex min-h-[500px] flex-1 flex-col items-center justify-center gap-4">
					<LoadingSpinner />
					<p className="text-sm pro-text2">Loading yields data...</p>
				</div>
			) : error ? (
				<div className="flex min-h-[500px] flex-1 items-center justify-center">
					<div className="text-center pro-text2">Failed to load yields data</div>
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

					<TablePagination table={table} />
				</>
			)}
		</div>
	)
}

const NOOP = () => {}
