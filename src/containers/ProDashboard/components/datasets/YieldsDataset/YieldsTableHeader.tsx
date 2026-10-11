import * as React from 'react'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import {
	Input,
	searchFieldIconStyles,
	searchFieldInlineWrapperStyles,
	searchFieldInputPlacementStyles
} from '~/ui/Input'
import { SegmentedControl } from '~/ui/SegmentedControl'
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
	/** Closing a panel hands focus back to the toggle that opened it. */
	filtersToggleRef: React.RefObject<HTMLButtonElement | null>
	columnsToggleRef: React.RefObject<HTMLButtonElement | null>
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
	activeFilterCount,
	filtersToggleRef,
	columnsToggleRef
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
				<div className={searchFieldInlineWrapperStyles}>
					<Icon name="search" className={searchFieldIconStyles} />
					<Input
						type="text"
						aria-label="Search pools"
						placeholder="Search pools…"
						value={poolName}
						onChange={(e) => setPoolName(e.target.value)}
						className={searchFieldInputPlacementStyles}
					/>
				</div>
			</div>

			{/* Wraps on a phone so the presets and the table actions each get a full row. */}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="min-w-0">
					<SegmentedControl
						label="Column preset"
						variant="default"
						size="md"
						value={activePreset}
						onValueChange={applyPreset}
						options={presetOptions}
					/>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{downloadCSV && <CSVExportButton onClick={downloadCSV} smol />}

					<Button
						ref={filtersToggleRef}
						variant="secondary"
						size="md"
						aria-expanded={showFiltersPanel}
						onClick={() => setShowFiltersPanel(!showFiltersPanel)}
						className="relative"
					>
						<Icon name="align-left" className="size-3.5" />
						Filters
						{activeFilterCount > 0 ? (
							<span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-brand label-sm text-on-brand">
								{activeFilterCount}
							</span>
						) : null}
						<Icon name={showFiltersPanel ? 'chevron-up' : 'chevron-down'} className="size-3.5 text-tertiary" />
					</Button>
					<Button
						ref={columnsToggleRef}
						variant="secondary"
						size="md"
						aria-expanded={showColumnPanel}
						onClick={() => setShowColumnPanel(!showColumnPanel)}
					>
						<Icon name="settings" className="size-3.5" />
						Customize table
						<Icon name={showColumnPanel ? 'chevron-up' : 'chevron-down'} className="size-3.5 text-tertiary" />
					</Button>
				</div>
			</div>
		</div>
	)
}
