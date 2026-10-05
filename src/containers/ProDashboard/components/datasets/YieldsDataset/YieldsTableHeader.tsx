import * as React from 'react'
import { Icon } from '~/ui/Icon'
import { ProSegmented } from '../../../ui'
import { CSVExportButton } from '../../CSVExportButton'

interface YieldsTableHeaderProps {
	columnPresets: Record<string, ReadonlyArray<string>>
	applyPreset: (presetName: string) => void
	activePreset: string | null
	showColumnPanel: boolean
	setShowColumnPanel: (show: boolean) => void
	downloadCSV: (() => void) | undefined
	poolName: string
	setPoolName: (name: string) => void
	showFiltersPanel: boolean
	setShowFiltersPanel: (show: boolean) => void
	activeFilterCount: number
}

export function YieldsTableHeader({
	columnPresets,
	applyPreset,
	activePreset,
	showColumnPanel,
	setShowColumnPanel,
	downloadCSV,
	poolName,
	setPoolName,
	showFiltersPanel,
	setShowFiltersPanel,
	activeFilterCount
}: YieldsTableHeaderProps) {
	const presetOptions = React.useMemo(
		() =>
			Object.keys(columnPresets).map((preset) => ({
				value: preset,
				label: `${preset.slice(0, 1).toUpperCase()}${preset.slice(1)}`
			})),
		[columnPresets]
	)

	return (
		<div className="mb-3 text-primary">
			<div className="mb-3 flex items-center justify-end gap-4">
				<div className="flex items-center gap-2">
					<input
						type="text"
						placeholder="Search pools..."
						value={poolName}
						onChange={(e) => setPoolName(e.target.value)}
						className="w-full rounded-md border border-subtle bg-surface px-3 py-1.5 text-sm focus:border-primary focus:outline-hidden"
					/>
				</div>
			</div>

			{/* Wraps on a phone so the presets and the table actions each get a full row. */}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="min-w-0">
					<ProSegmented
						label="Column preset"
						value={activePreset}
						onValueChange={applyPreset}
						options={presetOptions}
					/>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{downloadCSV && <CSVExportButton onClick={downloadCSV} smol />}

					<button
						type="button"
						onClick={() => setShowFiltersPanel(!showFiltersPanel)}
						className="hover:bg-surface-secondary relative flex items-center gap-2 rounded-md border border-subtle bg-surface px-3 py-1.5 text-sm transition-colors"
					>
						<Icon name="align-left" height={14} width={14} />
						Filters
						{activeFilterCount > 0 ? (
							<span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-brand text-xs text-on-brand">
								{activeFilterCount}
							</span>
						) : null}
						<Icon name={showFiltersPanel ? 'chevron-up' : 'chevron-down'} height={12} width={12} />
					</button>
					<button
						type="button"
						onClick={() => setShowColumnPanel(!showColumnPanel)}
						className="hover:bg-surface-secondary flex items-center gap-2 rounded-md border border-subtle bg-surface px-3 py-1.5 text-sm transition-colors"
					>
						<Icon name="settings" height={14} width={14} />
						Customize Table
						<Icon name={showColumnPanel ? 'chevron-up' : 'chevron-down'} height={12} width={12} />
					</button>
				</div>
			</div>
		</div>
	)
}
