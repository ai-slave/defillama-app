import { useCallback, useMemo } from 'react'
import { Icon } from '~/ui/Icon'
import type { SegmentedControlOption } from '~/ui/SegmentedControl'
import { useAppMetadata } from '../../AppMetadataContext'
import type { ChartRuntimeView } from '../../chartRuntime'
import { useProDashboardCatalog } from '../../ProDashboardAPIContext'
import {
	CHAIN_CHART_TYPES,
	getProDashboardChartTypeConfig,
	PROTOCOL_CHART_TYPES,
	type RWAOverviewChartBreakdown,
	type RWAOverviewChartMetric,
	type RWAOverviewChartView
} from '../../types'
import { ProSegmented, proInputStyles } from '../../ui'
import { AdvancedTvlChartTab } from './AdvancedTvlChartTab'
import { BoundParameterChip, useModalFieldBinding } from './bindingContext'
import { BorrowedChartTab } from './BorrowedChartTab'
import { CategoryCardsGrid } from './CategoryCardsGrid'
import { CategoryFormHeader } from './CategoryFormHeader'
import { ChartCreationModeToggle } from './ChartCreationModeToggle'
import { ChartTypePills } from './ChartTypePills'
import { CombinedChartPreview } from './CombinedChartPreview'
import { EntityPickerList } from './EntityPickerList'
import { IncomeStatementChartTab } from './IncomeStatementChartTab'
import { RWAChartTab } from './RWAChartTab'
import { SelectionFooter } from './SelectionFooter'
import { SeparateChartsPreview } from './SeparateChartsPreview'
import { StablecoinsChartTab } from './StablecoinsChartTab'
import type { ChartTabType } from './types'
import { UnlocksChartTab } from './UnlocksChartTab'
import { YieldsChartTab } from './YieldsChartTab'

const EMPTY_ARRAY: Array<string> = []

const SUBJECT_OPTIONS: Array<SegmentedControlOption<'chain' | 'protocol'>> = [
	{
		value: 'chain',
		label: (
			<span className="inline-flex items-center gap-1.5">
				<Icon name="chain" width={14} height={14} />
				Chains
			</span>
		)
	},
	{
		value: 'protocol',
		label: (
			<span className="inline-flex items-center gap-1.5">
				<Icon name="protocol" width={14} height={14} />
				Protocols
			</span>
		)
	}
]

interface UnifiedChartTabProps {
	selectedChartTab: ChartTabType
	selectedChartTypes: Array<string>
	chainOptions: Array<{ value: string; label: string }>
	protocolOptions: Array<{ value: string; label: string; logo?: string }>
	protocolsLoading: boolean
	unifiedChartName: string
	chartCreationMode: 'separate' | 'combined'
	composerItems: Array<ChartRuntimeView>
	manualFormOpen: boolean
	isEditingItem: boolean
	onSelectCategory: (tab: ChartTabType) => void
	onBackToCategories: () => void
	onChartTabChange: (tab: ChartTabType) => void
	onChartTypesChange: (types: Array<string>) => void
	onBulkChartTypeChange: (nextType: string) => void
	onUnifiedChartNameChange: (name: string) => void
	onChartCreationModeChange: (mode: 'separate' | 'combined') => void
	onComposerItemColorChange: (id: string, color: string) => void
	onAddToComposer: (typesToAdd?: Array<string>, options?: { entity?: string; mode?: 'chain' | 'protocol' }) => void
	onRemoveFromComposer: (id: string) => void
}

