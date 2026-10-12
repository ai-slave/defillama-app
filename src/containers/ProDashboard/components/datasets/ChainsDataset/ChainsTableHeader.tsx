import type { RefObject } from 'react'
import { Button } from '~/ui/Button'
import { DisclosureChevron } from '~/ui/DisclosureChevron'
import { Icon } from '~/ui/Icon'
import { SegmentedControl } from '~/ui/SegmentedControl'
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
					<SegmentedControl
						label="Column preset"
						variant="default"
						size="md"
						value={selectedPreset}
						onValueChange={applyPreset}
						options={PRESET_OPTIONS}
					/>

					<div className="flex items-center gap-2">
						<CSVExportButton onClick={handleExportCSV} smol />

						<Button
							ref={customizeRef}
							variant="secondary"
							size="md"
							aria-expanded={showColumnSelector}
							onClick={() => setShowColumnSelector(!showColumnSelector)}
						>
							<Icon name="settings" className="size-3.5" />
							Customize table
							<DisclosureChevron kind="section" size="sm" open={showColumnSelector} />
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}
