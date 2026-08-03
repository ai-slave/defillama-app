import { lazy } from 'react'
import type { DatasetTableConfig } from '../types'

const CexAnalyticsDataset = lazy(() =>
	import('./datasets/CexAnalyticsDataset').then((module) => ({ default: module.CexAnalyticsDataset }))
)
const ChainsDataset = lazy(() =>
	import('./datasets/ChainsDataset').then((module) => ({ default: module.ChainsDataset }))
)
const EquitiesCompaniesDataset = lazy(() =>
	import('./datasets/EquitiesDataset/EquitiesCompaniesDataset').then((module) => ({
		default: module.EquitiesCompaniesDataset
	}))
)
const EquitiesFilingsDataset = lazy(() =>
	import('./datasets/EquitiesDataset/EquitiesFilingsDataset').then((module) => ({
		default: module.EquitiesFilingsDataset
	}))
)
const EquitiesFinancialsDataset = lazy(() =>
	import('./datasets/EquitiesDataset/EquitiesFinancialsDataset').then((module) => ({
		default: module.EquitiesFinancialsDataset
	}))
)
const RWAAssetsDataset = lazy(() =>
	import('./datasets/RWADataset/RWAAssetsDataset').then((module) => ({ default: module.RWAAssetsDataset }))
)
const RWAChainAssetsDataset = lazy(() =>
	import('./datasets/RWADataset/RWAAssetsDataset').then((module) => ({ default: module.RWAChainAssetsDataset }))
)
const RWAChainsDataset = lazy(() =>
	import('./datasets/RWADataset/RWAChainsDataset').then((module) => ({ default: module.RWAChainsDataset }))
)
const StablecoinsDataset = lazy(() =>
	import('./datasets/StablecoinsDataset').then((module) => ({ default: module.StablecoinsDataset }))
)
const TokenUsageDataset = lazy(() =>
	import('./datasets/TokenUsageDataset').then((module) => ({ default: module.TokenUsageDataset }))
)
const YieldsDataset = lazy(() =>
	import('./datasets/YieldsDataset').then((module) => ({ default: module.YieldsDataset }))
)

interface DatasetTableCardProps {
	config: DatasetTableConfig
	onConfigChange?: (config: DatasetTableConfig) => void
}

export function DatasetTableCard({ config, onConfigChange }: DatasetTableCardProps) {
	if (config.datasetType === 'cex-analytics') return <CexAnalyticsDataset config={config} />
	if (config.datasetType === 'token-usage')
		return onConfigChange ? (
			<TokenUsageDataset config={config} editable onConfigChange={onConfigChange} />
		) : (
			<TokenUsageDataset config={config} editable={false} />
		)
	if (config.datasetType === 'yields')
		return (
			<div className="relative" style={{ isolation: 'isolate' }}>
				<YieldsDataset
					chains={config.chains}
					{...(config.columnOrder !== undefined ? { columnOrder: config.columnOrder } : {})}
					{...(config.columnVisibility !== undefined ? { columnVisibility: config.columnVisibility } : {})}
					{...(config.filters !== undefined ? { filters: config.filters } : {})}
					{...(onConfigChange
						? {
								onColumnsChange: (columnOrder, columnVisibility) =>
									onConfigChange({ ...config, columnOrder, columnVisibility }),
								onFiltersChange: (filters) => onConfigChange({ ...config, filters })
							}
						: {})}
				/>
			</div>
		)
	if (config.datasetType === 'chains')
		return (
			<ChainsDataset
				{...(config.category !== undefined ? { category: config.category } : {})}
				{...(config.columnOrder !== undefined ? { columnOrder: config.columnOrder } : {})}
				{...(config.columnVisibility !== undefined ? { columnVisibility: config.columnVisibility } : {})}
				{...(onConfigChange
					? {
							onColumnsChange: (columnOrder, columnVisibility) =>
								onConfigChange({ ...config, columnOrder, columnVisibility })
						}
					: {})}
			/>
		)
	if (config.datasetType === 'rwa') return <RWAAssetsDataset />
	if (config.datasetType === 'rwa-chains') return <RWAChainsDataset />
	if (config.datasetType === 'rwa-selected-chain') return <RWAChainAssetsDataset chain={config.chain} />
	if (config.datasetType === 'equities') return <EquitiesCompaniesDataset />
	if (config.datasetType === 'equities-financials') return <EquitiesFinancialsDataset ticker={config.ticker} />
	if (config.datasetType === 'equities-filings') return <EquitiesFilingsDataset ticker={config.ticker} />
	if (config.datasetType === 'stablecoins') return <StablecoinsDataset chain={config.chain} />

	const exhaustiveDataset: never = config
	return exhaustiveDataset
}
