import type { UnifiedTablePreset } from '~/containers/ProDashboard/components/UnifiedTable/config/PresetRegistry'
import { UNIFIED_TABLE_PRESETS } from '~/containers/ProDashboard/components/UnifiedTable/config/PresetRegistry'
import { OptionTile } from '~/ui/OptionTile'

export function PresetPicker({
	activePresetId,
	onSelect,
	presets
}: {
	activePresetId: string
	onSelect: (presetId: string) => void
	presets?: Array<UnifiedTablePreset>
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
					<OptionTile
						key={preset.id}
						layout="stack"
						selected={isActive}
						aria-pressed={isActive}
						onClick={() => onSelect(preset.id)}
					>
						<span className="title-md text-primary">{preset.name}</span>
						{preset.description ? <span className="body-sm text-secondary">{preset.description}</span> : null}
						{isActive ? <span className="rounded-sm bg-brand-tint px-2 py-0.5 label-sm text-link">Active</span> : null}
					</OptionTile>
				)
			})}
		</div>
	)
}
