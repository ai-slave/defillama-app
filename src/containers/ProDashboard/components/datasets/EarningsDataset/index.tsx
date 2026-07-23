import type { TableFilters } from '../../../types'
import { DimensionDatasetTable } from '../DimensionDatasetTable'
import { earningsDatasetColumns } from './columns'

interface EarningsDatasetProps {
	chains?: string[]
	tableId?: string
	filters?: TableFilters
}

export function EarningsDataset({ chains, tableId, filters }: EarningsDatasetProps) {
	const title = chains?.length ? `${chains.join(', ')} Earnings` : 'Protocol Earnings'
	return (
		<DimensionDatasetTable
			datasetType="earnings"
			chains={chains}
			tableId={tableId}
			filters={filters}
			columns={earningsDatasetColumns}
			title={title}
			loadingText="Loading earnings data..."
			errorText="Failed to load earnings data"
			csvFilename="earnings-data.csv"
			csvMetricLabel="Earnings"
			categoryFiltering
			omitChangeColumnsWithChains
			searchInputClassName="rounded-md border pro-border bg-pro-glass-bg px-3 py-1.5 text-sm text-pro-text-primary transition-colors focus:border-brand focus:outline-hidden"
		/>
	)
}
