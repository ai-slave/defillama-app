import type { UnifiedTablePreset } from '~/containers/ProDashboard/components/UnifiedTable/config/PresetRegistry'
import { UNIFIED_TABLE_PRESETS } from '~/containers/ProDashboard/components/UnifiedTable/config/PresetRegistry'

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
					<button
						type="button"
						key={preset.id}
						aria-pressed={isActive}
						onClick={() => onSelect(preset.id)}
						className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-3 text-left transition ${
							isActive ? 'border-brand bg-brand-tint' : 'border-pro-cards-border hover:border-brand'
						}`}
					>
						<span className="title-md text-pro-text-primary">{preset.name}</span>
						{preset.description ? <span className="body-sm text-pro-text-secondary">{preset.description}</span> : null}
						{isActive ? <span className="rounded-sm bg-brand-tint px-2 py-0.5 label-sm text-link">Active</span> : null}
					</button>
				)
			})}
		</div>
	)
}
