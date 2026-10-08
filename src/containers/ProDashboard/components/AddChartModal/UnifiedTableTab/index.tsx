import * as Ariakit from '@ariakit/react'
import type { ColumnOrderState, ColumnVisibilityState, SortingState } from '@tanstack/react-table'
import { useCallback, useMemo, useState } from 'react'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { VirtualizedSelect } from '~/components/Select/VirtualizedSelect'
import type { CexAnalyticsMetric, CexAnalyticsView } from '~/containers/Cexs/api.types'
import {
	UNIFIED_TABLE_PRESETS,
	UNIFIED_TABLE_PRESETS_BY_ID
} from '~/containers/ProDashboard/components/UnifiedTable/config/PresetRegistry'
import { UNIFIED_TABLE_COLUMN_DICTIONARY } from '~/containers/ProDashboard/unifiedTable/config/columnDictionary'
import type { UnifiedTableFilters } from '~/containers/ProDashboard/unifiedTable/config/current'
import { normalizeUnifiedTableSorting } from '~/containers/ProDashboard/unifiedTable/config/layoutPolicy'
import type { UnifiedRowHeaderType } from '~/containers/ProDashboard/unifiedTable/config/types'
import { LazySubscribeProModal } from '~/containers/Subscription/shared/SubscribeCards/LazySubscribeProModal'
import { Button } from '~/ui/Button'
import { DialogCancelButton, DialogFooter, useRefusal } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { TabPanel, Tabs } from '~/ui/Tabs'
import type { DashboardItemConfig } from '../../../dashboardItemConfig'
import { requestDashboardItemReveal } from '../../../hooks/useDashboardItemDeepLink'
import { useProDashboardEditorActions } from '../../../ProDashboardAPIContext'
import { buildDefaultUnifiedTableConfig, type DashboardItemPlacement } from '../../../useDashboardActions'
import { EquitiesCompaniesDataset } from '../../datasets/EquitiesDataset/EquitiesCompaniesDataset'
import { EquitiesFilingsDataset } from '../../datasets/EquitiesDataset/EquitiesFilingsDataset'
import { EquitiesFinancialsDataset } from '../../datasets/EquitiesDataset/EquitiesFinancialsDataset'
import { useEquitiesTickerOptions } from '../../datasets/EquitiesDataset/useEquitiesTickerOptions'
import { RWAAssetsDataset } from '../../datasets/RWADataset/RWAAssetsDataset'
import { RWAChainsDataset } from '../../datasets/RWADataset/RWAChainsDataset'
import type { UnifiedTableFocusSection } from '../../UnifiedTable/types'
import { applyPresetToConfig } from '../../UnifiedTable/utils/configHelpers'
import { getOrderedCustomColumnIds } from '../../UnifiedTable/utils/customColumns'
import { getActiveFilterChips } from '../../UnifiedTable/utils/filterChips'
import { useModalFieldBinding } from '../bindingContext'
import { applyUnifiedTableBinding } from '../modalSubmissions'
import type { CombinedTableType } from '../types'
import type { FilterPill } from './components/ActiveFilterPills'
import { ActiveFilterPills } from './components/ActiveFilterPills'
import { CollapsibleSection } from './components/CollapsibleSection'
import { ColumnManager } from './components/ColumnManager'
import { FilterBuilder } from './components/FilterBuilder'
import { FiltersPanel } from './components/FiltersPanel'
import { GroupingOptions } from './components/GroupingOptions'
import { PresetPicker } from './components/PresetPicker'
import { PresetSelector } from './components/PresetSelector'
import { SimpleTableConfig } from './components/SimpleTableConfig'
import { usePresetRecommendations } from './hooks/usePresetRecommendations'
import type { useUnifiedTableWizard } from './hooks/useUnifiedTableWizard'
import type { FilterPreset } from './presets/filterPresets'

