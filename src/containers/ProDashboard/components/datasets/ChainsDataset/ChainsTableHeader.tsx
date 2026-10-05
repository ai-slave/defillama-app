import type { RefObject } from 'react'
import { Icon } from '~/ui/Icon'
import { ProSegmented } from '../../../ui'
import { CSVExportButton } from '../../CSVExportButton'

const PRESET_OPTIONS = [
	{ value: 'essential', label: 'Essential' },
	{ value: 'defi', label: 'DeFi' },
	{ value: 'volume', label: 'Volume' },
	{ value: 'advanced', label: 'Advanced' },
	{ value: 'shares', label: 'Market Share' }
]

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
					<ProSegmented
						label="Column preset"
						value={selectedPreset}
						onValueChange={applyPreset}
						options={PRESET_OPTIONS}
					/>

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
