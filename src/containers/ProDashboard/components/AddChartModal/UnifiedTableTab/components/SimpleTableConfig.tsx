import { useMemo, useState } from 'react'
import { useAuthContext } from '~/auth'
import {
	VirtualizedMultiSelect,
	VirtualizedSelect,
	type VirtualizedSelectOption
} from '~/components/Select/VirtualizedSelect'
import type { CexAnalyticsMetric, CexAnalyticsView } from '~/containers/Cexs/api.types'
import { createDatasetTableConfig } from '~/containers/ProDashboard/dashboardConfig/datasetTableConfig'
import type { CexDatasetTableConfig } from '~/containers/ProDashboard/types'
import { Button } from '~/ui/Button'
import { Checkbox } from '~/ui/Checkbox'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { CexAnalyticsDataset } from '../../../datasets/CexAnalyticsDataset'
import { useEquitiesTickerOptions } from '../../../datasets/EquitiesDataset/useEquitiesTickerOptions'
import { useTokenSearch } from '../../../datasets/TokenUsageDataset/useTokenSearch'
import type { CombinedTableType } from '../../types'

interface SimpleTableConfigProps {
	selectedChains: Array<string>
	chainOptions: Array<VirtualizedSelectOption>
	protocolsLoading: boolean
	onChainsChange: (values: Array<string>) => void
	selectedDatasetChain: string | null
	onDatasetChainChange: (value: string | null) => void
	selectedCexAnalyticsView: 'starter' | CexAnalyticsView
	onCexAnalyticsViewChange: (view: 'starter' | CexAnalyticsView) => void
	selectedCexAnalyticsMetric: CexAnalyticsMetric
	onCexAnalyticsMetricChange: (metric: CexAnalyticsMetric) => void
	selectedCexAnalyticsTopN: number
	onCexAnalyticsTopNChange: (topN: number) => void
	selectedTableType: CombinedTableType
	onTableTypeChange: (type: CombinedTableType) => void
	selectedTokens: Array<string>
	onTokensChange: (tokens: Array<string>) => void
	includeCex: boolean
	onIncludeCexChange: (include: boolean) => void
	onBackToTypeSelector: () => void
	isEditing?: boolean | undefined
}

const tableTypeOptions: Array<{
	value: CombinedTableType
	label: string
	description: string
}> = [
	{
		value: 'yields',
		label: 'Yields',
		description: 'V2 earn pools with supply APY, TVL, stability, and borrow-market facts'
	},
	{
		value: 'cex-analytics',
		label: 'CEXs',
		description: 'Spot volume, derivatives volume, open interest, leverage, and CEX efficiency'
	},
	{
		value: 'chains',
		label: 'Chains',
		description: 'Blockchain metrics including TVL, users, volume, and fees'
	},
	{
		value: 'stablecoins',
		label: 'Stablecoins',
		description: 'Stablecoin market caps, price stability, and chains'
	},
	{
		value: 'token-usage',
		label: 'Token Usage',
		description: 'Track protocol adoption by token usage'
	},
	{
		value: 'rwa',
		label: 'RWA Assets',
		description: 'Real World Assets with active AUM, onchain AUM, and DeFi TVL'
	},
	{
		value: 'rwa-chains',
		label: 'RWA by chain',
		description: 'RWA metrics aggregated by chain'
	},
	{
		value: 'rwa-selected-chain',
		label: 'RWA on chain',
		description: 'RWA assets on a selected chain'
	},
	{
		value: 'equities',
		label: 'Equities',
		description: 'Stock market companies overview'
	},
	{
		value: 'equities-financials',
		label: 'Equities financials',
		description: 'Income statement, balance sheet & cashflow for a company'
	},
	{
		value: 'equities-filings',
		label: 'Equities filings',
		description: 'SEC filings for a specific company'
	}
]

const CEX_ANALYTICS_VIEW_OPTIONS: Array<{ value: 'starter' | CexAnalyticsView; label: string }> = [
	{ value: 'starter', label: 'Starter preset' },
	{ value: 'summary', label: 'Summary cards' },
	{ value: 'comparison', label: 'Comparison table' },
	{ value: 'spot-vs-derivatives', label: 'Spot vs derivatives chart' },
	{ value: 'market-share', label: 'Market share chart' }
]

