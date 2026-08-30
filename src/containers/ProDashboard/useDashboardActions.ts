import { type Dispatch, type SetStateAction, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { StoredColSpan } from './dashboardConfig/colSpan'
import type { DashboardItemConfig } from './dashboardItemConfig'
import type { DashboardAction, DashboardState } from './dashboardReducer'
import type { CustomTimePeriod, Dashboard, TimePeriod } from './dashboardTypes'
import type { ChartBuilderConfig, DashboardGrouping, MultiChartConfig, SqlChartConfig } from './types'
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
import { generateItemId } from './utils/dashboardUtils'

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

type AutoSaveOverrides = {
	timePeriod?: TimePeriod
	customTimePeriod?: CustomTimePeriod | null
}

type AutoSaveFunction = (items: DashboardItemConfig[], overrides?: AutoSaveOverrides) => void
type DashboardItemsFactory = (existingItems: readonly DashboardItemConfig[]) => DashboardItemConfig[]

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
	isReadOnlyUntilDashboardLoaded: boolean
) {
	const { items } = state

	const itemsRef = useRef(items)
	const hasHydratedRef = useRef(false)
	useIsomorphicLayoutEffect(() => {
		itemsRef.current = items
		hasHydratedRef.current = true
	}, [items])

	const dispatchItemsAndSave = useCallback(
		(updater: SetStateAction<DashboardItemConfig[]>) => {
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

	const handleAppendItems = useCallback(
		(createItems: DashboardItemsFactory) => {
			if (isReadOnlyUntilDashboardLoaded) return
			dispatchItemsAndSave((existingItems) => {
				const newItems = createItems(existingItems)
				return newItems.length > 0 ? [...existingItems, ...newItems] : existingItems
			})
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const handleAddUnifiedTable = useCallback(
		(configOverrides?: Partial<UnifiedTableConfig>) => {
			if (isReadOnlyUntilDashboardLoaded) return

			const resolvedSorting =
				configOverrides?.defaultSorting && configOverrides.defaultSorting.length
					? configOverrides.defaultSorting
					: DEFAULT_UNIFIED_TABLE_SORTING

			const newUnifiedTable: UnifiedTableConfig = {
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
				...(configOverrides?.customColumns === undefined ? {} : { customColumns: configOverrides.customColumns })
			}

			dispatchItemsAndSave((prev) => [...prev, newUnifiedTable])
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const handleDuplicateChartBuilder = useCallback(
		(builder: ChartBuilderConfig) => {
			if (isReadOnlyUntilDashboardLoaded) return

			const clonedConfig: ChartBuilderConfig['config'] = {
				...builder.config,
				chains: [...builder.config.chains],
				categories: [...builder.config.categories],
				...(builder.config.chainCategories ? { chainCategories: [...builder.config.chainCategories] } : {}),
				...(builder.config.protocolCategories ? { protocolCategories: [...builder.config.protocolCategories] } : {}),
				...(builder.config.seriesColors ? { seriesColors: { ...builder.config.seriesColors } } : {})
			}

			dispatchItemsAndSave((prev) => {
				const newBuilder: ChartBuilderConfig = {
					...builder,
					id: generateItemId('builder', ''),
					...(builder.name ? { name: `${builder.name} (Duplicate)` } : {}),
					config: clonedConfig
				}
				return [...prev, newBuilder]
			})
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const handleDuplicateUnifiedTable = useCallback(
		(table: UnifiedTableConfig) => {
			if (isReadOnlyUntilDashboardLoaded) return

			dispatchItemsAndSave((prev) => [...prev, cloneUnifiedTable(table)])
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const handleDuplicateMultiChart = useCallback(
		(multi: MultiChartConfig) => {
			if (isReadOnlyUntilDashboardLoaded) return

			dispatchItemsAndSave((prev) => {
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
				return [...prev, newMulti]
			})
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const handleEditItem = useCallback(
		(itemId: string, newItem: DashboardItemConfig) => {
			if (isReadOnlyUntilDashboardLoaded) return

			const boundedItem =
				newItem.kind === 'multi' ? { ...newItem, items: limitMultiChartItems(newItem.items) } : newItem
			dispatchItemsAndSave((prev) => prev.map((item) => (item.id === itemId ? boundedItem : item)))
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const handleRemoveItem = useCallback(
		(itemId: string) => {
			if (isReadOnlyUntilDashboardLoaded) return

			dispatchItemsAndSave((prev) => prev.filter((item) => item.id !== itemId))
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const handleAddSqlChart = useCallback(
		(config: SqlChartConfig) => {
			if (isReadOnlyUntilDashboardLoaded) return

			dispatchItemsAndSave((prev) => [...prev, config])
		},
		[dispatchItemsAndSave, isReadOnlyUntilDashboardLoaded]
	)

	const setTimePeriod = useCallback(
		(period: TimePeriod) => {
			dispatch({ type: 'SET_TIME_PERIOD', payload: period })
		},
		[dispatch]
	)

	const setCustomTimePeriod = useCallback(
		(period: CustomTimePeriod | null) => {
			dispatch({ type: 'SET_CUSTOM_TIME_PERIOD', payload: period })
		},
		[dispatch]
	)

	const handleChartsReordered = useCallback(
		(newCharts: DashboardItemConfig[]) => {
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
		(tags: string[]) => {
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
		(newItems: DashboardItemConfig[]) => {
			dispatch({ type: 'SET_ITEMS', payload: newItems })
		},
		[dispatch]
	)

	const setCurrentDashboard = useCallback(
		(updater: SetStateAction<Dashboard | null>) => {
			dispatch({ type: 'SET_CURRENT_DASHBOARD', payload: updater })
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
			setCurrentDashboard
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
			setCurrentDashboard
		]
	)
}
