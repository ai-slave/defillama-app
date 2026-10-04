import type { RefObject } from 'react'
import { Icon } from '~/ui/Icon'
import { CSVExportButton } from '../../CSVExportButton'

const PRESET_BUTTONS = [
	{ key: 'essential', label: 'Essential' },
	{ key: 'defi', label: 'DeFi' },
	{ key: 'volume', label: 'Volume' },
	{ key: 'advanced', label: 'Advanced' },
	{ key: 'shares', label: 'Market Share' }
] as const

interface ChainsTableHeaderProps {
	selectedPreset: string | null
	applyPreset: (preset: string) => void
	showColumnSelector: boolean
	setShowColumnSelector: (show: boolean) => void
	/** Done in the column panel hands focus back to this toggle. */
	customizeRef: RefObject<HTMLButtonElement | null>
	handleExportCSV: () => void
}

export function ChainsTableHeader({
	selectedPreset,
	applyPreset,
	showColumnSelector,
	setShowColumnSelector,
	customizeRef,
	handleExportCSV
}: ChainsTableHeaderProps) {
	return (
		<div className="mb-4">
			<div className="flex flex-wrap items-center justify-end gap-3">
				<div className="flex flex-wrap items-center gap-2">
					<div className="flex items-center gap-2">
						{PRESET_BUTTONS.map((preset) => (
							<button
								type="button"
								key={preset.key}
								aria-pressed={selectedPreset === preset.key}
								onClick={() => applyPreset(preset.key)}
								className={`flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm capitalize transition-colors ${
									selectedPreset === preset.key
										? 'border-brand bg-brand text-on-brand'
										: 'border-pro-cards-border bg-pro-cards-bg text-pro-text-primary hover:bg-pro-hover-fill'
								}`}
							>
								{preset.label}
							</button>
						))}
					</div>

					<div className="flex items-center gap-2">
						<CSVExportButton onClick={handleExportCSV} smol />

						<button
							ref={customizeRef}
							type="button"
							aria-expanded={showColumnSelector}
							onClick={() => setShowColumnSelector(!showColumnSelector)}
							className="flex items-center gap-2 rounded-md border border-pro-cards-border bg-pro-cards-bg px-3 py-1.5 text-sm text-pro-text-primary transition-colors hover:bg-pro-hover-fill"
						>
							<Icon name="settings" height={14} width={14} />
							Customize Table
							<Icon name={showColumnSelector ? 'chevron-up' : 'chevron-down'} height={12} width={12} />
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