const CEX_ANALYTICS_VIEW_OPTIONS_EDIT = CEX_ANALYTICS_VIEW_OPTIONS.filter((option) => option.value !== 'starter')

const CEX_ANALYTICS_METRIC_OPTIONS: Array<{ value: CexAnalyticsMetric; label: string }> = [
	{ value: 'spot', label: 'Spot Volume' },
	{ value: 'derivatives', label: 'Derivatives Volume' }
]

const CEX_ANALYTICS_TOP_N_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: '5', label: 'Top 5' },
	{ value: '8', label: 'Top 8' },
	{ value: '10', label: 'Top 10' },
	{ value: '12', label: 'Top 12' }
]

function CexAnalyticsPreview({
	view,
	metric,
	topN
}: {
	view: 'starter' | CexAnalyticsView
	metric: CexAnalyticsMetric
	topN: number
}) {
	const previewItems = useMemo<Array<CexDatasetTableConfig>>(() => {
		const createConfig = (previewView: CexAnalyticsView, idSuffix: string): CexDatasetTableConfig =>
			createDatasetTableConfig({
				id: `cex-preview-${idSuffix}`,
				datasetType: 'cex-analytics',
				cexAnalyticsView: previewView,
				cexAnalyticsMetric: metric,
				cexAnalyticsTopN: topN
			})

		if (view === 'starter') {
			return [
				createConfig('summary', 'summary'),
				createConfig('comparison', 'comparison'),
				createConfig('spot-vs-derivatives', 'spot-vs-derivatives')
			]
		}

		return [createConfig(view, view)]
	}, [metric, topN, view])

	return (
		<div className="flex flex-col gap-3">
			<div className={`grid gap-4 ${view === 'starter' ? 'xl:grid-cols-2' : 'grid-cols-1'}`}>
				{previewItems.map((config) => {
					const isSummary = config.cexAnalyticsView === 'summary'
					const heightClass = isSummary ? 'max-h-[240px]' : 'max-h-[420px]'

					return (
						<div
							key={config.id}
							className={`${view === 'starter' && isSummary ? 'xl:col-span-2' : ''} overflow-hidden rounded-lg border border-subtle`}
						>
							<div className={`${heightClass} overflow-auto`}>
								<CexAnalyticsDataset config={config} />
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}

const EMPTY_TOKEN_OPTIONS: Array<{ value: string; label: string; logo?: string }> = []
const CHAIN_CATEGORY_OPTIONS = [
	{ value: 'All', label: 'All chains' },
	{ value: 'EVM', label: 'EVM Chains' },
	{ value: 'non-EVM', label: 'Non-EVM Chains' },
	{ value: 'Layer 2', label: 'Layer 2' },
	{ value: 'Rollup', label: 'Rollups' },
	{ value: 'Parachain', label: 'Parachains' },
	{ value: 'Cosmos', label: 'Cosmos' }
]
const PRO_ONLY_TABLE_TYPES = new Set<string>([
	'token-usage',
	'rwa',
	'rwa-chains',
	'rwa-selected-chain',
	'equities',
	'equities-financials',
	'equities-filings'
])

export function SimpleTableConfig({
	selectedChains,
	chainOptions,
	protocolsLoading,
	onChainsChange,
	selectedDatasetChain,
	onDatasetChainChange,
	selectedCexAnalyticsView,
	onCexAnalyticsViewChange,
	selectedCexAnalyticsMetric,
	onCexAnalyticsMetricChange,
	selectedCexAnalyticsTopN,
	onCexAnalyticsTopNChange,
	selectedTableType,
	onTableTypeChange,
	selectedTokens,
	onTokensChange,
	includeCex,
	onIncludeCexChange,
	onBackToTypeSelector,
	isEditing = false
}: SimpleTableConfigProps) {
	const { hasActiveSubscription } = useAuthContext()
	const isEquitiesTickerTable = selectedTableType === 'equities-financials' || selectedTableType === 'equities-filings'
	const { options: equitiesTickerOptions, isLoading: equitiesCompaniesLoading } =
		useEquitiesTickerOptions(isEquitiesTickerTable)
	const [tokenSearchInput, setTokenSearchInput] = useState('')
	const isTokenUsageTable = selectedTableType === 'token-usage'
	const { data: tokenOptionsData, isPlaceholderData: isSearchingTokens } = useTokenSearch(
		tokenSearchInput,
		isTokenUsageTable
	)
	const { data: defaultTokensData } = useTokenSearch('', isTokenUsageTable)
	const tokenOptions = tokenOptionsData ?? EMPTY_TOKEN_OPTIONS
	const defaultTokens = defaultTokensData ?? EMPTY_TOKEN_OPTIONS

	const mergedTokenOptions = useMemo(() => {
		const baseOptions = tokenSearchInput ? tokenOptions : defaultTokens

		if (!selectedTokens || selectedTokens.length === 0) {
			return baseOptions
		}

		const optionMap = new Map(baseOptions.map((opt) => [opt.value, opt]))

		const additionalOptions = selectedTokens
			.filter((token) => !optionMap.has(token))
			.map((token) => ({ value: token, label: token }))

		return [...additionalOptions, ...baseOptions]
	}, [tokenSearchInput, tokenOptions, defaultTokens, selectedTokens])

	const datasetSelectOptions = useMemo(() => {
		return tableTypeOptions.filter((option) => hasActiveSubscription || !PRO_ONLY_TABLE_TYPES.has(option.value))
	}, [hasActiveSubscription])

	const chainCategoryOptions = CHAIN_CATEGORY_OPTIONS
	// A chain filter treats no pick as every chain, so its list leaves out the "All chains" row.
	const chainFilterOptions = useMemo(() => chainOptions.filter((option) => option.value !== 'All'), [chainOptions])

	const tokenOptionMap = useMemo(() => {
		const map = new Map<string, { value: string; label: string; logo?: string }>()
		for (const option of mergedTokenOptions) {
			map.set(option.value, option)
		}
		return map
	}, [mergedTokenOptions])

	return (
		<div className="flex flex-col gap-4">
			<Button variant="link" onClick={onBackToTypeSelector} className="self-start">
				<Icon name="arrow-left" className="size-3.5" />
				Back to table type selection
			</Button>

			<VirtualizedSelect
				variant="field"
				label="Table type"
				options={datasetSelectOptions}
				selectedValue={selectedTableType}
				onChange={(option) => {
					const tableType = tableTypeOptions.find((candidate) => candidate.value === option.value)?.value
					if (!tableType) throw new Error(`Unsupported table type: ${option.value}`)
					onTableTypeChange(tableType)
				}}
				placeholder="Select table type…"
			/>

			{selectedTableType === 'stablecoins' ? (
				<VirtualizedSelect
					variant="field"
					label="Chain"
					options={chainOptions}
					selectedValue={selectedDatasetChain}
					onChange={(option) => onDatasetChainChange(option.value)}
					placeholder="Select chain…"
					isLoading={protocolsLoading}
				/>
			) : selectedTableType === 'yields' ? (
				<VirtualizedMultiSelect
					label="Chains (optional)"
					options={chainFilterOptions}
					selectedValues={selectedChains}
					onChange={onChainsChange}
					isLoading={protocolsLoading}
					placeholder="All chains"
				/>
			) : selectedTableType === 'chains' ? (
				<VirtualizedSelect
					variant="field"
					label="Category (optional)"
					options={chainCategoryOptions}
					selectedValue={selectedDatasetChain}
					onChange={(option) => onDatasetChainChange(option.value)}
					placeholder="All chains…"
				/>
			) : selectedTableType === 'cex-analytics' ? (
				<>
					<VirtualizedSelect
						variant="field"
						label="CEX View"
						options={isEditing ? CEX_ANALYTICS_VIEW_OPTIONS_EDIT : CEX_ANALYTICS_VIEW_OPTIONS}
						selectedValue={selectedCexAnalyticsView}
						onChange={(option) => {
							const view = CEX_ANALYTICS_VIEW_OPTIONS.find((candidate) => candidate.value === option.value)?.value
							if (!view) throw new Error(`Unsupported CEX analytics view: ${option.value}`)
							onCexAnalyticsViewChange(view)
						}}
						placeholder="Select CEX view…"
					/>
					{selectedCexAnalyticsView === 'market-share' ? (
						<>
							<VirtualizedSelect
								variant="field"
								label="Share metric"
								options={CEX_ANALYTICS_METRIC_OPTIONS}
								selectedValue={selectedCexAnalyticsMetric}
								onChange={(option) => {
									const metric = CEX_ANALYTICS_METRIC_OPTIONS.find(
										(candidate) => candidate.value === option.value
									)?.value
									if (!metric) throw new Error(`Unsupported CEX analytics metric: ${option.value}`)
									onCexAnalyticsMetricChange(metric)
								}}
								placeholder="Select metric…"
							/>
							<VirtualizedSelect
								variant="field"
								label="Top CEXs"
								options={CEX_ANALYTICS_TOP_N_OPTIONS}
								selectedValue={String(selectedCexAnalyticsTopN)}
								onChange={(option) => onCexAnalyticsTopNChange(Number(option.value))}
								placeholder="Select top N…"
							/>
						</>
					) : null}
					<div className="mt-1">
						<CexAnalyticsPreview
							view={selectedCexAnalyticsView}
							metric={selectedCexAnalyticsMetric}
							topN={selectedCexAnalyticsTopN}
						/>
					</div>
				</>
			) : selectedTableType === 'token-usage' ? (
				<>
					<VirtualizedMultiSelect
						label="Tokens (up to 4)"
						options={mergedTokenOptions}
						selectedValues={selectedTokens}
						onChange={(values) => onTokensChange(values.slice(0, 4))}
						placeholder="Select tokens…"
						maxSelections={4}
						onSearchChange={setTokenSearchInput}
						isSearching={isSearchingTokens}
					/>
					{selectedTokens.length > 0 ? (
						<div className="mt-2 flex flex-wrap gap-2">
							{selectedTokens.map((token) => {
								const option = tokenOptionMap.get(token)
								return (
									<div key={token} className="inline-flex items-center gap-1.5 rounded-md bg-(--chip-bg) px-2.5 py-1">
										{option?.logo ? (
											<img
												src={option.logo}
												alt=""
												width={16}
												height={16}
												className="size-4 rounded-full"
												onError={(e) => {
													e.currentTarget.style.display = 'none'
												}}
											/>
										) : (
											<div className="size-4 rounded-full bg-surface-elevated-2" />
										)}
										<span className="body-md text-primary">{option?.label ?? token}</span>
										<Tooltip
											content={`Remove ${option?.label ?? token}`}
											render={
												<Button
													variant="ghost"
													size="sm"
													square
													onClick={() => onTokensChange(selectedTokens.filter((t) => t !== token))}
													aria-label={`Remove ${option?.label ?? token}`}
												/>
											}
										>
											<Icon name="x" className="size-4" />
										</Tooltip>
									</div>
								)
							})}
						</div>
					) : null}
					{/* Checkbox takes no className; the wrapper keeps the bordered label at its own width in this column. */}
					<div className="self-start">
						<Checkbox variant="filter" checked={includeCex} onChange={() => onIncludeCexChange(!includeCex)}>
							Include CEXs
						</Checkbox>
					</div>
				</>
			) : selectedTableType === 'rwa-selected-chain' ? (
				<VirtualizedSelect
					variant="field"
					label="Chain"
					options={chainOptions}
					selectedValue={selectedDatasetChain}
					onChange={(option) => onDatasetChainChange(option.value)}
					placeholder="Select chain…"
					isLoading={protocolsLoading}
				/>
			) : selectedTableType === 'equities-financials' || selectedTableType === 'equities-filings' ? (
				<VirtualizedSelect
					variant="field"
					label="Company"
					options={equitiesTickerOptions}
					selectedValue={selectedDatasetChain}
					onChange={(option) => onDatasetChainChange(option.value)}
					placeholder="Select company…"
					isLoading={equitiesCompaniesLoading}
				/>
			) : null}
		</div>
	)
}
