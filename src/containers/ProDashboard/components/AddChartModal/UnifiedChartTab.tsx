import { type ReactNode, useCallback, useMemo, useState } from 'react'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { useAppMetadata } from '../../AppMetadataContext'
import type { ChartRuntimeView } from '../../chartRuntime'
import { useProDashboardCatalog } from '../../ProDashboardAPIContext'
import { CHAIN_CHART_TYPES, getProDashboardChartTypeConfig, PROTOCOL_CHART_TYPES } from '../../types'
import { BoundParameterChip, useModalFieldBinding } from './bindingContext'
import { CategoryCardsGrid } from './CategoryCardsGrid'
import { CategoryFormHeader } from './CategoryFormHeader'
import { ChartCreationModeToggle } from './ChartCreationModeToggle'
import { ChartTypePills } from './ChartTypePills'
import { CombinedChartPreview } from './CombinedChartPreview'
import { EntityPickerList } from './EntityPickerList'
import { ADD_CARD_PANES, type AddCardPane, SUBJECT_OPTIONS } from './panes'
import { ComposerChips, ComposerNameField, SelectionFooter } from './SelectionFooter'
import { SeparateChartsPreview } from './SeparateChartsPreview'
import type { ChartTabType } from './types'

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
	/** The single-card category's form (CategoryChartForm); chains and protocols compose series here instead. */
	categoryForm: ReactNode
}

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
	categoryForm
}: UnifiedChartTabProps) {
	const { loading: metaLoading, availableProtocolChartTypes, availableChainChartTypes } = useAppMetadata()
	const { protocols, chains } = useProDashboardCatalog()
	const subjectParameter = useModalFieldBinding('subject', selectedChartTab === 'protocol' ? 'protocol' : 'chain')
	const [pane, setPane] = useState<AddCardPane>('configure')

	const handleSubjectTabChange = (tab: ChartTabType) => {
		subjectParameter.unbind()
		onChartTabChange(tab)
	}

	const handleChartTypeSelect = useCallback((type: string) => onChartTypesChange([type]), [onChartTypesChange])

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
		for (const item of composerItems) {
			if (item.type === selectedChartTypeSingle && item.subjectType === selectedChartTab) onRemoveFromComposer(item.id)
		}
	}, [selectedChartTypeSingle, selectedChartTab, composerItems, onRemoveFromComposer])

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
				<div className="min-h-0 flex-1 overflow-y-auto">
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

	// The single-card categories save from their own selection, so they show no series composer.
	if (selectedChartTab !== 'chain' && selectedChartTab !== 'protocol') {
		return (
			<div className="flex h-full flex-col">
				<CategoryFormHeader category={selectedChartTab} {...(isEditingItem ? {} : { onBack: onBackToCategories })} />
				<div className="min-h-0 flex-1 overflow-y-auto">{categoryForm}</div>
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col gap-3">
			<CategoryFormHeader
				category={selectedChartTab}
				{...(isEditingItem
					? {}
					: {
							onBack: () => {
								// The next category starts on its configuration.
								setPane('configure')
								onBackToCategories()
							}
						})}
			/>

			<SegmentedControl<AddCardPane>
				label="Editor view"
				options={ADD_CARD_PANES}
				value={pane}
				onValueChange={setPane}
				variant="solid-responsive"
				size="md"
				className="shrink-0 lg:hidden"
			/>

			<div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
				<div className={`min-h-0 flex-col gap-3 lg:flex ${pane === 'configure' ? 'flex' : 'hidden'}`}>
					{subjectParameter.boundVariable ? (
						<BoundParameterChip label={subjectParameter.boundVariable.label} onUnbind={subjectParameter.unbind} />
					) : null}
					<SegmentedControl
						variant="field"
						size="md"
						label="Chart subject"
						options={SUBJECT_OPTIONS}
						value={selectedChartTab === 'protocol' ? 'protocol' : 'chain'}
						onValueChange={handleSubjectTabChange}
					/>
					<div className="shrink-0">
						<ChartTypePills
							label="Chart type"
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

				<div className={`min-h-0 flex-col gap-3 overflow-y-auto lg:flex ${pane === 'preview' ? 'flex' : 'hidden'}`}>
					{chartCreationMode === 'combined' ? (
						<ComposerNameField value={unifiedChartName} onChange={onUnifiedChartNameChange} />
					) : null}

					{(selectedChartTab === 'chain' || selectedChartTab === 'protocol') && bulkChartType ? (
						<div className="shrink-0">
							<ChartTypePills
								label="Change all chart types"
								chartTypes={bulkChartTypeOptions}
								selectedType={bulkChartType}
								onSelect={onBulkChartTypeChange}
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

					<div className="h-[450px] shrink-0 overflow-hidden rounded-lg border border-subtle bg-surface">
						{composerItems.length === 0 ? (
							<div className="flex h-full items-center justify-center body-sm text-tertiary">
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
							<ComposerChips
								composerItems={composerItems}
								onComposerItemColorChange={onComposerItemColorChange}
								onRemoveFromComposer={onRemoveFromComposer}
							/>
						</div>
					) : null}
				</div>
			</div>
		</div>
	)
}
