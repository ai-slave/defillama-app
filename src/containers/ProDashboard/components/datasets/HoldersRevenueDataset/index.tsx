import type { TableFilters } from '../../../types'
import { DimensionDatasetTable } from '../DimensionDatasetTable'
import { holdersRevenueDatasetColumns } from './columns'

interface HoldersRevenueDatasetProps {
	chains?: string[]
	tableId?: string
	filters?: TableFilters
}

export function HoldersRevenueDataset({ chains, tableId, filters }: HoldersRevenueDatasetProps) {
	const title = chains?.length ? `${chains.join(', ')} Holders Revenue` : 'Holders Revenue'
	return (
		<DimensionDatasetTable
			datasetType="holders-revenue"
			chains={chains}
			tableId={tableId}
			filters={filters}
			columns={holdersRevenueDatasetColumns}
			title={title}
			loadingText="Loading holders revenue data..."
			errorText="Failed to load holders revenue data"
			csvFilename="holders-revenue-data.csv"
			csvMetricLabel="Holders Revenue"
			categoryFiltering
			omitChangeColumnsWithChains
			searchInputClassName="rounded-md border pro-border bg-pro-glass-bg px-3 py-1.5 text-sm text-pro-text-primary transition-colors focus:border-brand focus:outline-hidden"
		/>
	)
}
