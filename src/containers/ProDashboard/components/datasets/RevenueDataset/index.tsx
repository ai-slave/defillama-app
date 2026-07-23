import type { TableFilters } from '../../../types'
import { DimensionDatasetTable } from '../DimensionDatasetTable'
import { revenueDatasetColumns } from './columns'

interface RevenueDatasetProps {
	chains?: string[]
	tableId?: string
	filters?: TableFilters
}

export function RevenueDataset({ chains, tableId, filters }: RevenueDatasetProps) {
	const title = chains?.length ? `${chains.join(', ')} Revenue` : 'Protocol Revenue'
	return (
		<DimensionDatasetTable
			datasetType="revenue"
			chains={chains}
			tableId={tableId}
			filters={filters}
			columns={revenueDatasetColumns}
			title={title}
			loadingText="Loading revenue data..."
			errorText="Failed to load revenue data"
			csvFilename="revenue-data.csv"
			csvMetricLabel="Revenue"
			categoryFiltering
			omitChangeColumnsWithChains
			searchInputClassName="border pro-border pro-panel-bg px-3 py-1.5 text-sm text-pro-text-primary focus:ring-1 focus:ring-brand focus:outline-hidden"
		/>
	)
}