interface UnifiedTableTabProps {
	/** Add card owns the wizard for its whole opening, so a table draft survives tab changes and counts toward its
	    discard question. */
	wizard: ReturnType<typeof useUnifiedTableWizard>
	/** Where a new table lands: after or before a card, or at the end of the tab. */
	placement: DashboardItemPlacement | undefined
	onClose: () => void
	chainOptions: Array<{ label: string; value: string }>
	editItem?: DashboardItemConfig | null | undefined
	initialFocusSection?: UnifiedTableFocusSection | undefined
	selectedTableType: CombinedTableType | null
	onTableTypeChange: (type: CombinedTableType | null) => void
	selectedChains: Array<string>
	onChainsChange: (values: Array<string>) => void
	selectedDatasetChain: string | null
	onDatasetChainChange: (value: string | null) => void
	selectedCexAnalyticsView: 'starter' | CexAnalyticsView
	onCexAnalyticsViewChange: (view: 'starter' | CexAnalyticsView) => void
	selectedCexAnalyticsMetric: CexAnalyticsMetric
	onCexAnalyticsMetricChange: (metric: CexAnalyticsMetric) => void
	selectedCexAnalyticsTopN: number
	onCexAnalyticsTopNChange: (topN: number) => void
	selectedTokens: Array<string>
	onTokensChange: (tokens: Array<string>) => void
	includeCex: boolean
	onIncludeCexChange: (include: boolean) => void
	protocolsLoading: boolean
}

const PROTOCOL_ROW_HEADER_ORDER: Array<UnifiedRowHeaderType> = ['chain', 'category', 'parent-protocol']

const TAB_KEYS = ['setup', 'columns', 'filters'] as const
type TabKey = (typeof TAB_KEYS)[number]

const countActiveFilters = (filters: UnifiedTableFilters | undefined): number => {
	if (!filters) return 0
	let count = 0
	for (const value of Object.values(filters)) {
		if (value == null) continue
		if (Array.isArray(value)) {
			if (value.length > 0) count++
			continue
		}
		if (typeof value === 'boolean') {
			if (value) count++
			continue
		}
		if (typeof value === 'number' && !Number.isNaN(value)) {
			count++
		}
	}
	return count
}

const arraysEqual = (a: Array<string>, b: Array<string>) => {
	if (a.length !== b.length) return false
	return a.every((value, index) => value === b[index])
}

const visibilityEqual = (a: ColumnVisibilityState, b: ColumnVisibilityState) => {
	const keys = new Set([...Object.keys(a), ...Object.keys(b)])
	for (const key of keys) {
		const aValue = key in a ? a[key] : true
		const bValue = key in b ? b[key] : true
		if (Boolean(aValue) !== Boolean(bValue)) return false
	}
	return true
}

const sortingEqual = (a: SortingState, b: SortingState) => {
	if (a.length !== b.length) return false
	return a.every((item, index) => {
		const other = b[index]
		if (!other) return false
		return item.id === other.id && Boolean(item.desc) === Boolean(other.desc)
	})
}

type TableTypeCardIcon =
	| 'layers'
	| 'trending-up'
	| 'credit-card'
	| 'chain'
	| 'dollar-sign'
	| 'pie-chart'
	| 'flame'
	| 'landmark'
	| 'bar-chart-2'

const TABLE_TYPE_CARDS: Array<{
	value: CombinedTableType
	label: string
	description: string
	icon: TableTypeCardIcon
	tags: Array<string>
}> = [
	{
		value: 'protocols',
		label: 'Protocols',
		description:
			'Build custom protocol tables with advanced grouping by chain, category, or parent protocol. Filter by TVL, volume, fees, and 30+ metrics. Add custom calculated columns.',
		icon: 'layers',
		tags: ['Grouping', 'Chains', 'Categories', 'Custom columns', '30+ Filters', 'Presets']
	},
	{
		value: 'yields',
		label: 'Yields',
		description: 'V2 earn pools with supply APY, TVL, stability, and borrow-market facts',
		icon: 'trending-up',
		tags: ['Supply APY', 'TVL', 'Borrow Cost']
	},
	{
		value: 'cex-analytics',
		label: 'CEXs',
		description: 'Spot volume, derivatives volume, open interest, leverage, and CEX efficiency.',
		icon: 'credit-card',
		tags: ['Spot', 'Derivatives', 'Open Interest', 'Leverage']
	},
	{
		value: 'chains',
		label: 'Chains',
		description: 'Blockchain metrics including TVL, users, volume, and fees',
		icon: 'chain',
		tags: ['TVL', 'Users', 'Fees']
	},
	{
		value: 'stablecoins',
		label: 'Stablecoins',
		description: 'Stablecoin market caps, price stability, and chains',
		icon: 'dollar-sign',
		tags: ['Market Cap', 'Dominance']
	},
	{
		value: 'token-usage',
		label: 'Token Usage',
		description: 'Track protocol adoption by token usage',
		icon: 'pie-chart',
		tags: ['Adoption', 'Protocols']
	},
	{
		value: 'rwa',
		label: 'RWA',
		description: 'Real World Assets overview and chain breakdown',
		icon: 'landmark',
		tags: ['Active AUM', 'Onchain AUM', 'DeFi TVL']
	},
	{
		value: 'equities',
		label: 'Equities',
		description: 'Stock market companies, financials & SEC filings',
		icon: 'bar-chart-2',
		tags: ['Price', 'Market Cap', 'Financials', 'Filings']
	}
]

