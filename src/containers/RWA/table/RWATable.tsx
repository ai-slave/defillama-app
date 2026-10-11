import { useRouter } from 'next/router'
import { useDeferredValue, useState } from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import {
	getColumnSelectState,
	getColumnVisibilityForSelection,
	getHideableColumns
} from '~/components/Table/search/columnSelect'
import { prepareTableCsv } from '~/components/Table/utils'
import { VirtualTable } from '~/components/Table/VirtualTable'
import { searchFieldInlineWrapperStyles } from '~/ui/Input'
import { Panel } from '~/ui/Panel'
import { SearchField } from '~/ui/SearchField'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { SelectWithCombobox } from '~/ui/SelectWithCombobox'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { pushShallowQuery } from '~/utils/routerQuery'
import type { RWAOverviewDisplayRow } from '../api.types'
import { useRWAFlowSummary } from '../flows.hooks'
import { getRwaPageLayout, type RWAPageKind } from '../layout/pageLayout'
import { RWA_CHANGE_PERIODS, RWA_DEFAULT_CHANGE_PERIOD, type RWAChangePeriod } from './change'
import type { RWAFlowStatus } from './columns/flows'
import { getRwaTableColumnSetQuery, parseRwaTableColumnSet, type RWATableColumnSet } from './columnSetQuery'
import { getRwaColumnOptions, getRwaColumnSet, leafColumns } from './columnSets'
import { getRwaCsvFileName } from './csv'
import type { RWAGroupBy, RWAPlatformLogos } from './groupBy'
import { RWATableColumnSetSwitch } from './toolbar/ColumnSetSwitch'
import { useRwaTable } from './useRwaTable'

/**
 * The row kind comes from the page kind and the Group by from the strip above the chart; the table owns its column
 * set, `?table=`, switched after its title.
 */
type RWATableProps = {
	assets: Array<RWAOverviewDisplayRow>
	groupBy: RWAGroupBy
	/** The 1d, 7d, 1m switch of asset rows; perps rows carry no prior values, so a perps table has none. */
	period?: RWAChangePeriod
	onPeriodChange?: (period: RWAChangePeriod) => void
	/** The page the table sits on: its rows, the page's own dimension it hides, and the csv name. */
	pageKind: RWAPageKind
	/** The page's scope slug (the chain, the venue, the asset), null on the overviews. */
	pageSlug: string | null
	includeBridgeTvl: boolean
	/** The group logos under Group by Platform. */
	platformLogos?: RWAPlatformLogos
	headerSlot?: React.ReactNode
}

export function RWATable(props: RWATableProps) {
	const router = useRouter()
	const { section } = getRwaPageLayout(props.pageKind)
	const columnSet = parseRwaTableColumnSet(router.query, section)
	const onColumnSetChange = (next: RWATableColumnSet) =>
		void pushShallowQuery(router, getRwaTableColumnSetQuery(next, router.query))
	// State restarts with the row kind, which shares no columns; a column set switch keeps the search, sort and groups.
	return <RWATableView key={section} {...props} columnSet={columnSet} onColumnSetChange={onColumnSetChange} />
}

function RWATableView({
	assets,
	groupBy,
	period = RWA_DEFAULT_CHANGE_PERIOD,
	onPeriodChange,
	pageKind,
	pageSlug,
	includeBridgeTvl,
	platformLogos,
	headerSlot,
	columnSet,
	onColumnSetChange
}: RWATableProps & { columnSet: RWATableColumnSet; onColumnSetChange: (columnSet: RWATableColumnSet) => void }) {
	const { section } = getRwaPageLayout(pageKind)
	const { data: flowSummary, isLoading, isError } = useRWAFlowSummary(section === 'assets')
	const flowStatus: RWAFlowStatus = isLoading ? 'loading' : isError && !flowSummary ? 'unavailable' : 'ready'
	const [searchValue, setSearchValue] = useState('')
	const search = useDeferredValue(searchValue)
	const { instance, columns, columnVisibility } = useRwaTable({
		assets,
		groupBy,
		search,
		flowSummary,
		flowStatus,
		period,
		includeBridgeTvl,
		platformLogos,
		columnSet,
		pageKind
	})

	/* Read from the columns and the visibility state, not the instance: the instance keeps its identity across
	   column set changes, so a memoized read of it would go stale. */
	const pickerColumns = leafColumns(columns).map((column) => ({ id: column.id, columnDef: column }))
	const hideableIds = new Set(getHideableColumns(pickerColumns).map((column) => column.id))
	const columnOptions = getRwaColumnOptions(columns, groupBy, pageKind).filter((option) => hideableIds.has(option.key))
	const { selected: selectedColumns } = getColumnSelectState(pickerColumns, columnVisibility)
	const setSelectedColumns = (next: Array<string> | ((prev: Array<string>) => Array<string>)) => {
		const resolved = Array.isArray(next) ? next : next(selectedColumns)
		instance.setColumnVisibility(getColumnVisibilityForSelection(pickerColumns, resolved))
	}
	const { csvPart, periodSwitch } = getRwaColumnSet(section, columnSet)

	return (
		<Panel>
			{/* The home page's Protocol Rankings header: a label-md title in the toolbar row, controls right. */}
			<div className="border-b border-subtle">
				<TableToolbar>
					<div className="mr-auto flex flex-wrap items-center gap-3">
						{headerSlot ?? <h2 className="label-md">{section === 'perps' ? 'Perps Rankings' : 'Assets Rankings'}</h2>}
						<RWATableColumnSetSwitch section={section} value={columnSet} onChange={onColumnSetChange} />
					</div>
					<TableToolbarControlGroup>
						<SearchField
							label={section === 'perps' ? 'Search markets' : 'Search assets'}
							value={searchValue}
							onChange={setSearchValue}
							placeholder={section === 'perps' ? 'Search markets…' : 'Search assets…'}
							className={searchFieldInlineWrapperStyles}
						/>
						{periodSwitch && onPeriodChange ? (
							<SegmentedControl
								variant="default"
								onValueChange={onPeriodChange}
								value={period}
								options={RWA_CHANGE_PERIODS.map((value) => ({ value, label: value }))}
								label="Change period"
								size="md"
							/>
						) : null}
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
							prepareCsv={() => prepareTableCsv({ instance, filename: getRwaCsvFileName(pageKind, pageSlug, csvPart) })}
							smol
							size="md"
						/>
					</TableToolbarControlGroup>
				</TableToolbar>
			</div>
			<VirtualTable table={instance} />
		</Panel>
	)
}