interface UnifiedChartTabPropsExtended extends UnifiedChartTabProps {
	selectedYieldPool?: {
		configID: string
		name: string
		project: string
		chain: string
	} | null
	onSelectedYieldPoolChange?: (
		pool: {
			configID: string
			name: string
			project: string
			chain: string
		} | null
	) => void
	selectedYieldChains?: Array<string>
	selectedYieldProjects?: Array<string>
	selectedYieldCategories?: Array<string>
	selectedYieldTokens?: Array<string>
	minTvl?: number | null
	maxTvl?: number | null
	onSelectedYieldChainsChange?: (chains: Array<string>) => void
	onSelectedYieldProjectsChange?: (projects: Array<string>) => void
	onSelectedYieldCategoriesChange?: (categories: Array<string>) => void
	onSelectedYieldTokensChange?: (tokens: Array<string>) => void
	onMinTvlChange?: (tvl: number | null) => void
	onMaxTvlChange?: (tvl: number | null) => void
	selectedYieldChartType?: string
	onSelectedYieldChartTypeChange?: (chartType: string) => void
	selectedStablecoinChain?: string
	selectedStablecoinChartType?: string
	stablecoinMode?: 'chain' | 'asset'
	selectedStablecoinAsset?: string | null
	selectedStablecoinAssetId?: string | null
	selectedStablecoinAssetChartType?: string
	onSelectedStablecoinChainChange?: (chain: string) => void
	onSelectedStablecoinChartTypeChange?: (chartType: string) => void
	onStablecoinModeChange?: (mode: 'chain' | 'asset') => void
	onSelectedStablecoinAssetChange?: (asset: string | null) => void
	onSelectedStablecoinAssetIdChange?: (id: string | null) => void
	onSelectedStablecoinAssetChartTypeChange?: (chartType: string) => void
	selectedAdvancedTvlProtocol?: string | null
	selectedAdvancedTvlProtocolName?: string | null
	selectedAdvancedTvlChartType?: string
	onSelectedAdvancedTvlProtocolChange?: (protocol: string | null) => void
	onSelectedAdvancedTvlProtocolNameChange?: (name: string | null) => void
	onSelectedAdvancedTvlChartTypeChange?: (chartType: string) => void
	selectedBorrowedProtocol?: string | null
	selectedBorrowedProtocolName?: string | null
	selectedBorrowedChartType?: string
	onSelectedBorrowedProtocolChange?: (protocol: string | null) => void
	onSelectedBorrowedProtocolNameChange?: (name: string | null) => void
	onSelectedBorrowedChartTypeChange?: (chartType: string) => void
	selectedIncomeStatementProtocol?: string | null
	selectedIncomeStatementProtocolName?: string | null
	onSelectedIncomeStatementProtocolChange?: (protocol: string | null) => void
	onSelectedIncomeStatementProtocolNameChange?: (name: string | null) => void
	selectedUnlocksProtocol?: string | null
	selectedUnlocksProtocolName?: string | null
	selectedUnlocksChartType?: 'total' | 'schedule' | 'allocation' | 'locked-unlocked'
	onSelectedUnlocksProtocolChange?: (protocol: string | null) => void
	onSelectedUnlocksProtocolNameChange?: (name: string | null) => void
	onSelectedUnlocksChartTypeChange?: (type: 'total' | 'schedule' | 'allocation' | 'locked-unlocked') => void
	rwaMode?: 'overview' | 'asset'
	selectedRwaChain?: string
	selectedRwaMetric?: RWAOverviewChartMetric
	selectedRwaChartView?: RWAOverviewChartView
	selectedRwaBreakdown?: RWAOverviewChartBreakdown
	selectedRwaTreemapNestedBy?: string
	selectedRwaAssetId?: string | null
	selectedRwaAssetName?: string | null
	selectedRwaAssetMetrics?: Array<RWAOverviewChartMetric>
	onRwaModeChange?: (mode: 'overview' | 'asset') => void
	onSelectedRwaChainChange?: (chain: string) => void
	onSelectedRwaMetricChange?: (metric: RWAOverviewChartMetric) => void
	onSelectedRwaChartViewChange?: (view: RWAOverviewChartView) => void
	onSelectedRwaBreakdownChange?: (breakdown: RWAOverviewChartBreakdown) => void
	onSelectedRwaTreemapNestedByChange?: (nestedBy: string) => void
	onSelectedRwaAssetIdChange?: (id: string | null) => void
	onSelectedRwaAssetNameChange?: (name: string | null) => void
	onSelectedRwaAssetMetricsChange?: (metrics: Array<RWAOverviewChartMetric>) => void
}

const DEFAULT_SELECTED_RWA_ASSET_METRICS: NonNullable<UnifiedChartTabPropsExtended['selectedRwaAssetMetrics']> = [
	'activeMcap',
	'onChainMcap',
	'defiActiveTvl'
]

