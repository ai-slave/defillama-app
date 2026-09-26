import { type Dispatch, type SetStateAction, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import toast from 'react-hot-toast'
import type { StoredColSpan } from './dashboardConfig/colSpan'
import type { DashboardItemConfig } from './dashboardItemConfig'
import { appendItemsToTab, insertItemsAfter, insertItemsBefore } from './dashboardLayout/buildDashboardLayout'
import { type DashboardAction, type DashboardState, historySnapshot, stepHistory } from './dashboardReducer'
import type {
	AIUndoState,
	CustomTimePeriod,
	DashboardAnnotation,
	DashboardVariable,
	TimePeriod
} from './dashboardTypes'
import type {
	ChartBuilderConfig,
	DashboardCardHeight,
	DashboardGrouping,
	MultiChartConfig,
	SectionConfig,
	SqlChartConfig
} from './types'
import { limitMultiChartItems } from './types'
import {
	UNIFIED_TABLE_CONFIG_VERSION,
	type UnifiedTableConfig,
	type UnifiedTableFilters
} from './unifiedTable/config/current'
import { DEFAULT_COLUMN_ORDER } from './unifiedTable/config/defaults'
import {
	DEFAULT_UNIFIED_TABLE_ROW_HEADERS,
	DEFAULT_UNIFIED_TABLE_SORTING,
	sanitizeUnifiedTableRowHeaders
} from './unifiedTable/config/layoutPolicy'
import { getDashboardSizeLimitError } from './utils/dashboardDocumentSize'
import { generateItemId } from './utils/dashboardUtils'

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export type AutoSaveOverrides = {
	timePeriod?: TimePeriod
	customTimePeriod?: CustomTimePeriod | null
	variables?: Array<DashboardVariable>
	annotations?: Array<DashboardAnnotation>
}

export type DashboardItemPlacement = { afterItemId: string } | { beforeItemId: string }

export function buildDefaultUnifiedTableConfig(configOverrides?: Partial<UnifiedTableConfig>): UnifiedTableConfig {
	const resolvedSorting =
		configOverrides?.defaultSorting && configOverrides.defaultSorting.length > 0
			? configOverrides.defaultSorting
			: DEFAULT_UNIFIED_TABLE_SORTING

	return {
		id: generateItemId('unified-table', 'protocols'),
		kind: 'unified-table',
		configVersion: UNIFIED_TABLE_CONFIG_VERSION,
		strategy: 'protocols',
		rowHeaders: sanitizeUnifiedTableRowHeaders(configOverrides?.rowHeaders ?? DEFAULT_UNIFIED_TABLE_ROW_HEADERS),
		defaultSorting: resolvedSorting,
		params: configOverrides?.params ?? { chains: ['All'] },
		...(configOverrides?.filters === undefined ? {} : { filters: configOverrides.filters }),
		columnOrder: configOverrides?.columnOrder ?? [...DEFAULT_COLUMN_ORDER],
		columnVisibility: configOverrides?.columnVisibility ?? {},
		...(configOverrides?.activePresetId === undefined ? {} : { activePresetId: configOverrides.activePresetId }),
		colSpan: configOverrides?.colSpan ?? 2,
		...(configOverrides?.customColumns === undefined ? {} : { customColumns: configOverrides.customColumns }),
		...(configOverrides?.bindings === undefined ? {} : { bindings: configOverrides.bindings })
	}
}

type AutoSaveFunction = (items: Array<DashboardItemConfig>, overrides?: AutoSaveOverrides) => void
type DashboardItemsFactory = (existingItems: ReadonlyArray<DashboardItemConfig>) => Array<DashboardItemConfig>

function cloneUnifiedTableFilters(filters: UnifiedTableFilters): UnifiedTableFilters {
	const clone: UnifiedTableFilters = {}
	const writableClone = clone as Record<string, unknown>
	for (const key in filters) {
		const value = filters[key as keyof UnifiedTableFilters]
		writableClone[key] = Array.isArray(value) ? [...value] : value
	}
	return clone
}

function cloneUnifiedTable(table: UnifiedTableConfig): UnifiedTableConfig {
	return {
		...table,
		id: generateItemId('unified-table', 'protocols'),
		rowHeaders: [...table.rowHeaders],
		...(table.defaultSorting === undefined
			? {}
			: { defaultSorting: table.defaultSorting.map((sort) => ({ ...sort })) }),
		...(table.params === undefined
			? {}
			: {
					params:
						table.params === null
							? null
							: {
									...table.params,
									...(table.params.chains === undefined ? {} : { chains: [...table.params.chains] })
								}
				}),
		...(table.filters === undefined ? {} : { filters: cloneUnifiedTableFilters(table.filters) }),
		...(table.columnOrder === undefined ? {} : { columnOrder: [...table.columnOrder] }),
		...(table.columnVisibility === undefined ? {} : { columnVisibility: { ...table.columnVisibility } }),
		...(table.customColumns === undefined
			? {}
			: { customColumns: table.customColumns.map((column) => ({ ...column })) })
	}
}

export function useDashboardActions(
	dispatch: Dispatch<DashboardAction>,
	state: DashboardState,
	autoSave: AutoSaveFunction,
	isReadOnlyUntilDashboardLoaded: boolean,
	requestedTabId: string | null = null
) {
	const { items, variables, annotations, history } = state
	const aiUndoState = state.currentDashboard?.data.aiUndoState

	const itemsRef = useRef(items)
	const variablesRef = useRef(variables)
	const annotationsRef = useRef(annotations)
	const aiUndoStateRef = useRef<AIUndoState | undefined>(aiUndoState)
	const historyRef = useRef(history)
	const hasHydratedRef = useRef(false)
	useIsomorphicLayoutEffect(() => {
		itemsRef.current = items
		variablesRef.current = variables
		annotationsRef.current = annotations
		aiUndoStateRef.current = aiUndoState
		historyRef.current = history
		hasHydratedRef.current = true
	}, [items, variables, annotations, aiUndoState, history])

	const fitsDashboardSizeLimit = useCallback((candidateItems: Array<DashboardItemConfig>) => {
		const error = getDashboardSizeLimitError({
			items: candidateItems,
			variables: variablesRef.current,
			annotations: annotationsRef.current,
			aiUndoState: aiUndoStateRef.current
		})
		if (!error) return true
		toast.error(error)
		return false
	}, [])

	const dispatchItemsAndSave = useCallback(
		(updater: SetStateAction<Array<DashboardItemConfig>>) => {
			if (!hasHydratedRef.current) {
				return
			}
			const prevItems = itemsRef.current
			const newItems = typeof updater === 'function' ? updater(prevItems) : updater
			if (newItems === prevItems) return
			itemsRef.current = newItems
			dispatch({ type: 'SET_ITEMS', payload: newItems })
			autoSave(newItems)
		},
		[dispatch, autoSave]
	)

	const saveTimePeriodSelection = useCallback(
		(overrides: AutoSaveOverrides) => {
			if (!hasHydratedRef.current) return
			autoSave(itemsRef.current, overrides)
		},
		[autoSave]
	)

	const dispatchItemsWithVariablesAndSave = useCallback(
		(newItems: Array<DashboardItemConfig>, newVariables: Array<DashboardVariable>) => {
			if (!hasHydratedRef.current || isReadOnlyUntilDashboardLoaded) return
			if (newItems === itemsRef.current && newVariables === variablesRef.current) return
			itemsRef.current = newItems
			variablesRef.current = newVariables
			dispatch({ type: 'SET_ITEMS', payload: newItems, variables: newVariables })
			autoSave(newItems, { variables: newVariables })
		},
		[dispatch, autoSave, isReadOnlyUntilDashboardLoaded]
	)

	const setVariables = useCallback(
		(newVariables: Array<DashboardVariable>) => {
			if (!hasHydratedRef.current || isReadOnlyUntilDashboardLoaded) return
			if (newVariables === variablesRef.current) return
			variablesRef.current = newVariables
			dispatch({ type: 'SET_VARIABLES', payload: newVariables })
			autoSave(itemsRef.current, { variables: newVariables })
		},
		[dispatch, autoSave, isReadOnlyUntilDashboardLoaded]
	)

	const setVariableOverrides = useCallback(
		(overrides: Record<string, string>) => {
			dispatch({ type: 'SET_VARIABLE_OVERRIDES', payload: overrides })
		},
		[dispatch]
	)

	const setAnnotations = useCallback(
		(nextAnnotations: Array<DashboardAnnotation>) => {
			if (!hasHydratedRef.current || isReadOnlyUntilDashboardLoaded) return
			dispatch({ type: 'SET_ANNOTATIONS', payload: nextAnnotations })
			autoSave(itemsRef.current, { annotations: nextAnnotations })
		},
		[dispatch, autoSave, isReadOnlyUntilDashboardLoaded]
	)

	const stepHistoryAndSave = useCallback(
		(direction: 'undo' | 'redo') => {
			if (!hasHydratedRef.current || isReadOnlyUntilDashboardLoaded) return false
			const step = stepHistory(
				historyRef.current,
				historySnapshot({ items: itemsRef.current, variables: variablesRef.current }),
				direction
			)
			if (!step) return false
			historyRef.current = step.history
			itemsRef.current = step.entry.items
			variablesRef.current = step.entry.variables
			dispatch({ type: direction === 'undo' ? 'UNDO' : 'REDO' })
			autoSave(step.entry.items, { variables: step.entry.variables })
			return true
		},
		[dispatch, autoSave, isReadOnlyUntilDashboardLoaded]
	)

	const undo = useCallback(() => stepHistoryAndSave('undo'), [stepHistoryAndSave])
	const redo = useCallback(() => stepHistoryAndSave('redo'), [stepHistoryAndSave])

	const handleAppendItems = useCallback(
		(createItems: DashboardItemsFactory, placement?: DashboardItemPlacement): false | Array<string> => {
			if (isReadOnlyUntilDashboardLoaded || !hasHydratedRef.current) return false
			let rejectedBySizeLimit = false
			let appendedIds: Array<string> = []
			dispatchItemsAndSave((existingItems) => {
				const newItems = createItems(existingItems)
				if (newItems.length === 0) return existingItems
				const nextItems = !placement
					? appendItemsToTab(existingItems, newItems, requestedTabId)
					: 'afterItemId' in placement
						? insertItemsAfter(existingItems, placement.afterItemId, newItems)
						: insertItemsBefore(existingItems, placement.beforeItemId, newItems)
				if (fitsDashboardSizeLimit(nextItems)) {
					const existingIds = new Set(existingItems.map((item) => item.id))
					appendedIds = nextItems.filter((item) => !existingIds.has(item.id)).map((item) => item.id)
					return nextItems
				}
				rejectedBySizeLimit = true
				return existingItems
			})
			return rejectedBySizeLimit ? false : appendedIds
		},
		[dispatchItemsAndSave, fitsDashboardSizeLimit, isReadOnlyUntilDashboardLoaded, requestedTabId]
	)

	const handleAddUnifiedTable = useCallback(
		(configOverrides?: Partial<UnifiedTableConfig>) => {
			if (isReadOnlyUntilDashboardLoaded) return

			const newUnifiedTable = buildDefaultUnifiedTableConfig(configOverrides)

			dispatchItemsAndSave((prev) => appendItemsToTab(prev, [newUnifiedTable], requestedTabId))
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded, requestedTabId]
	)

	const handleDuplicateChartBuilder = useCallback(
		(builder: ChartBuilderConfig) => {
			if (isReadOnlyUntilDashboardLoaded || !hasHydratedRef.current) return null

			const clonedConfig: ChartBuilderConfig['config'] = {
				...builder.config,
				chains: [...builder.config.chains],
				categories: [...builder.config.categories],
				...(builder.config.chainCategories ? { chainCategories: [...builder.config.chainCategories] } : {}),
				...(builder.config.protocolCategories ? { protocolCategories: [...builder.config.protocolCategories] } : {}),
				...(builder.config.seriesColors ? { seriesColors: { ...builder.config.seriesColors } } : {})
			}

			const newBuilder: ChartBuilderConfig = {
				...builder,
				id: generateItemId('builder', ''),
				...(builder.name ? { name: `${builder.name} (Duplicate)` } : {}),
				config: clonedConfig
			}
			dispatchItemsAndSave((prev) => insertItemsAfter(prev, builder.id, [newBuilder]))
			return newBuilder.id
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const handleDuplicateUnifiedTable = useCallback(
		(table: UnifiedTableConfig) => {
			if (isReadOnlyUntilDashboardLoaded || !hasHydratedRef.current) return null

			const clonedTable = cloneUnifiedTable(table)
			dispatchItemsAndSave((prev) => insertItemsAfter(prev, table.id, [clonedTable]))
			return clonedTable.id
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const handleDuplicateMultiChart = useCallback(
		(multi: MultiChartConfig) => {
			if (isReadOnlyUntilDashboardLoaded || !hasHydratedRef.current) return null

			const newItems = limitMultiChartItems(multi.items).map((item) => ({
				...item,
				id: generateItemId('chart', `${item.subjectType === 'protocol' ? item.protocol : item.chain}-${item.type}`)
			}))
			const newMulti: MultiChartConfig = {
				...multi,
				id: generateItemId('multi', ''),
				...(multi.name ? { name: `${multi.name} (Duplicate)` } : {}),
				items: newItems
			}
			dispatchItemsAndSave((prev) => insertItemsAfter(prev, multi.id, [newMulti]))
			return newMulti.id
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const handleEditItem = useCallback(
		(itemId: string, newItem: DashboardItemConfig) => {
			if (isReadOnlyUntilDashboardLoaded || !hasHydratedRef.current) return false

			const boundedItem =
				newItem.kind === 'multi' ? { ...newItem, items: limitMultiChartItems(newItem.items) } : newItem
			let rejectedBySizeLimit = false
			dispatchItemsAndSave((prev) => {
				const nextItems = prev.map((item) => (item.id === itemId ? boundedItem : item))
				if (fitsDashboardSizeLimit(nextItems)) return nextItems
				rejectedBySizeLimit = true
				return prev
			})
			return !rejectedBySizeLimit
		},
		[dispatchItemsAndSave, fitsDashboardSizeLimit, isReadOnlyUntilDashboardLoaded]
	)

	const handleRemoveItem = useCallback(
		(itemId: string) => {
			if (isReadOnlyUntilDashboardLoaded) return

			dispatchItemsAndSave((prev) => prev.filter((item) => item.id !== itemId))
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const handleAddSqlChart = useCallback(
		(config: SqlChartConfig, placement?: DashboardItemPlacement): false | string => {
			if (isReadOnlyUntilDashboardLoaded || !hasHydratedRef.current) return false

			dispatchItemsAndSave((prev) =>
				!placement
					? appendItemsToTab(prev, [config], requestedTabId)
					: 'afterItemId' in placement
						? insertItemsAfter(prev, placement.afterItemId, [config])
						: insertItemsBefore(prev, placement.beforeItemId, [config])
			)
			return config.id
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded, requestedTabId]
	)

	const setTimePeriod = useCallback(
		(period: TimePeriod) => {
			dispatch({ type: 'SET_TIME_PERIOD', payload: period })
			saveTimePeriodSelection(
				period === 'custom' ? { timePeriod: period } : { timePeriod: period, customTimePeriod: null }
			)
		},
		[dispatch, saveTimePeriodSelection]
	)

	const setCustomTimePeriod = useCallback(
		(period: CustomTimePeriod | null) => {
			dispatch({ type: 'SET_CUSTOM_TIME_PERIOD', payload: period })
			saveTimePeriodSelection(period ? { timePeriod: 'custom', customTimePeriod: period } : { customTimePeriod: null })
		},
		[dispatch, saveTimePeriodSelection]
	)

	const handleChartsReordered = useCallback(
		(newCharts: Array<DashboardItemConfig>) => {
			if (isReadOnlyUntilDashboardLoaded) return

			dispatchItemsAndSave(newCharts)
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const handleGroupingChange = useCallback(
		(chartId: string, newGrouping: DashboardGrouping) => {
			if (isReadOnlyUntilDashboardLoaded) return

			dispatchItemsAndSave((prev) =>
				prev.map((item) => {
					if (item.id === chartId && item.kind === 'chart') {
						return { ...item, grouping: newGrouping }
					} else if (item.kind === 'multi' && item.id === chartId) {
						return {
							...item,
							grouping: newGrouping,
							items: item.items.map((nestedChart) => ({
								...nestedChart,
								grouping: newGrouping
							}))
						}
					} else if (item.kind === 'builder' && item.id === chartId) {
						return { ...item, grouping: newGrouping }
					}
					return item
				})
			)
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const handleColSpanChange = useCallback(
		(chartId: string, newColSpan: StoredColSpan) => {
			if (isReadOnlyUntilDashboardLoaded) return

			dispatchItemsAndSave((prev) =>
				prev.map((item) => {
					if (item.id === chartId) {
						if (item.kind === 'metric') {
							const clampedMetric: StoredColSpan = newColSpan > 1 ? 1 : newColSpan
							return { ...item, colSpan: clampedMetric }
						}
						return { ...item, colSpan: newColSpan }
					}
					return item
				})
			)
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const handleHeightChange = useCallback(
		(itemId: string, height: DashboardCardHeight) => {
			if (isReadOnlyUntilDashboardLoaded) return

			dispatchItemsAndSave((prev) =>
				prev.map((item) => {
					if (item.id !== itemId || item.kind === 'section') return item
					if (height === 'default') {
						const { height: _height, ...rest } = item
						return rest
					}
					return { ...item, height }
				})
			)
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const handleUpdateSection = useCallback(
		(
			sectionId: string,
			patch: { title?: string; description?: string; displayAs?: SectionConfig['displayAs']; collapsed?: boolean }
		) => {
			if (isReadOnlyUntilDashboardLoaded) return

			dispatchItemsAndSave((prev) =>
				prev.map((item) => {
					if (item.id !== sectionId || item.kind !== 'section') return item
					const { description, ...rest } = patch
					const next: SectionConfig = { ...item, ...rest }
					if (description !== undefined) {
						if (description) next.description = description
						else delete next.description
					}
					return next
				})
			)
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const handleCumulativeChange = useCallback(
		(itemId: string, showCumulative: boolean) => {
			if (isReadOnlyUntilDashboardLoaded) return

			dispatchItemsAndSave((prev) =>
				prev.map((item) => {
					if (item.id === itemId && item.kind === 'chart') {
						return { ...item, showCumulative }
					} else if (item.id === itemId && item.kind === 'multi') {
						return { ...item, showCumulative }
					}
					return item
				})
			)
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const handlePercentageChange = useCallback(
		(itemId: string, showPercentage: boolean) => {
			if (isReadOnlyUntilDashboardLoaded) return

			dispatchItemsAndSave((prev) =>
				prev.map((item) => {
					if (item.id === itemId && item.kind === 'multi') {
						return { ...item, showPercentage }
					} else if (item.id === itemId && item.kind === 'builder') {
						return {
							...item,
							config: {
								...item.config,
								displayAs: showPercentage ? 'percentage' : 'timeSeries'
							}
						} satisfies ChartBuilderConfig
					}
					return item
				})
			)
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const handleStackedChange = useCallback(
		(itemId: string, showStacked: boolean) => {
			if (isReadOnlyUntilDashboardLoaded) return

			dispatchItemsAndSave((prev) =>
				prev.map((item) => {
					if (item.id === itemId && item.kind === 'multi') {
						return { ...item, showStacked }
					}
					return item
				})
			)
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const handleTreemapChange = useCallback(
		(itemId: string, showTreemap: boolean) => {
			if (isReadOnlyUntilDashboardLoaded) return

			dispatchItemsAndSave((prev) =>
				prev.map((item) => {
					if (item.id === itemId && item.kind === 'multi') {
						return { ...item, showTreemap }
					}
					return item
				})
			)
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const handleHideOthersChange = useCallback(
		(itemId: string, hideOthers: boolean) => {
			if (isReadOnlyUntilDashboardLoaded) return

			dispatchItemsAndSave((prev) =>
				prev.map((item) => {
					if (item.id === itemId && item.kind === 'builder') {
						return {
							...item,
							config: {
								...item.config,
								hideOthers
							}
						} satisfies ChartBuilderConfig
					}
					return item
				})
			)
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const handleChartTypeChange = useCallback(
		(itemId: string, newChartType: 'stackedBar' | 'stackedArea' | 'line' | 'treemap') => {
			if (isReadOnlyUntilDashboardLoaded) return

			dispatchItemsAndSave((prev) =>
				prev.map((item) => {
					if (item.id === itemId && item.kind === 'builder') {
						return {
							...item,
							config: {
								...item.config,
								chartType: newChartType
							}
						} satisfies ChartBuilderConfig
					}
					return item
				})
			)
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const setDashboardName = useCallback(
		(name: string) => {
			dispatch({ type: 'SET_DASHBOARD_NAME', payload: name })
		},
		[dispatch]
	)

	const setDashboardVisibility = useCallback(
		(visibility: 'private' | 'public') => {
			dispatch({ type: 'SET_DASHBOARD_VISIBILITY', payload: visibility })
		},
		[dispatch]
	)

	const setDashboardTags = useCallback(
		(tags: Array<string>) => {
			dispatch({ type: 'SET_DASHBOARD_TAGS', payload: tags })
		},
		[dispatch]
	)

	const setDashboardDescription = useCallback(
		(description: string) => {
			dispatch({ type: 'SET_DASHBOARD_DESCRIPTION', payload: description })
		},
		[dispatch]
	)

	const setShowGenerateDashboardModal = useCallback(
		(show: boolean) => {
			dispatch({ type: 'SET_SHOW_GENERATE_DASHBOARD_MODAL', payload: show })
		},
		[dispatch]
	)

	const setShowIterateDashboardModal = useCallback(
		(show: boolean) => {
			dispatch({ type: 'SET_SHOW_ITERATE_DASHBOARD_MODAL', payload: show })
		},
		[dispatch]
	)

	const setItems = useCallback(
		(newItems: Array<DashboardItemConfig>) => {
			dispatch({ type: 'SET_ITEMS', payload: newItems })
		},
		[dispatch]
	)

	return useMemo(
		() => ({
			handleAppendItems,
			handleAddUnifiedTable,
			handleDuplicateChartBuilder,
			handleDuplicateUnifiedTable,
			handleDuplicateMultiChart,
			handleEditItem,
			handleRemoveItem,
			handleAddSqlChart,
			setTimePeriod,
			setCustomTimePeriod,
			handleChartsReordered,
			handleGroupingChange,
			handleColSpanChange,
			handleHeightChange,
			handleUpdateSection,
			handleCumulativeChange,
			handlePercentageChange,
			handleStackedChange,
			handleTreemapChange,
			handleHideOthersChange,
			handleChartTypeChange,
			setDashboardName,
			setDashboardVisibility,
			setDashboardTags,
			setDashboardDescription,
			setShowGenerateDashboardModal,
			setShowIterateDashboardModal,
			setItems,
			dispatchItemsAndSave,
			dispatchItemsWithVariablesAndSave,
			setVariables,
			setVariableOverrides,
			setAnnotations,
			undo,
			redo
		}),
		[
			handleAppendItems,
			handleAddUnifiedTable,
			handleDuplicateChartBuilder,
			handleDuplicateUnifiedTable,
			handleDuplicateMultiChart,
			handleEditItem,
			handleRemoveItem,
			handleAddSqlChart,
			setTimePeriod,
			setCustomTimePeriod,
			handleChartsReordered,
			handleGroupingChange,
			handleColSpanChange,
			handleHeightChange,
			handleUpdateSection,
			handleCumulativeChange,
			handlePercentageChange,
			handleStackedChange,
			handleTreemapChange,
			handleHideOthersChange,
			handleChartTypeChange,
			setDashboardName,
			setDashboardVisibility,
			setDashboardTags,
			setDashboardDescription,
			setShowGenerateDashboardModal,
			setShowIterateDashboardModal,
			setItems,
			dispatchItemsAndSave,
			dispatchItemsWithVariablesAndSave,
			setVariables,
			setVariableOverrides,
			setAnnotations,
			undo,
			redo
		]
	)
}
