import { DimensionDatasetTable } from '../DimensionDatasetTable'
import { feesDatasetColumns } from './columns'

export function FeesDataset({ chains }: { chains?: string[] }) {
	const title = chains?.length ? `${chains.join(', ')} Fees` : 'Protocol Fees'
	return (
		<DimensionDatasetTable
			datasetType="fees"
			chains={chains}
			columns={feesDatasetColumns}
			title={title}
			loadingText="Loading fees data..."
			errorText="Failed to load fees data"
			csvFilename="fees-data.csv"
			csvMetricLabel="Fees"
			categoryFiltering={false}
			omitChangeColumnsWithChains={false}
			searchInputClassName="rounded-md border pro-border bg-pro-glass-bg px-3 py-1.5 text-sm text-pro-text-primary transition-colors focus:border-brand focus:outline-hidden"
		/>
	)
}
