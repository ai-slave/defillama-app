import { useDeferredValue, useState } from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { prepareTableCsv } from '~/components/Table/utils'
import { VirtualTable } from '~/components/Table/VirtualTable'
import { Icon } from '~/ui/Icon'
import { searchFieldIconStyles, searchFieldInlineWrapperStyles, searchFieldInputStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import type { RWAOverviewDisplayRow } from '../api.types'
import { useRWAFlowSummary } from '../flows.hooks'
import type { RWAChangePeriod } from './change'
import type { RWAFlowStatus } from './columns/flows'
import {
	getRwaColumnOptions,
	getRwaColumnVisibilityForSelection,
	getRwaSelectedColumnIds,
	RWA_TABLE_PRESETS,
	type RWATablePreset
} from './columnSets'
import { getRwaCsvRows } from './csv'
import type { RWAGroupBy, RWAPlatformLogos, RWATableView } from './groupBy'
import { RWATablePeriodSwitch } from './toolbar/PeriodSwitch'
import { useRwaTable } from './useRwaTable'

/** The view, the Group by and the CEX flag are set in the strip above the chart (RWATableControls); the table reads them. */
export type RWATableProps = {
	assets: Array<RWAOverviewDisplayRow>
	view: RWATableView
	groupBy: RWAGroupBy
	includeCex: boolean
	period: RWAChangePeriod
	onPeriodChange: (period: RWAChangePeriod) => void
	selectedChain: string
	includeBridgeTvl: boolean
	platformLogos: RWAPlatformLogos
	headerSlot?: React.ReactNode
	/** Shown when the view has no rows. */
	emptyMessage?: string
	/** The column set over the rows; a platform page's Compliance view shows the detail columns. */
	preset?: RWATablePreset
}

export function RWATable(props: RWATableProps) {
	// State restarts with the view and the preset; they share no column set.
	return <RWATableView key={`${props.view}-${props.preset ?? 'assets'}`} {...props} />
}

function RWATableView({
	assets,
	view,
	groupBy,
	includeCex,
	period,
	onPeriodChange,
	selectedChain,
	includeBridgeTvl,
	platformLogos,
	headerSlot,
	emptyMessage,
	preset = 'assets'
}: RWATableProps) {
	const { data: flowSummary, isLoading, isError } = useRWAFlowSummary()
	const flowStatus: RWAFlowStatus = isLoading ? 'loading' : isError && !flowSummary ? 'unavailable' : 'ready'
	const [searchValue, setSearchValue] = useState('')
	const search = useDeferredValue(searchValue)
	const { instance, columns, columnVisibility, rowCount } = useRwaTable({
		assets,
		view,
		groupBy,
		search,
		flowSummary,
		flowStatus,
		period,
		includeBridgeTvl,
		includeCex,
		platformLogos,
		preset
	})

	const columnOptions = getRwaColumnOptions(columns, groupBy)
	/* Read from the visibility state, not the instance: the instance keeps its identity across changes. */
	const selectedColumns = getRwaSelectedColumnIds(columns, columnVisibility)
	const setSelectedColumns = (next: Array<string> | ((prev: Array<string>) => Array<string>)) => {
		const resolved = new Set(Array.isArray(next) ? next : next(selectedColumns))
		instance.setColumnVisibility(getRwaColumnVisibilityForSelection(columns, resolved))
	}
	const csvFilename = getCsvFilename(view, selectedChain, includeBridgeTvl, preset)

	return (
		<Panel padding="none">
			{/* The home page's Protocol Rankings header: a label-md title in the toolbar row, controls right. */}
			<div className="border-b border-subtle">
				<TableToolbar>
					{headerSlot ?? (
						<h1 className="mr-auto label-md">
							{view === 'perps' ? 'Perps Rankings' : RWA_TABLE_PRESETS[preset].title}
						</h1>
					)}
					<TableToolbarControlGroup>
						<label className={searchFieldInlineWrapperStyles}>
							<span className="sr-only">Search assets</span>
							<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
							<input
								onInput={(event) => setSearchValue(event.currentTarget.value)}
								placeholder="Search assets..."
								className={searchFieldInputStyles}
							/>
						</label>
						{view === 'assets' ? <RWATablePeriodSwitch value={period} onChange={onPeriodChange} /> : null}
						<SelectWithCombobox
							allValues={columnOptions}
							selectedValues={selectedColumns}
							setSelectedValues={setSelectedColumns}
							nestedMenu={false}
							label="Columns"
							labelType="smol"
							variant="filter"
							size="md"
						/>
						<CSVDownloadButton
							prepareCsv={() => prepareTableCsv({ instance, filename: csvFilename, rows: getRwaCsvRows(instance) })}
							smol
							size="md"
						/>
					</TableToolbarControlGroup>
				</TableToolbar>
			</div>
			{rowCount === 0 && emptyMessage ? <p className="p-3 body-sm text-secondary">{emptyMessage}</p> : null}
			<VirtualTable table={instance} />
		</Panel>
	)
}

function getCsvFilename(
	view: RWATableView,
	selectedChain: string,
	includeBridgeTvl: boolean,
	preset: RWATablePreset
): string {
	const chainSuffix = selectedChain !== 'All' ? `-${selectedChain.toLowerCase()}` : ''
	const bridgeSuffix = view === 'assets' && !includeBridgeTvl ? '-without-bridge-tvl' : ''
	return `rwa-${RWA_TABLE_PRESETS[preset].csvName ?? view}${chainSuffix}${bridgeSuffix}`
}
