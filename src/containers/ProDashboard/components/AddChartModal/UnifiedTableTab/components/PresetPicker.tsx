import type { UnifiedTablePreset } from '~/containers/ProDashboard/components/UnifiedTable/config/PresetRegistry'
import { UNIFIED_TABLE_PRESETS } from '~/containers/ProDashboard/components/UnifiedTable/config/PresetRegistry'

export function PresetPicker({
	activePresetId,
	onSelect,
	presets
}: {
	activePresetId: string
	onSelect: (presetId: string) => void
	presets?: UnifiedTablePreset[]
}) {
	const presetList = presets ?? UNIFIED_TABLE_PRESETS

	if (presetList.length === 0) {
		return null
	}

	return (
		<div className="grid gap-3 sm:grid-cols-2">
			{presetList.map((preset) => {
				const isActive = preset.id === activePresetId
				return (
					<button
						type="button"
						key={preset.id}
						onClick={() => onSelect(preset.id)}
						className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-3 text-left transition ${
							isActive
								? 'border-(--legacy-primary) bg-(--legacy-primary)/10'
								: 'border-(--legacy-cards-border) hover:border-(--legacy-primary)'
						}`}
					>
						<span className="text-sm font-semibold text-(--legacy-text-primary)">{preset.name}</span>
						{preset.description ? (
							<span className="text-xs text-(--legacy-text-secondary)">{preset.description}</span>
						) : null}
						{isActive ? (
							<span className="rounded bg-(--legacy-primary)/10 px-2 py-0.5 text-[10px] font-medium text-(--legacy-primary)">
								Active
							</span>
						) : null}
					</button>
				)
			})}
		</div>
	)
}