const RWA_TABLE_TYPES = new Set<CombinedTableType>(['rwa', 'rwa-chains', 'rwa-selected-chain'])

const RWA_TABS: Array<{ value: CombinedTableType; label: string }> = [
	{ value: 'rwa-chains', label: 'By chain' },
	{ value: 'rwa', label: 'Assets' },
	{ value: 'rwa-selected-chain', label: 'On chain' }
]

const EQUITIES_TABLE_TYPES = new Set<CombinedTableType>(['equities', 'equities-financials', 'equities-filings'])

const EQUITIES_TABS: Array<{ value: CombinedTableType; label: string }> = [
	{ value: 'equities', label: 'Companies' },
	{ value: 'equities-financials', label: 'Financials' },
	{ value: 'equities-filings', label: 'Filings' }
]

export function UnifiedTableTab({
	onClose,
	chainOptions,
	editItem,
	initialFocusSection,
	selectedTableType,
	onTableTypeChange,
	selectedChains,
	onChainsChange,
	selectedDatasetChain,
	onDatasetChainChange,
	selectedCexAnalyticsView,
	onCexAnalyticsViewChange,
	selectedCexAnalyticsMetric,
	onCexAnalyticsMetricChange,
	selectedCexAnalyticsTopN,
	onCexAnalyticsTopNChange,
	selectedTokens,
	onTokensChange,
	includeCex,
	onIncludeCexChange,
	protocolsLoading,
	wizard,
	placement
}: UnifiedTableTabProps) {
	const { handleAppendItems, handleEditItem } = useProDashboardEditorActions()
	const chainParameter = useModalFieldBinding('chains', 'chain')
	const {
		state: {
			chains,
			rowHeaders,
			filters,
			activePresetId,
			columnOrder,
			columnVisibility,
			sorting,
			customColumns,
			customColumnDraft
		},
		actions: {
			setChains,
			setRowHeaders,
			setFilters,
			setPreset,
			setColumns,
			setSorting,
			addCustomColumn,
			updateCustomColumn,
			removeCustomColumn,
			setCustomColumnDraft
		},
		derived: { draftConfig }
	} = wizard
	const { hasActiveSubscription } = useAuthContext()
	const subscribeModalStore = Ariakit.useDialogStore()
	// Only a protocols table edits through this tab's wizard; other table cards edit in SimpleTableConfig.
	const tableEditItem = editItem?.kind === 'unified-table' ? editItem : undefined
	const [showRwaSelector, setShowRwaSelector] = useState(false)
	const [showEquitiesSelector, setShowEquitiesSelector] = useState(false)
	const { options: equitiesTickerOptions, isLoading: equitiesTickerLoading } =
		useEquitiesTickerOptions(showEquitiesSelector)

	const [activeTab, setActiveTab] = useState<TabKey>(
		initialFocusSection === 'filters' ? 'filters' : initialFocusSection === 'columns' ? 'columns' : 'setup'
	)

	const activePreset = UNIFIED_TABLE_PRESETS_BY_ID.get(activePresetId)

	const allColumns = useMemo(() => {
		const dictColumns = ['name', ...UNIFIED_TABLE_COLUMN_DICTIONARY.map((column) => column.id)]
		const customIds = customColumns.map((c) => c.id)
		return [...dictColumns, ...customIds]
	}, [customColumns])

	const customColumnIds = useMemo(
		() => getOrderedCustomColumnIds(columnOrder, customColumns),
		[columnOrder, customColumns]
	)

	const presetDefaults = useMemo(() => {
		if (activePreset) {
			const presetConfig = applyPresetToConfig({
				preset: activePreset,
				includeRowHeaderRules: true,
				mergeWithDefaults: true,
				customColumns
			})
			const baseOrder = presetConfig.columnOrder
			const baseOrderSet = new Set(baseOrder)
			const mergedOrder = [...baseOrder, ...customColumnIds.filter((id) => !baseOrderSet.has(id))]
			const customVisibility = Object.fromEntries(customColumnIds.map((id) => [id, columnVisibility[id] ?? true]))
			return {
				order: mergedOrder,
				visibility: { ...presetConfig.columnVisibility, ...customVisibility },
				sorting: presetConfig.sorting
			}
		}
		const baseOrder = ['name', ...allColumns.slice(1)]
		const baseVisibility: ColumnVisibilityState = {}
		for (const id of allColumns) baseVisibility[id] = id === 'name' || customColumnIds.includes(id)
		return {
			order: baseOrder,
			visibility: baseVisibility,
			sorting: []
		}
	}, [activePreset, allColumns, customColumnIds, columnVisibility, customColumns])

	const presetSortingFallback = useMemo<SortingState>(() => {
		return normalizeUnifiedTableSorting(activePreset?.defaultSorting)
	}, [activePreset])

	const recommendedPresetIds = usePresetRecommendations({
		filters,
		chains
	})

	const recommendedPresetSet = useMemo(() => new Set(recommendedPresetIds), [recommendedPresetIds])

	const recommendedPresets = useMemo(
		() => UNIFIED_TABLE_PRESETS.filter((preset) => recommendedPresetSet.has(preset.id)),
		[recommendedPresetSet]
	)

	const otherPresets = useMemo(
		() => UNIFIED_TABLE_PRESETS.filter((preset) => !recommendedPresetSet.has(preset.id)),
		[recommendedPresetSet]
	)

	const chainLabelMap = useMemo(() => {
		const map = new Map<string, string>()
		for (const option of chainOptions) {
			map.set(option.value, option.label)
		}
		return map
	}, [chainOptions])

	const handleToggleRowHeader = (header: UnifiedRowHeaderType) => {
		const currentlySelected = new Set(rowHeaders)

		if (currentlySelected.has(header)) {
			if (currentlySelected.size === 1) {
				return
			}

			currentlySelected.delete(header)
		} else {
			currentlySelected.add(header)
		}

		const next = PROTOCOL_ROW_HEADER_ORDER.filter((item) => currentlySelected.has(item))

		setRowHeaders(next)
	}

	const handlePresetSelect = (presetId: string) => {
		setPreset(presetId)
	}

	const handleResetToPreset = () => {
		if (!activePreset) return
		handlePresetSelect(activePreset.id)
	}

	const handleColumnChange = (order: ColumnOrderState, visibility: ColumnVisibilityState) => {
		setColumns(order, visibility)
	}

	const handleSortingChange = (newSorting: SortingState) => {
		setSorting(newSorting)
	}

	const handlePanelFiltersChange = useCallback(
		(nextFilters: UnifiedTableFilters) => {
			setFilters(nextFilters)
		},
		[setFilters]
	)

	const handleRemoveChainValue = useCallback(
		(chainValue: string) => {
			const nextChains = chains.filter((chain) => chain !== chainValue)
			setChains(nextChains.length === 0 ? ['All'] : nextChains)
			chainParameter.unbind()
		},
		[chains, setChains, chainParameter]
	)

	const isModified =
		!arraysEqual(columnOrder, presetDefaults.order) ||
		!visibilityEqual(columnVisibility, presetDefaults.visibility) ||
		!sortingEqual(sorting, presetDefaults.sorting)

	const visibleColumnsCount = columnOrder.filter((id) => id !== 'name' && (columnVisibility[id] ?? true)).length

	// A refused add or edit keeps the tab open and says why, for as long as the draft is the one that was refused.
	const [refusalReason, setRefusal] = useRefusal(draftConfig)

	const handleAdd = () => {
		const boundVariableId = chainParameter.boundVariable?.id ?? null
		const written = tableEditItem
			? handleEditItem(
					tableEditItem.id,
					applyUnifiedTableBinding({ ...tableEditItem, ...draftConfig }, boundVariableId)
				)
			: handleAppendItems(
					() => [buildDefaultUnifiedTableConfig(applyUnifiedTableBinding(draftConfig, boundVariableId))],
					placement
				)
		if (written.status === 'refused') {
			setRefusal({ draft: draftConfig, reason: written.reason })
			return
		}
		onClose()
		// Like every other card Add card adds, a new table scrolls into view once the dialog is gone.
		if (!tableEditItem) requestDashboardItemReveal(written.ids[0])
	}

	const handleApplyPreset = (preset: FilterPreset) => {
		setFilters(preset.filters ?? {})
		if (preset.filters?.categories && preset.filters.categories.length > 0) {
			setChains(['All'])
			chainParameter.unbind()
		}
		if (preset.sortBy) {
			setSorting([
				{
					id: preset.sortBy.field,
					desc: preset.sortBy.direction === 'desc'
				}
			])
		}
	}

	const activeFilterChips = useMemo(() => getActiveFilterChips(filters), [filters])

	const activeFilterPills: Array<FilterPill> = useMemo(() => {
		const pills: Array<FilterPill> = []

		for (const chain of chains.filter((chain) => chain !== 'All')) {
			pills.push({
				id: `chain-${chain}`,
				label: chainLabelMap.get(chain) ?? chain,
				onRemove: () => handleRemoveChainValue(chain)
			})
		}

		for (const chip of activeFilterChips) {
			pills.push({
				id: chip.id,
				label: chip.value ? `${chip.label}: ${chip.value}` : chip.label,
				onRemove: () => {
					const newFilters = { ...filters }
					for (const key of chip.clearKeys) {
						delete newFilters[key]
					}
					handlePanelFiltersChange(newFilters)
				}
			})
		}

		return pills
	}, [chains, chainLabelMap, activeFilterChips, filters, handleRemoveChainValue, handlePanelFiltersChange])

	const activeFilterCount = activeFilterPills.length

	const scopeCount = chains.includes('All') ? 0 : 1

	const filterCount = countActiveFilters(filters)
	const totalFilterCount = scopeCount + filterCount

	const setupBadge = activePreset?.name ? `Protocols · ${activePreset.name}` : 'Protocols'

	const tabOptions = useMemo(
		() => [
			{
				key: 'setup' as const,
				label: 'Grouping & views',
				badge: setupBadge
			},
			{
				key: 'columns' as const,
				label: `Columns (${visibleColumnsCount})`
			},
			{
				key: 'filters' as const,
				label: `Filters (${totalFilterCount})`
			}
		],
		[setupBadge, visibleColumnsCount, totalFilterCount]
	)

	const tabContent: Record<TabKey, React.ReactNode> = {
		setup: (
			<div className="flex flex-col gap-3">
				<CollapsibleSection title="Grouping" badge="Protocols" className="shadow-sm">
					<div className="flex flex-col gap-3">
						<div>
							<h4 className="mb-2 title-sm text-pro-text-secondary">Configure grouping</h4>
							<GroupingOptions rowHeaders={rowHeaders} onToggleRowHeader={handleToggleRowHeader} />
						</div>
					</div>
				</CollapsibleSection>

				<CollapsibleSection title="Data views" badge={activePreset?.name} className="shadow-sm">
					<div className="flex flex-col gap-3">
						{recommendedPresets.length > 0 ? (
							<div className="flex flex-col gap-2">
								<div className="flex items-center justify-between">
									<h4 className="title-sm text-pro-text-secondary">Recommended data views</h4>
									<p className="body-sm text-pro-text-tertiary">Based on your filters</p>
								</div>
								<PresetPicker
									activePresetId={activePresetId}
									onSelect={handlePresetSelect}
									presets={recommendedPresets}
								/>
							</div>
						) : null}
						<div className="flex flex-col gap-2">
							<h4 className="title-sm text-pro-text-secondary">All data views</h4>
							{otherPresets.length > 0 ? (
								<PresetPicker activePresetId={activePresetId} onSelect={handlePresetSelect} presets={otherPresets} />
							) : (
								<div className="rounded-md border border-pro-cards-border bg-pro-cards-bg px-3 py-2 body-sm text-pro-text-tertiary">
									All available data views are shown above.
								</div>
							)}
						</div>
					</div>
				</CollapsibleSection>
			</div>
		),
		columns: (
			<div className="flex flex-col gap-3">
				<CollapsibleSection title="Columns" badge={`${visibleColumnsCount} selected`} className="shadow-sm">
					<div className="flex flex-col gap-2">
						<div className="flex flex-wrap items-center justify-end gap-2 label-sm">
							<Button variant="link" onClick={handleResetToPreset} disabled={!isModified} accessibleWhenDisabled>
								Reset to preset
							</Button>
						</div>
						<ColumnManager
							rowHeaders={rowHeaders}
							columnOrder={columnOrder}
							columnVisibility={columnVisibility}
							onChange={handleColumnChange}
							customColumns={customColumns}
							onAddCustomColumn={addCustomColumn}
							onUpdateCustomColumn={updateCustomColumn}
							onRemoveCustomColumn={removeCustomColumn}
							customColumnDraft={customColumnDraft}
							onCustomColumnDraftChange={setCustomColumnDraft}
							sorting={sorting}
							onSortingChange={handleSortingChange}
							onSortingReset={() => handleSortingChange(presetSortingFallback)}
						/>
					</div>
				</CollapsibleSection>
			</div>
		),
		filters: (
			<CollapsibleSection title="Filters" badge={totalFilterCount || undefined} className="shadow-sm">
				<div className="flex flex-col gap-5">
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<h5 className="title-sm tracking-wide text-pro-text-secondary uppercase">Active filters</h5>
							<span className="body-sm text-pro-text-tertiary">
								{activeFilterCount > 0 ? `${activeFilterCount} applied` : 'None'}
							</span>
						</div>
						<ActiveFilterPills pills={activeFilterPills} />
					</div>

					<div className="space-y-2">
						<div>
							<h5 className="title-sm text-pro-text-secondary">Filter presets</h5>
							<p className="body-sm text-pro-text-tertiary">Start from curated combinations.</p>
						</div>
						<PresetSelector currentFilters={filters ?? {}} onApplyPreset={handleApplyPreset} />
					</div>

					<div className="space-y-2">
						<div>
							<h5 className="title-sm text-pro-text-secondary">Scope</h5>
							<p className="body-sm text-pro-text-tertiary">
								Choose which chains, categories, protocols, or oracles to focus on.
							</p>
						</div>
						<FiltersPanel
							chains={chains}
							filters={filters ?? {}}
							availableChains={chainOptions}
							onChainsChange={setChains}
							onFiltersChange={handlePanelFiltersChange}
						/>
					</div>

					<div className="space-y-2">
						<div>
							<h5 className="title-sm text-pro-text-secondary">Metric & flag filters</h5>
							<p className="body-sm text-pro-text-tertiary">
								Add filters for TVL, volume, fees, revenue, and other metrics.
							</p>
						</div>
						<FilterBuilder filters={filters} onFiltersChange={handlePanelFiltersChange} />
					</div>
				</div>
			</CollapsibleSection>
		)
	}

	const handleSelectTableType = (type: CombinedTableType) => {
		if (type === 'token-usage' && !hasActiveSubscription) {
			setSignupSource('pro-dashboard')
			subscribeModalStore.show()
			return
		}
		onTableTypeChange(type)
		setShowRwaSelector(false)
		setShowEquitiesSelector(false)
	}

	const handleRwaTabChange = (type: CombinedTableType) => {
		onTableTypeChange(type)
		if (type === 'rwa-selected-chain' && (!selectedDatasetChain || selectedDatasetChain === 'All')) {
			onDatasetChainChange('Ethereum')
		}
	}

	const handleEquitiesTabChange = (type: CombinedTableType) => {
		onTableTypeChange(type)
		if ((type === 'equities-financials' || type === 'equities-filings') && !selectedDatasetChain) {
			onDatasetChainChange('AAPL')
		}
	}

	const handleBackToTypeSelector = () => {
		onTableTypeChange(null)
		setShowRwaSelector(false)
		setShowEquitiesSelector(false)
	}

	if (showRwaSelector) {
		const activeRwaTab = RWA_TABLE_TYPES.has(selectedTableType) ? selectedTableType : 'rwa-chains'

		return (
			<div className="flex h-full flex-col gap-4">
				<Button variant="link" onClick={handleBackToTypeSelector} className="self-start">
					<Icon name="arrow-left" className="size-3.5" />
					Back to table type selection
				</Button>

				<SegmentedControl
					label="RWA table"
					variant="field"
					size="md"
					options={RWA_TABS}
					value={activeRwaTab}
					onValueChange={handleRwaTabChange}
				/>

				{activeRwaTab === 'rwa-selected-chain' ? (
					<VirtualizedSelect
						variant="field"
						label="Chain"
						options={chainOptions.filter((o) => o.value !== 'All')}
						selectedValue={selectedDatasetChain}
						onChange={(option) => onDatasetChainChange(option.value)}
						placeholder="Select chain…"
						isLoading={protocolsLoading}
					/>
				) : null}

				<div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-pro-cards-border">
					<div className="h-full overflow-auto">
						{activeRwaTab === 'rwa-chains' ? (
							<RWAChainsDataset />
						) : activeRwaTab === 'rwa' ? (
							<RWAAssetsDataset />
						) : (
							<RWAAssetsDataset chain={selectedDatasetChain || 'Ethereum'} />
						)}
					</div>
				</div>
			</div>
		)
	}

	if (showEquitiesSelector) {
		const activeEquitiesTab = EQUITIES_TABLE_TYPES.has(selectedTableType) ? selectedTableType : 'equities'
		const needsTicker = activeEquitiesTab === 'equities-financials' || activeEquitiesTab === 'equities-filings'

		return (
			<div className="flex h-full flex-col gap-4">
				<Button variant="link" onClick={handleBackToTypeSelector} className="self-start">
					<Icon name="arrow-left" className="size-3.5" />
					Back to table type selection
				</Button>

				<SegmentedControl
					label="Equities table"
					variant="field"
					size="md"
					options={EQUITIES_TABS}
					value={activeEquitiesTab}
					onValueChange={handleEquitiesTabChange}
				/>

				{needsTicker ? (
					<VirtualizedSelect
						variant="field"
						label="Company"
						options={equitiesTickerOptions}
						selectedValue={selectedDatasetChain}
						onChange={(option) => onDatasetChainChange(option.value)}
						placeholder="Select company…"
						isLoading={equitiesTickerLoading}
					/>
				) : null}

				<div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-pro-cards-border">
					<div className="h-full overflow-auto">
						{activeEquitiesTab === 'equities' ? (
							<EquitiesCompaniesDataset />
						) : activeEquitiesTab === 'equities-financials' ? (
							<EquitiesFinancialsDataset ticker={selectedDatasetChain || ''} />
						) : (
							<EquitiesFilingsDataset ticker={selectedDatasetChain || ''} />
						)}
					</div>
				</div>
			</div>
		)
	}

	if (selectedTableType === null) {
		const heroCard = TABLE_TYPE_CARDS[0]
		const otherCards = TABLE_TYPE_CARDS.slice(1)
		if (!heroCard) throw new Error('The table type catalog must define a primary card')

		return (
			<div className="flex h-full flex-col">
				<button
					type="button"
					onClick={() => handleSelectTableType(heroCard.value)}
					className="group relative flex flex-col rounded-lg border border-pro-cards-border p-5 text-left transition-all hover:border-pro-accent/40"
				>
					<div className="mb-3 flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="flex size-10 items-center justify-center rounded-lg bg-brand/10">
								<Icon name={heroCard.icon} height={22} width={22} className="text-link" />
							</div>
							<h3 className="heading-xs text-pro-text-primary">{heroCard.label}</h3>
						</div>
						<Icon
							name="arrow-right"
							height={18}
							width={18}
							className="text-pro-text-secondary transition-transform group-hover:translate-x-1 group-hover:text-link"
						/>
					</div>
					<p className="mb-4 body-md text-pro-text-secondary">{heroCard.description}</p>
					<div className="flex flex-wrap gap-1.5">
						{heroCard.tags.map((tag) => (
							<span
								key={tag}
								className="rounded-full px-2.5 py-1 label-sm text-pro-text-secondary transition-colors group-hover:bg-brand/10 group-hover:text-link"
							>
								{tag}
							</span>
						))}
					</div>
				</button>

				<div className="mt-4">
					<span className="mb-2.5 block title-sm text-pro-text-secondary">Other datasets</span>
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
						{otherCards.map((card) => {
							const isProLocked =
								(card.value === 'token-usage' || card.value === 'rwa' || card.value === 'equities') &&
								!hasActiveSubscription
							const isRwa = card.value === 'rwa'
							const isEquities = card.value === 'equities'

							return (
								<button
									key={card.value}
									type="button"
									onClick={() => {
										if (isProLocked) {
											setSignupSource('pro-dashboard')
											subscribeModalStore.show()
											return
										}
										if (isRwa) {
											onTableTypeChange('rwa-chains')
											setShowRwaSelector(true)
										} else if (isEquities) {
											onTableTypeChange('equities')
											setShowEquitiesSelector(true)
										} else {
											handleSelectTableType(card.value)
										}
									}}
									className="group flex items-start gap-2.5 rounded-lg border border-pro-cards-border p-3 text-left transition-all hover:border-pro-accent/40"
								>
									<div className="flex size-8 shrink-0 items-center justify-center rounded-md transition-colors group-hover:bg-brand/10">
										<Icon
											name={isProLocked ? 'file-lock-2' : card.icon}
											height={16}
											width={16}
											className="text-pro-text-secondary group-hover:text-link"
										/>
									</div>
									<div className="min-w-0 flex-1">
										<span className="label-md text-pro-text-primary">
											{card.label}
											{isProLocked ? <span className="ml-1 body-sm opacity-60">(Pro)</span> : null}
										</span>
										<p className="mt-0.5 line-clamp-1 body-sm text-pro-text-secondary">{card.description}</p>
									</div>
								</button>
							)
						})}
					</div>
				</div>

				<LazySubscribeProModal dialogStore={subscribeModalStore} />
			</div>
		)
	}

	if (selectedTableType !== 'protocols') {
		return (
			<SimpleTableConfig
				selectedChains={selectedChains}
				chainOptions={chainOptions}
				protocolsLoading={protocolsLoading}
				onChainsChange={onChainsChange}
				selectedDatasetChain={selectedDatasetChain}
				onDatasetChainChange={onDatasetChainChange}
				selectedCexAnalyticsView={selectedCexAnalyticsView}
				onCexAnalyticsViewChange={onCexAnalyticsViewChange}
				selectedCexAnalyticsMetric={selectedCexAnalyticsMetric}
				onCexAnalyticsMetricChange={onCexAnalyticsMetricChange}
				selectedCexAnalyticsTopN={selectedCexAnalyticsTopN}
				onCexAnalyticsTopNChange={onCexAnalyticsTopNChange}
				selectedTableType={selectedTableType}
				onTableTypeChange={onTableTypeChange}
				selectedTokens={selectedTokens}
				onTokensChange={onTokensChange}
				includeCex={includeCex}
				onIncludeCexChange={onIncludeCexChange}
				onBackToTypeSelector={handleBackToTypeSelector}
				isEditing={Boolean(editItem)}
			/>
		)
	}

	// The shell leaves this view unpadded: the sections scroll between the tab row and the dialog footer.
	return (
		<>
			<div className="flex min-h-0 flex-1 flex-col px-4 pt-4">
				<header className="flex shrink-0 flex-col gap-1 pb-3">
					{!tableEditItem ? (
						<Button variant="link" onClick={handleBackToTypeSelector} className="self-start">
							<Icon name="arrow-left" className="size-3.5" />
							Back to table type selection
						</Button>
					) : null}
				</header>

				<Tabs<TabKey> value={activeTab} values={TAB_KEYS} onValueChange={setActiveTab}>
					{/* The default look scrolls if the row outgrows the dialog; the setup badge only shows from sm, so phones fit all three tabs. */}
					<SegmentedControl
						semantics="tabs"
						label="Table section"
						variant="default"
						size="md"
						className="mb-3"
						options={tabOptions.map((tab) => ({
							value: tab.key,
							label: (
								<span className="flex items-center gap-2">
									<span className="truncate">{tab.label}</span>
									{tab.badge ? (
										<span className="max-w-[160px] truncate rounded-full bg-pro-cards-border px-2 py-0.5 label-sm text-pro-text-tertiary max-sm:hidden">
											{tab.badge}
										</span>
									) : null}
								</span>
							)
						}))}
					/>

					{/* Only the active section mounts; drafts that must survive a switch live in the wizard. */}
					<TabPanel
						value={activeTab}
						className="min-h-0 flex-1 overflow-y-auto pr-1 pb-4"
						data-unified-table-scroll="true"
					>
						<div className="flex h-full flex-col gap-3">{tabContent[activeTab]}</div>
					</TabPanel>
				</Tabs>
			</div>

			<DialogFooter
				leading={
					refusalReason ? (
						<p role="alert" className="body-sm text-error">
							{refusalReason}
						</p>
					) : null
				}
				dismiss={<DialogCancelButton />}
			>
				<Button variant="primary" size="md" onClick={handleAdd}>
					{tableEditItem ? 'Save changes' : 'Add card'}
				</Button>
			</DialogFooter>
		</>
	)
}
