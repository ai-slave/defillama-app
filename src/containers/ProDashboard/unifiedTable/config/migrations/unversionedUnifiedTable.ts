import type { UnifiedTableV1Config, UnversionedUnifiedTableConfig } from '../../../dashboardConfig/persisted'
import {
	DEFAULT_UNVERSIONED_UNIFIED_TABLE_PRESET_LAYOUT,
	getUnversionedUnifiedTablePresetLayout
} from './unversionedUnifiedTablePresets'

const DEFAULT_UNVERSIONED_SORTING = [{ id: 'tvl', desc: true }] as const

function createHistoricalColumnVisibility(
	columnOrder: ReadonlyArray<string>,
	customColumns: ReadonlyArray<{ id: string }>,
	rowHeaders: UnversionedUnifiedTableConfig['rowHeaders']
): Record<string, boolean> {
	const visibility: Record<string, boolean> = { name: true }
	for (const column of customColumns) visibility[column.id] = false
	for (const id of columnOrder) visibility[id] = true
	if (rowHeaders.includes('chain')) {
		visibility.chains = false
		visibility.category = false
	} else if (rowHeaders.includes('category')) {
		visibility.category = false
	}
	return visibility
}

function normalizeHistoricalSorting(
	sorting?: ReadonlyArray<{ id: string; desc?: boolean }>
): Array<{ id: string; desc: boolean }> {
	const source = sorting?.length ? sorting : DEFAULT_UNVERSIONED_SORTING
	return source.map(({ id, desc }) => ({ id, desc: desc ?? false }))
}

export function migrateUnversionedUnifiedTable(config: UnversionedUnifiedTableConfig): UnifiedTableV1Config {
	const hasColumnOrder = Boolean(config.columnOrder?.length)
	const hasColumnVisibility = Boolean(config.columnVisibility && Object.keys(config.columnVisibility).length > 0)
	const requestedPreset = getUnversionedUnifiedTablePresetLayout(config.activePresetId)
	const preset = requestedPreset ?? DEFAULT_UNVERSIONED_UNIFIED_TABLE_PRESET_LAYOUT
	const usesPresetLayout = !hasColumnOrder && !hasColumnVisibility
	const explicitColumnOrder = hasColumnOrder
		? config.columnOrder?.includes('name')
			? config.columnOrder
			: ['name', ...(config.columnOrder ?? [])]
		: undefined
	const columnOrder = explicitColumnOrder ?? (usesPresetLayout ? preset.columnOrder : undefined)
	const explicitColumnVisibility: Record<string, boolean> = { name: true }
	for (const column of config.customColumns ?? []) explicitColumnVisibility[column.id] = false
	for (const id in config.columnVisibility ?? {}) explicitColumnVisibility[id] = config.columnVisibility?.[id] ?? false
	for (const id of explicitColumnOrder ?? []) {
		if (!Object.hasOwn(config.columnVisibility ?? {}, id)) explicitColumnVisibility[id] = true
	}
	explicitColumnVisibility.name = true
	const columnVisibility = hasColumnVisibility
		? explicitColumnVisibility
		: hasColumnOrder && columnOrder
			? createHistoricalColumnVisibility(columnOrder, config.customColumns ?? [], [])
			: usesPresetLayout
				? createHistoricalColumnVisibility(preset.columnOrder, config.customColumns ?? [], config.rowHeaders)
				: undefined
	const defaultSorting =
		config.defaultSorting !== undefined
			? normalizeHistoricalSorting(config.defaultSorting)
			: usesPresetLayout
				? normalizeHistoricalSorting(preset.defaultSorting)
				: normalizeHistoricalSorting()
	const { activePresetId: _activePresetId, ...rest } = config

	// The unversioned endpoint always returned every metric, so preset-only configs worked without
	// persisting their layout. V3 requests only the metric families named by the effective layout.
	// Preset-only configs now materialize that preset; any explicit layout remains authoritative.
	return {
		...rest,
		configVersion: 1,
		strategy: 'protocols',
		...(columnOrder ? { columnOrder: [...columnOrder] } : {}),
		...(columnVisibility ? { columnVisibility: { ...columnVisibility } } : {}),
		defaultSorting,
		...(usesPresetLayout
			? { activePresetId: preset.id }
			: requestedPreset
				? { activePresetId: requestedPreset.id }
				: {})
	}
}
