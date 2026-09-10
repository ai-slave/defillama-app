import { useMemo } from 'react'
import type { UnifiedTableFilters } from '~/containers/ProDashboard/unifiedTable/config/current'
import { Tooltip } from '~/ui/Tooltip'
import type { FilterPreset, FilterPresetCategory } from '../presets/filterPresets'
import { CORE_FILTER_PRESETS } from '../presets/filterPresets'

interface PresetSelectorProps {
	currentFilters: UnifiedTableFilters
	onApplyPreset: (preset: FilterPreset) => void
}

const CATEGORY_CONFIG: Record<FilterPresetCategory, { label: string; color: string }> = {
	quick: { label: 'Quick', color: 'bg-gray-500/20 text-tertiary' },
	size: { label: 'Size', color: 'bg-brand/20 text-link' },
	growth: { label: 'Growth', color: 'bg-success/20 text-success' },
	activity: { label: 'Activity', color: 'bg-purple-500/20 text-purple-400' },
	revenue: { label: 'Revenue', color: 'bg-success/20 text-success' },
	investment: { label: 'Investment', color: 'bg-warning/20 text-warning' },
	category: { label: 'Category', color: 'bg-cyan-500/20 text-cyan-400' }
}

const CATEGORY_ORDER: Array<FilterPresetCategory> = [
	'quick',
	'growth',
	'activity',
	'size',
	'revenue',
	'investment',
	'category'
]

const normalizeEntries = (filters: Partial<UnifiedTableFilters>): Map<string, string> => {
	const result = new Map<string, string>()
	for (const [key, value] of Object.entries(filters)) {
		if (value == null) continue
		if (Array.isArray(value) && value.length === 0) continue
		result.set(key, JSON.stringify(value))
	}
	return result
}

const filtersEqual = (currentEntries: Map<string, string>, presetEntries: Map<string, string>) => {
	if (presetEntries.size !== currentEntries.size) return false
	for (const [key, value] of presetEntries) {
		if (currentEntries.get(key) !== value) return false
	}
	return true
}

const PRESET_FILTER_ENTRIES = new Map(
	CORE_FILTER_PRESETS.map((preset) => [preset.id, normalizeEntries(preset.filters)])
)

const GROUPED_PRESETS = (() => {
	const filtered = CORE_FILTER_PRESETS.filter(
		(preset) => !preset.strategyType || preset.strategyType === 'protocols' || preset.strategyType === 'both'
	)
	const grouped = new Map<FilterPresetCategory, Array<FilterPreset>>()
	for (const preset of filtered) {
		const existing = grouped.get(preset.category) ?? []
		existing.push(preset)
		grouped.set(preset.category, existing)
	}
	return grouped
})()

export function PresetSelector({ currentFilters, onApplyPreset }: PresetSelectorProps) {
	const groupedPresets = GROUPED_PRESETS
	const currentEntries = useMemo(() => normalizeEntries(currentFilters), [currentFilters])

	if (groupedPresets.size === 0) {
		return null
	}

	return (
		<div className="space-y-3">
			{CATEGORY_ORDER.map((category) => {
				const presets = groupedPresets.get(category)
				if (!presets?.length) return null
				const config = CATEGORY_CONFIG[category]

				return (
					<div key={category}>
						<div className="mb-1.5 flex items-center gap-2">
							<span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${config.color}`}>
								{config.label}
							</span>
						</div>
						<div className="flex flex-wrap gap-1.5">
							{presets.map((preset) => {
								const presetEntries = PRESET_FILTER_ENTRIES.get(preset.id)
								const isActive = presetEntries ? filtersEqual(currentEntries, presetEntries) : false
								return (
									<Tooltip
										content={preset.tooltip}
										key={preset.id}
										render={
											<button
												type="button"
												onClick={() => onApplyPreset(preset)}
												className={`rounded-md border px-2.5 py-1.5 text-xs transition ${
													isActive
														? 'border-brand bg-brand/10 text-brand'
														: 'border-pro-cards-border bg-pro-cards-bg text-pro-text-secondary hover:border-brand/40 hover:text-pro-text-primary'
												}`}
											/>
										}
									>
										{preset.name}
									</Tooltip>
								)
							})}
						</div>
					</div>
				)
			})}
		</div>
	)
}
