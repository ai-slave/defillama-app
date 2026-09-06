import { Icon } from '~/ui/Icon'
import { CSVExportButton } from '../../CSVExportButton'

interface ChainsTableHeaderProps {
	selectedPreset: string | null
	setSelectedPreset: (preset: string | null) => void
	applyPreset: (preset: string) => void
	showColumnSelector: boolean
	setShowColumnSelector: (show: boolean) => void
	handleExportCSV: () => void
	category: string | undefined
}

export function ChainsTableHeader({
	selectedPreset,
	setSelectedPreset,
	applyPreset,
	showColumnSelector,
	setShowColumnSelector,
	handleExportCSV,
	category
}: ChainsTableHeaderProps) {
	const presetButtons = [
		{ key: 'essential', label: 'Essential' },
		{ key: 'defi', label: 'DeFi' },
		{ key: 'volume', label: 'Volume' },
		{ key: 'advanced', label: 'Advanced' },
		{ key: 'shares', label: 'Market Share' }
	]

	return (
		<div className="mb-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h3 className="text-lg font-semibold text-pro-text-primary">
					{category ? `${category} Chains` : 'All Chains'}
				</h3>

				<div className="flex flex-wrap items-center gap-2">
					<div className="flex items-center gap-2">
						{presetButtons.map((preset) => (
							<button
								type="button"
								key={preset.key}
								onClick={() => {
									applyPreset(preset.key)
									setSelectedPreset(preset.key)
								}}
								className={`flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm capitalize transition-colors ${
									selectedPreset === preset.key
										? 'border-brand bg-brand text-on-brand'
										: 'pro-border pro-hover-bg pro-panel-bg text-pro-text-primary'
								}`}
							>
								{preset.label}
							</button>
						))}
					</div>

					<div className="flex items-center gap-2">
						<CSVExportButton onClick={handleExportCSV} smol />

						<button
							type="button"
							onClick={() => setShowColumnSelector(!showColumnSelector)}
							className="flex items-center gap-2 rounded-md border pro-border pro-hover-bg pro-panel-bg px-3 py-1.5 text-sm text-pro-text-primary transition-colors"
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