export function UnifiedChartTab({
	selectedChartTab,
	selectedChartTypes,
	chainOptions,
	protocolOptions,
	protocolsLoading,
	unifiedChartName,
	chartCreationMode,
	composerItems,
	manualFormOpen,
	isEditingItem,
	onSelectCategory,
	onBackToCategories,
	onChartTabChange,
	onChartTypesChange,
	onBulkChartTypeChange,
	onUnifiedChartNameChange,
	onChartCreationModeChange,
	onComposerItemColorChange,
	onAddToComposer,
	onRemoveFromComposer,
	selectedYieldPool = null,
	onSelectedYieldPoolChange,
	selectedYieldChains = EMPTY_ARRAY,
	selectedYieldProjects = EMPTY_ARRAY,
	selectedYieldCategories = EMPTY_ARRAY,
	selectedYieldTokens = EMPTY_ARRAY,
	minTvl = null,
	maxTvl = null,
	onSelectedYieldChainsChange,
	onSelectedYieldProjectsChange,
	onSelectedYieldCategoriesChange,
	onSelectedYieldTokensChange,
	onMinTvlChange,
	onMaxTvlChange,
	selectedYieldChartType = 'tvl-apy',
	onSelectedYieldChartTypeChange,
	selectedStablecoinChain = 'All',
	selectedStablecoinChartType = 'totalMcap',
	stablecoinMode = 'chain',
	selectedStablecoinAsset = null,
	selectedStablecoinAssetId = null,
	selectedStablecoinAssetChartType = 'totalCirc',
	onSelectedStablecoinChainChange,
	onSelectedStablecoinChartTypeChange,
	onStablecoinModeChange,
	onSelectedStablecoinAssetChange,
	onSelectedStablecoinAssetIdChange,
	onSelectedStablecoinAssetChartTypeChange,
	selectedAdvancedTvlProtocol = null,
	selectedAdvancedTvlProtocolName = null,
	selectedAdvancedTvlChartType = 'tvl',
	onSelectedAdvancedTvlProtocolChange,
	onSelectedAdvancedTvlProtocolNameChange,
	onSelectedAdvancedTvlChartTypeChange,
	selectedBorrowedProtocol = null,
	selectedBorrowedProtocolName = null,
	selectedBorrowedChartType = 'chainsBorrowed',
	onSelectedBorrowedProtocolChange,
	onSelectedBorrowedProtocolNameChange,
	onSelectedBorrowedChartTypeChange,
	selectedIncomeStatementProtocol = null,
	selectedIncomeStatementProtocolName = null,
	onSelectedIncomeStatementProtocolChange,
	onSelectedIncomeStatementProtocolNameChange,
	selectedUnlocksProtocol = null,
	selectedUnlocksProtocolName = null,
	selectedUnlocksChartType = 'total',
	onSelectedUnlocksProtocolChange,
	onSelectedUnlocksProtocolNameChange,
	onSelectedUnlocksChartTypeChange,
	rwaMode = 'overview',
	selectedRwaChain = 'All',
	selectedRwaMetric = 'activeMcap',
	selectedRwaChartView = 'timeSeries',
	selectedRwaBreakdown = 'assetGroup',
	selectedRwaTreemapNestedBy = 'none',
	selectedRwaAssetId = null,
	selectedRwaAssetName = null,
	selectedRwaAssetMetrics = DEFAULT_SELECTED_RWA_ASSET_METRICS,
	onRwaModeChange,
	onSelectedRwaChainChange,
	onSelectedRwaMetricChange,
	onSelectedRwaChartViewChange,
	onSelectedRwaBreakdownChange,
	onSelectedRwaTreemapNestedByChange,
	onSelectedRwaAssetIdChange,
	onSelectedRwaAssetNameChange,
	onSelectedRwaAssetMetricsChange
}: UnifiedChartTabPropsExtended) {
	const { loading: metaLoading, availableProtocolChartTypes, availableChainChartTypes } = useAppMetadata()
	const { protocols, chains } = useProDashboardCatalog()
	const subjectParameter = useModalFieldBinding('subject', selectedChartTab === 'protocol' ? 'protocol' : 'chain')

	const handleSubjectTabChange = (tab: ChartTabType) => {
		subjectParameter.unbind()
		onChartTabChange(tab)
	}

	const handleChartTypeSelect = useCallback((type: string) => onChartTypesChange([type]), [onChartTypesChange])
	const handleBulkChartTypeSelect = useCallback((type: string) => onBulkChartTypeChange(type), [onBulkChartTypeChange])

	const selectedChartTypeSingle = selectedChartTypes[0] ?? null
	const bulkChartType = useMemo(() => {
		if (composerItems.length === 0) return null
		const firstType = composerItems[0]?.type
		if (!firstType) return null
		for (const item of composerItems) {
			if (item.type !== firstType) return null
		}
		return firstType
	}, [composerItems])
	const selectedEntitiesForCurrentType = useMemo(() => {
		if (!selectedChartTypeSingle) return []
		const entities: Array<string> = []
		for (const item of composerItems) {
			if (item.type !== selectedChartTypeSingle || item.subjectType !== selectedChartTab) continue
			entities.push(item.subjectType === 'chain' ? item.chain : item.protocol)
		}
		return entities
	}, [composerItems, selectedChartTypeSingle, selectedChartTab])

	const handleEntityToggle = useCallback(
		(entityValue: string) => {
			if (!selectedChartTypeSingle) return
			subjectParameter.unbind()

			const isSelected = selectedEntitiesForCurrentType.includes(entityValue)

			if (isSelected) {
				const itemToRemove = composerItems.find(
					(item) =>
						item.type === selectedChartTypeSingle &&
						item.subjectType === selectedChartTab &&
						(item.subjectType === 'chain' ? item.chain === entityValue : item.protocol === entityValue)
				)
				if (itemToRemove) {
					onRemoveFromComposer(itemToRemove.id)
				}
			} else {
				onAddToComposer([selectedChartTypeSingle], {
					entity: entityValue,
					mode: selectedChartTab === 'protocol' ? 'protocol' : 'chain'
				})
			}
		},
		[
			selectedChartTypeSingle,
			selectedEntitiesForCurrentType,
			composerItems,
			selectedChartTab,
			onRemoveFromComposer,
			onAddToComposer,
			subjectParameter
		]
	)

	const handleClearSelection = useCallback(() => {
		if (!selectedChartTypeSingle) return
		const itemsToRemove = composerItems.filter((item) => item.type === selectedChartTypeSingle)
		for (const item of itemsToRemove) {
			onRemoveFromComposer(item.id)
		}
	}, [selectedChartTypeSingle, composerItems, onRemoveFromComposer])

	const globalAvailableChartTypes = useMemo(() => {
		const set = new Set<string>()
		for (const c of chains) {
			const geckoId = c.gecko_id
			for (const t of availableChainChartTypes(c.name, {
				hasGeckoId: !!geckoId
			}))
				set.add(t)
		}
		for (const p of protocols) {
			if (!p.slug) continue
			const geckoId = p.geckoId
			for (const t of availableProtocolChartTypes(p.slug, {
				hasGeckoId: !!geckoId
			}))
				set.add(t)
		}
		return Array.from(set)
	}, [chains, protocols, availableChainChartTypes, availableProtocolChartTypes])

	const chainHasGeckoIdByName = useMemo(() => {
		const map = new Map<string, boolean>()
		for (const chain of chains) {
			map.set(chain.name, !!chain.gecko_id)
		}
		return map
	}, [chains])

	const protocolHasGeckoIdBySlug = useMemo(() => {
		const map = new Map<string, boolean>()
		for (const protocol of protocols) {
			if (!protocol.slug) continue
			map.set(protocol.slug, !!protocol.geckoId)
		}
		return map
	}, [protocols])

	const chartTypeOptions = useMemo(() => {
		const chartTypesOrder = selectedChartTab === 'chain' ? CHAIN_CHART_TYPES : PROTOCOL_CHART_TYPES
		return chartTypesOrder.map((type) => ({
			value: type,
			label: getProDashboardChartTypeConfig(type)?.title || type,
			available: globalAvailableChartTypes.includes(type)
		}))
	}, [globalAvailableChartTypes, selectedChartTab])

	const bulkAvailableChartTypes = useMemo(() => {
		if (!bulkChartType) return new Set<string>()
		const getAvailableTypes = (item: ChartRuntimeView) => {
			if (item.subjectType === 'chain') {
				return availableChainChartTypes(item.chain, {
					hasGeckoId: chainHasGeckoIdByName.get(item.chain) ?? false
				})
			}
			return availableProtocolChartTypes(item.protocol, {
				hasGeckoId: protocolHasGeckoIdBySlug.get(item.protocol) ?? false
			})
		}
		const [firstItem, ...restItems] = composerItems
		if (!firstItem) return new Set<string>()
		const intersection = new Set(getAvailableTypes(firstItem))
		for (const item of restItems) {
			const availableSet = new Set(getAvailableTypes(item))
			for (const type of Array.from(intersection)) {
				if (!availableSet.has(type)) {
					intersection.delete(type)
				}
			}
		}
		return intersection
	}, [
		bulkChartType,
		composerItems,
		chainHasGeckoIdByName,
		protocolHasGeckoIdBySlug,
		availableChainChartTypes,
		availableProtocolChartTypes
	])

	const bulkChartTypeOptions = useMemo(() => {
		if (!bulkChartType) return []
		return chartTypeOptions.map((option) => ({
			...option,
			available: bulkAvailableChartTypes.has(option.value)
		}))
	}, [bulkChartType, chartTypeOptions, bulkAvailableChartTypes])

	const filteredEntities = useMemo(() => {
		if (!selectedChartTypeSingle) {
			return selectedChartTab === 'chain' ? chainOptions : protocolOptions
		}

		if (selectedChartTab === 'chain') {
			return chainOptions.filter((chain) => {
				const available = availableChainChartTypes(chain.value, {
					hasGeckoId: chainHasGeckoIdByName.get(chain.value) ?? false
				})
				return available.some((type) => type === selectedChartTypeSingle)
			})
		}
		return protocolOptions.filter((protocol) => {
			const available = availableProtocolChartTypes(protocol.value, {
				hasGeckoId: protocolHasGeckoIdBySlug.get(protocol.value) ?? false
			})
			return available.some((type) => type === selectedChartTypeSingle)
		})
	}, [
		selectedChartTypeSingle,
		selectedChartTab,
		chainOptions,
		protocolOptions,
		chainHasGeckoIdByName,
		protocolHasGeckoIdBySlug,
		availableChainChartTypes,
		availableProtocolChartTypes
	])

	if (!manualFormOpen) {
		return (
			<div className="flex h-full flex-col">
				<div className="min-h-0 flex-1">
					<CategoryCardsGrid onSelectCategory={onSelectCategory} />
				</div>
				<SelectionFooter
					composerItems={composerItems}
					chartCreationMode={chartCreationMode}
					unifiedChartName={unifiedChartName}
					onChartCreationModeChange={onChartCreationModeChange}
					onUnifiedChartNameChange={onUnifiedChartNameChange}
					onComposerItemColorChange={onComposerItemColorChange}
					onRemoveFromComposer={onRemoveFromComposer}
				/>
			</div>
		)
	}

	if (selectedChartTab === 'yields') {
		return (
			<div className="flex h-full flex-col">
				<CategoryFormHeader category={selectedChartTab} {...(isEditingItem ? {} : { onBack: onBackToCategories })} />
				<div className="min-h-0 flex-1">
					<YieldsChartTab
						selectedYieldPool={selectedYieldPool}
						onSelectedYieldPoolChange={onSelectedYieldPoolChange || (() => {})}
						selectedYieldChartType={selectedYieldChartType}
						onSelectedYieldChartTypeChange={onSelectedYieldChartTypeChange || (() => {})}
						selectedYieldChains={selectedYieldChains}
						selectedYieldProjects={selectedYieldProjects}
						selectedYieldCategories={selectedYieldCategories}
						selectedYieldTokens={selectedYieldTokens}
						minTvl={minTvl}
						maxTvl={maxTvl}
						onSelectedYieldChainsChange={onSelectedYieldChainsChange || (() => {})}
						onSelectedYieldProjectsChange={onSelectedYieldProjectsChange || (() => {})}
						onSelectedYieldCategoriesChange={onSelectedYieldCategoriesChange || (() => {})}
						onSelectedYieldTokensChange={onSelectedYieldTokensChange || (() => {})}
						onMinTvlChange={onMinTvlChange || (() => {})}
						onMaxTvlChange={onMaxTvlChange || (() => {})}
					/>
				</div>
				<SelectionFooter
					composerItems={composerItems}
					chartCreationMode={chartCreationMode}
					unifiedChartName={unifiedChartName}
					onChartCreationModeChange={onChartCreationModeChange}
					onUnifiedChartNameChange={onUnifiedChartNameChange}
					onComposerItemColorChange={onComposerItemColorChange}
					onRemoveFromComposer={onRemoveFromComposer}
				/>
			</div>
		)
	}

	if (selectedChartTab === 'stablecoins') {
		return (
			<div className="flex h-full flex-col">
				<CategoryFormHeader category={selectedChartTab} {...(isEditingItem ? {} : { onBack: onBackToCategories })} />
				<div className="min-h-0 flex-1">
					<StablecoinsChartTab
						selectedStablecoinChain={selectedStablecoinChain}
						selectedStablecoinChartType={selectedStablecoinChartType}
						stablecoinMode={stablecoinMode}
						selectedStablecoinAsset={selectedStablecoinAsset}
						selectedStablecoinAssetId={selectedStablecoinAssetId}
						selectedStablecoinAssetChartType={selectedStablecoinAssetChartType}
						onSelectedStablecoinChainChange={onSelectedStablecoinChainChange || (() => {})}
						onSelectedStablecoinChartTypeChange={onSelectedStablecoinChartTypeChange || (() => {})}
						onStablecoinModeChange={onStablecoinModeChange || (() => {})}
						onSelectedStablecoinAssetChange={onSelectedStablecoinAssetChange || (() => {})}
						onSelectedStablecoinAssetIdChange={onSelectedStablecoinAssetIdChange || (() => {})}
						onSelectedStablecoinAssetChartTypeChange={onSelectedStablecoinAssetChartTypeChange || (() => {})}
					/>
				</div>
				<SelectionFooter
					composerItems={composerItems}
					chartCreationMode={chartCreationMode}
					unifiedChartName={unifiedChartName}
					onChartCreationModeChange={onChartCreationModeChange}
					onUnifiedChartNameChange={onUnifiedChartNameChange}
					onComposerItemColorChange={onComposerItemColorChange}
					onRemoveFromComposer={onRemoveFromComposer}
				/>
			</div>
		)
	}

	if (selectedChartTab === 'rwa') {
		return (
			<div className="flex h-full flex-col">
				<CategoryFormHeader category={selectedChartTab} {...(isEditingItem ? {} : { onBack: onBackToCategories })} />
				<div className="min-h-0 flex-1">
					<RWAChartTab
						rwaMode={rwaMode}
						selectedRwaChain={selectedRwaChain}
						selectedRwaMetric={selectedRwaMetric}
						selectedRwaChartView={selectedRwaChartView}
						selectedRwaBreakdown={selectedRwaBreakdown}
						selectedRwaTreemapNestedBy={selectedRwaTreemapNestedBy}
						selectedRwaAssetId={selectedRwaAssetId}
						selectedRwaAssetName={selectedRwaAssetName}
						selectedRwaAssetMetrics={selectedRwaAssetMetrics}
						onRwaModeChange={onRwaModeChange || (() => {})}
						onSelectedRwaChainChange={onSelectedRwaChainChange || (() => {})}
						onSelectedRwaMetricChange={onSelectedRwaMetricChange || (() => {})}
						onSelectedRwaChartViewChange={onSelectedRwaChartViewChange || (() => {})}
						onSelectedRwaBreakdownChange={onSelectedRwaBreakdownChange || (() => {})}
						onSelectedRwaTreemapNestedByChange={onSelectedRwaTreemapNestedByChange || (() => {})}
						onSelectedRwaAssetIdChange={onSelectedRwaAssetIdChange || (() => {})}
						onSelectedRwaAssetNameChange={onSelectedRwaAssetNameChange || (() => {})}
						onSelectedRwaAssetMetricsChange={onSelectedRwaAssetMetricsChange || (() => {})}
					/>
				</div>
				<SelectionFooter
					composerItems={composerItems}
					chartCreationMode={chartCreationMode}
					unifiedChartName={unifiedChartName}
					onChartCreationModeChange={onChartCreationModeChange}
					onUnifiedChartNameChange={onUnifiedChartNameChange}
					onComposerItemColorChange={onComposerItemColorChange}
					onRemoveFromComposer={onRemoveFromComposer}
				/>
			</div>
		)
	}

	if (selectedChartTab === 'advanced-tvl') {
		return (
			<div className="flex h-full flex-col">
				<CategoryFormHeader category={selectedChartTab} {...(isEditingItem ? {} : { onBack: onBackToCategories })} />
				<div className="min-h-0 flex-1">
					<AdvancedTvlChartTab
						selectedAdvancedTvlProtocol={selectedAdvancedTvlProtocol}
						selectedAdvancedTvlProtocolName={selectedAdvancedTvlProtocolName}
						selectedAdvancedTvlChartType={selectedAdvancedTvlChartType}
						onSelectedAdvancedTvlProtocolChange={onSelectedAdvancedTvlProtocolChange || (() => {})}
						onSelectedAdvancedTvlProtocolNameChange={onSelectedAdvancedTvlProtocolNameChange || (() => {})}
						onSelectedAdvancedTvlChartTypeChange={onSelectedAdvancedTvlChartTypeChange || (() => {})}
						protocolOptions={protocolOptions}
						protocolsLoading={protocolsLoading}
					/>
				</div>
				<SelectionFooter
					composerItems={composerItems}
					chartCreationMode={chartCreationMode}
					unifiedChartName={unifiedChartName}
					onChartCreationModeChange={onChartCreationModeChange}
					onUnifiedChartNameChange={onUnifiedChartNameChange}
					onComposerItemColorChange={onComposerItemColorChange}
					onRemoveFromComposer={onRemoveFromComposer}
				/>
			</div>
		)
	}

	if (selectedChartTab === 'borrowed') {
		return (
			<div className="flex h-full flex-col">
				<CategoryFormHeader category={selectedChartTab} {...(isEditingItem ? {} : { onBack: onBackToCategories })} />
				<div className="min-h-0 flex-1">
					<BorrowedChartTab
						selectedBorrowedProtocol={selectedBorrowedProtocol}
						selectedBorrowedProtocolName={selectedBorrowedProtocolName}
						selectedBorrowedChartType={selectedBorrowedChartType}
						onSelectedBorrowedProtocolChange={onSelectedBorrowedProtocolChange || (() => {})}
						onSelectedBorrowedProtocolNameChange={onSelectedBorrowedProtocolNameChange || (() => {})}
						onSelectedBorrowedChartTypeChange={onSelectedBorrowedChartTypeChange || (() => {})}
						protocolOptions={protocolOptions}
						protocolsLoading={protocolsLoading}
					/>
				</div>
				<SelectionFooter
					composerItems={composerItems}
					chartCreationMode={chartCreationMode}
					unifiedChartName={unifiedChartName}
					onChartCreationModeChange={onChartCreationModeChange}
					onUnifiedChartNameChange={onUnifiedChartNameChange}
					onComposerItemColorChange={onComposerItemColorChange}
					onRemoveFromComposer={onRemoveFromComposer}
				/>
			</div>
		)
	}

	if (selectedChartTab === 'income-statement') {
		return (
			<div className="flex h-full flex-col">
				<CategoryFormHeader category={selectedChartTab} {...(isEditingItem ? {} : { onBack: onBackToCategories })} />
				<div className="min-h-0 flex-1">
					<IncomeStatementChartTab
						selectedIncomeStatementProtocol={selectedIncomeStatementProtocol}
						selectedIncomeStatementProtocolName={selectedIncomeStatementProtocolName}
						onSelectedIncomeStatementProtocolChange={onSelectedIncomeStatementProtocolChange || (() => {})}
						onSelectedIncomeStatementProtocolNameChange={onSelectedIncomeStatementProtocolNameChange || (() => {})}
						protocolOptions={protocolOptions}
						protocolsLoading={protocolsLoading}
					/>
				</div>
				<SelectionFooter
					composerItems={composerItems}
					chartCreationMode={chartCreationMode}
					unifiedChartName={unifiedChartName}
					onChartCreationModeChange={onChartCreationModeChange}
					onUnifiedChartNameChange={onUnifiedChartNameChange}
					onComposerItemColorChange={onComposerItemColorChange}
					onRemoveFromComposer={onRemoveFromComposer}
				/>
			</div>
		)
	}

	if (selectedChartTab === 'unlocks') {
		return (
			<div className="flex h-full flex-col">
				<CategoryFormHeader category={selectedChartTab} {...(isEditingItem ? {} : { onBack: onBackToCategories })} />
				<div className="min-h-0 flex-1">
					<UnlocksChartTab
						selectedUnlocksProtocol={selectedUnlocksProtocol}
						selectedUnlocksProtocolName={selectedUnlocksProtocolName}
						selectedUnlocksChartType={selectedUnlocksChartType}
						onSelectedUnlocksProtocolChange={onSelectedUnlocksProtocolChange || (() => {})}
						onSelectedUnlocksProtocolNameChange={onSelectedUnlocksProtocolNameChange || (() => {})}
						onSelectedUnlocksChartTypeChange={onSelectedUnlocksChartTypeChange || (() => {})}
						protocolOptions={protocolOptions}
						protocolsLoading={protocolsLoading}
					/>
				</div>
				<SelectionFooter
					composerItems={composerItems}
					chartCreationMode={chartCreationMode}
					unifiedChartName={unifiedChartName}
					onChartCreationModeChange={onChartCreationModeChange}
					onUnifiedChartNameChange={onUnifiedChartNameChange}
					onComposerItemColorChange={onComposerItemColorChange}
					onRemoveFromComposer={onRemoveFromComposer}
				/>
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col gap-3">
			<CategoryFormHeader category={selectedChartTab} {...(isEditingItem ? {} : { onBack: onBackToCategories })} />

			<div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
				<div className="flex min-h-0 flex-col gap-3">
					{subjectParameter.boundVariable ? (
						<BoundParameterChip label={subjectParameter.boundVariable.label} onUnbind={subjectParameter.unbind} />
					) : null}
					<ProSegmented
						className="shrink-0"
						label="Chart subject"
						size="md"
						options={SUBJECT_OPTIONS}
						value={selectedChartTab === 'protocol' ? 'protocol' : 'chain'}
						onValueChange={handleSubjectTabChange}
					/>
					<div className="shrink-0">
						<span className="mb-2 block text-xs font-medium text-pro-text-secondary">Select chart type</span>
						<ChartTypePills
							chartTypes={chartTypeOptions}
							selectedType={selectedChartTypeSingle}
							onSelect={handleChartTypeSelect}
							isLoading={metaLoading}
							mode={selectedChartTab === 'protocol' ? 'protocol' : 'chain'}
						/>
					</div>

					<div className="min-h-0 flex-1">
						<EntityPickerList
							mode={selectedChartTab === 'protocol' ? 'protocol' : 'chain'}
							entities={filteredEntities}
							selectedEntities={selectedEntitiesForCurrentType}
							onToggle={handleEntityToggle}
							onClear={handleClearSelection}
							isLoading={protocolsLoading}
						/>
					</div>
				</div>

				<div className="flex min-h-0 flex-col gap-3">
					{chartCreationMode === 'combined' ? (
						<input
							type="text"
							value={unifiedChartName}
							onChange={(e) => onUnifiedChartNameChange(e.target.value)}
							aria-label="Card name"
							placeholder="Optional"
							className={`${proInputStyles} shrink-0`}
						/>
					) : null}

					{(selectedChartTab === 'chain' || selectedChartTab === 'protocol') && bulkChartType ? (
						<div className="shrink-0">
							<span className="mb-2 block text-xs font-medium text-pro-text-secondary">Change all chart types</span>
							<ChartTypePills
								chartTypes={bulkChartTypeOptions}
								selectedType={bulkChartType}
								onSelect={handleBulkChartTypeSelect}
								isLoading={metaLoading}
								mode={selectedChartTab === 'protocol' ? 'protocol' : 'chain'}
							/>
						</div>
					) : null}

					{composerItems.length > 1 ? (
						<ChartCreationModeToggle
							chartCreationMode={chartCreationMode}
							seriesCount={composerItems.length}
							onChartCreationModeChange={onChartCreationModeChange}
						/>
					) : null}

					<div className="h-[450px] shrink-0 overflow-hidden rounded-lg border border-pro-cards-border bg-pro-cards-bg">
						{composerItems.length === 0 ? (
							<div className="flex h-full items-center justify-center text-xs text-pro-text-tertiary">
								Select entities to preview chart
							</div>
						) : chartCreationMode === 'separate' && composerItems.length > 1 ? (
							<div data-testid="separate-preview" className="size-full">
								<SeparateChartsPreview composerItems={composerItems} />
							</div>
						) : (
							<div data-testid="combined-preview" className="size-full">
								<CombinedChartPreview composerItems={composerItems} />
							</div>
						)}
					</div>

					{composerItems.length > 0 ? (
						<div className="flex shrink-0 items-center gap-2 overflow-x-auto py-1">
							{composerItems.map((item) => (
								<div
									key={item.id}
									className="flex shrink-0 items-center gap-1.5 rounded-md border border-pro-cards-border bg-pro-cards-bg px-2 py-1 text-xs"
								>
									<input
										type="color"
										value={item.color || '#3e61cc'}
										onChange={(e) => onComposerItemColorChange(item.id, e.target.value)}
										className="size-4 cursor-pointer rounded-sm border-0 bg-transparent p-0"
									/>
									<span className="whitespace-nowrap text-pro-text-primary">
										{item.subjectType === 'protocol' ? item.protocol : item.chain} -{' '}
										{getProDashboardChartTypeConfig(item.type)?.title || item.type}
									</span>
									<button
										type="button"
										onClick={() => onRemoveFromComposer(item.id)}
										className="text-pro-text-tertiary transition-colors hover:text-error"
									>
										<Icon name="x" height={12} width={12} />
									</button>
								</div>
							))}
						</div>
					) : null}
				</div>
			</div>
		</div>
	)
}
