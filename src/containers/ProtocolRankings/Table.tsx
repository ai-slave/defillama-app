import * as Ariakit from '@ariakit/react'
import {
	createColumnHelper,
	functionalUpdate,
	useTable,
	type ExpandedState,
	type SortingState
} from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { startTransition, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Bookmark } from '~/components/Bookmark'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import { TVLRange } from '~/components/Filters/TVLRange'
import { BasicLink } from '~/components/Link'
import { ProtocolChainsHovercard } from '~/components/ProtocolChainsHovercard'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { expandedFilteredTableFeatures } from '~/components/Table/features/expandedFiltering'
import { getHideableColumns } from '~/components/Table/search/columnSelect'
import { TablePagesStatus } from '~/components/Table/TablePagesStatus'
import { prepareTableCsv } from '~/components/Table/utils'
import { VirtualTable } from '~/components/Table/VirtualTable'
import { TokenLogo } from '~/components/TokenLogo'
import { getProtocolTvlStrike } from '~/containers/ProtocolRankings/tvlStrike'
import { getCategoryRoute } from '~/containers/ProtocolTaxonomy/categoryRoutes'
import {
	useCustomColumns,
	useLocalStorageSettingsManager,
	type CustomColumnDef,
	type TvlSettingsKey
} from '~/contexts/LocalStorage'
import { removeStorageItem, setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import type { TablePageRequestResult } from '~/hooks/useTablePages'
import { definitions } from '~/public/definitions'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import {
	Input,
	searchFieldIconStyles,
	searchFieldInlineWrapperStyles,
	searchFieldInputPlacementStyles
} from '~/ui/Input'
import { PanelHeader, PanelTitle } from '~/ui/Panel'
import { PercentChange } from '~/ui/PercentChange'
import { popoverFooterActionStyles } from '~/ui/Popover'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { TagGroup } from '~/ui/SegmentedControl'
import { SurfaceLoadingOverlay } from '~/ui/Status'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { formatRatio, formatUsd } from '~/utils/numberFormat'
import { parseNumberQueryParam, pushShallowQuery } from '~/utils/routerQuery'
import { CustomColumnModal } from './CustomColumnModal'
import { parseProtocolTableColumnVisibility, replaceAliases, sampleProtocol } from './customColumnsUtils'
import { createFormulaEvaluator, formatCustomColumnValue, getSortableValue } from './formula.service'
import { prepareProtocolsForTable } from './prepareProtocolsForTable'
import { useRemoteProtocolRankingsTable } from './remoteTable'
import {
	PROTOCOL_RANKING_RESET_QUERY,
	PROTOCOL_RANKING_RESET_STORAGE_KEYS,
	PROTOCOL_RANKING_STORAGE_KEYS
} from './settings'
import {
	getProtocolRankingSortValue,
	PROTOCOL_RANKING_ACTIVITY_METRIC_KEYS,
	type ProtocolRankingActivityMetricKey,
	type ProtocolRankingSortKey
} from './sortAccessors'
import type { ProtocolRankingInitialPage } from './tableQuery'
import type { IProtocol } from './types'

const tableFeaturesConfig = expandedFilteredTableFeatures

type ChainProtocolsTableProps = {
	protocols: Array<IProtocol>
	sampleRow?: IProtocol
	useStickyHeader?: boolean
	borderless?: boolean
	headingAs?: 'h1' | 'h2'
	tvlSettings?: Record<TvlSettingsKey, boolean>
	suppressTvlStrike?: boolean
	showExtendedMetrics?: boolean
	chain?: string
	protocolRankings?: ProtocolRankingInitialPage
}

type TablePreset = (typeof TABLE_PRESET_VALUES)[number]
type TablePeriod = (typeof TABLE_PERIODS_VALUES)[number]

type TablePresetSelection =
	| { type: 'metric'; metric: TablePreset }
	| { type: 'period'; period: TablePeriod }
	| { type: 'metric-period'; metric: TablePreset; period: TablePeriod }

type ChainProtocolsTableInnerProps = ChainProtocolsTableProps & {
	selectedMetricPreset: TablePreset | null
	selectedPeriod: TablePeriod | null
	tablePresets: ReadonlyArray<TablePreset>
}

export function ChainProtocolsTable(props: ChainProtocolsTableProps) {
	const legacyFilterState = useStorageItem(legacyTableFilterStateKey, null)
	const storedMetricPreset = useStorageItem(tableMetricPresetKey, null)
	const storedPeriod = useStorageItem(tablePeriodKey, null)
	const normalizedLegacyFilterState = legacyFilterState === 'Volume' ? TABLE_PRESETS.SPOT : legacyFilterState
	const tablePresets = getTablePresets(
		props.protocols,
		props.showExtendedMetrics ?? false,
		props.protocolRankings?.availableActivityMetrics
	)
	const metricPresetCandidate = storedMetricPreset ?? normalizedLegacyFilterState
	const periodCandidate = storedPeriod ?? normalizedLegacyFilterState
	const selectedMetricPreset =
		isTablePreset(metricPresetCandidate) && tablePresets.includes(metricPresetCandidate) ? metricPresetCandidate : null
	const selectedPeriod = isTablePeriod(periodCandidate) ? periodCandidate : null

	return (
		<ChainProtocolsTableInner
			{...props}
			selectedMetricPreset={selectedMetricPreset}
			selectedPeriod={selectedPeriod}
			tablePresets={tablePresets}
		/>
	)
}

function ChainProtocolsTableInner({
	protocols,
	sampleRow = sampleProtocol,
	useStickyHeader = true,
	borderless = false,
	headingAs = 'h2',
	tvlSettings,
	suppressTvlStrike = false,
	showExtendedMetrics = false,
	chain = 'All',
	protocolRankings,
	selectedMetricPreset,
	selectedPeriod,
	tablePresets
}: ChainProtocolsTableInnerProps) {
	const { customColumns, setCustomColumns } = useCustomColumns()
	const remoteEnabled = protocolRankings !== undefined

	const router = useRouter()
	const [globalExtraTvlsEnabled] = useLocalStorageSettingsManager('tvl')
	const extraTvlsEnabled = tvlSettings ?? globalExtraTvlsEnabled
	const minTvl = parseNumberQueryParam(router.query.minTvl)
	const maxTvl = parseNumberQueryParam(router.query.maxTvl)
	const [ignoreTvlRangeDuringReset, setIgnoreTvlRangeDuringReset] = useState(false)
	const effectiveMinTvl = ignoreTvlRangeDuringReset ? null : minTvl
	const effectiveMaxTvl = ignoreTvlRangeDuringReset ? null : maxTvl
	if (ignoreTvlRangeDuringReset && minTvl === null && maxTvl === null) setIgnoreTvlRangeDuringReset(false)
	const [nameSearch, setNameSearch] = useState('')
	const deferredNameSearch = useDeferredValue(nameSearch.trim())
	const columnFilters = useMemo(
		() => (!remoteEnabled && deferredNameSearch ? [{ id: 'name', value: deferredNameSearch }] : []),
		[deferredNameSearch, remoteEnabled]
	)

	const rawColumnsInStorage = useStorageItem(tableColumnOptionsKey, defaultColumns)
	const columnsInStorage = useDeferredValue(rawColumnsInStorage)
	const availableActivityMetrics = useMemo(() => {
		const available = new Set<ProtocolRankingActivityMetricKey>()
		if (!showExtendedMetrics) return available
		if (remoteEnabled) {
			for (const key of protocolRankings?.availableActivityMetrics ?? []) available.add(key)
			return available
		}
		for (const protocol of protocols) {
			for (const metricKey of PROTOCOL_RANKING_ACTIVITY_METRIC_KEYS) {
				if (protocol[metricKey] !== undefined) available.add(metricKey)
			}
			if (available.size === PROTOCOL_RANKING_ACTIVITY_METRIC_KEYS.length) break
		}
		return available
	}, [protocolRankings, protocols, remoteEnabled, showExtendedMetrics])
	const availableColumnOptions = useMemo(
		() =>
			columnOptions.filter(
				(column) =>
					!column.extended ||
					(showExtendedMetrics && (!column.metricKey || availableActivityMetrics.has(column.metricKey)))
			),
		[availableActivityMetrics, showExtendedMetrics]
	)
	const getMainColumnForPreset = useCallback(
		(preset: TablePreset, period: TablePeriod | null) =>
			preset === TABLE_PRESETS.TVL
				? 'tvl'
				: ((period
						? availableColumnOptions.find((column) => column.preset === preset && column.period === period)?.key
						: availableColumnOptions.find(
								(column) => column.preset === preset && column.period === TABLE_PERIODS.ONE_DAY
							)?.key) ??
					availableColumnOptions.find((column) => column.preset === preset)?.key ??
					MAIN_COLUMN_BY_PRESET[preset]),
		[availableColumnOptions]
	)

	const [customColumnModalEditIndex, setCustomColumnModalEditIndex] = useState<number | null>(null)
	const [customColumnModalInitialValues, setCustomColumnModalInitialValues] = useState<
		Partial<CustomColumnDef> | undefined
	>(undefined)
	const presetSelection = useMemo(
		() => getTablePresetSelection(selectedMetricPreset, selectedPeriod),
		[selectedMetricPreset, selectedPeriod]
	)

	const customColumnDialogStore = Ariakit.useDialogStore()
	const customColumnDialogOpen = Ariakit.useStoreState(customColumnDialogStore, 'open')
	const handleAddCustomColumn = () => {
		setCustomColumnModalEditIndex(null)
		setCustomColumnModalInitialValues(undefined)
		customColumnDialogStore.toggle()
	}
	const handleEditCustomColumn = (idx: number) => {
		setCustomColumnModalEditIndex(idx)
		setCustomColumnModalInitialValues(customColumns[idx])
		customColumnDialogStore.toggle()
	}
	const handleDeleteCustomColumn = (idx: number) => {
		const next = customColumns.filter((_, i) => i !== idx)
		setCustomColumns(next)
	}
	const handleSaveCustomColumn = (def: CustomColumnDef) => {
		let next: Array<CustomColumnDef>
		let newColumnKey: string | undefined
		if (customColumnModalEditIndex === null) {
			next = [...customColumns, def]
			newColumnKey = `custom_formula_${customColumns.length}`
		} else {
			next = customColumns.map((col, i) => (i === customColumnModalEditIndex ? def : col))
		}
		setCustomColumns(next)
		customColumnDialogStore.toggle()

		if (newColumnKey) {
			clearPresetSelection()
			const allKeys = [...columnOptions.map((c) => c.key), ...next.map((_, idx) => `custom_formula_${idx}`)]
			const ops = presetSelection
				? getProtocolRankingPresetColumnVisibility(presetSelection, tablePresets)
				: parseProtocolTableColumnVisibility(localStorage.getItem(tableColumnOptionsKey))
			for (const key of allKeys) {
				if (key === newColumnKey) {
					ops[key] = true
				} else if (!Object.hasOwn(ops, key)) {
					ops[key] = false
				}
			}
			setStorageItem(tableColumnOptionsKey, JSON.stringify(ops))
		}
	}

	const { mergedColumns, columnVisibility, selectedColumns } = useMemo(() => {
		const customColumnOptions = customColumns.map((col, idx) => ({
			name: col.name,
			key: `custom_formula_${idx}`,
			isCustom: true,
			customIndex: idx,
			formula: col.formula,
			formatType: col.formatType
		}))
		const mergedColumns = [...availableColumnOptions, ...customColumnOptions]
		// An active preset is canonical; persisted columns belong only to manual column selection.
		const columnVisibility = presetSelection
			? getProtocolRankingPresetColumnVisibility(presetSelection, tablePresets)
			: {
					...getProtocolRankingDefaultColumnVisibility(customColumnOptions.length),
					...parseProtocolTableColumnVisibility(columnsInStorage)
				}
		if (presetSelection) {
			for (const column of customColumnOptions) columnVisibility[column.key] = false
		}
		for (const column of columnOptions) {
			if (column.extended && !availableColumnOptions.includes(column)) columnVisibility[column.key] = false
		}
		// Name is the identity column, which the table always shows; the remote CSV reads this map, so it keeps it too.
		columnVisibility.name = true
		const selectedColumns = mergedColumns.flatMap((column) => (columnVisibility[column.key] ? [column.key] : []))

		return { mergedColumns, columnVisibility, selectedColumns }
	}, [availableColumnOptions, customColumns, columnsInStorage, presetSelection, tablePresets])

	const setColumnOptions = (newColumns: Array<string>) => {
		clearPresetSelection()
		const allKeys = [
			...columnOptions.map((column) => column.key),
			...customColumns.map((_, idx) => `custom_formula_${idx}`)
		]
		const ops = Object.fromEntries(allKeys.map((key) => [key, newColumns.includes(key)]))
		setStorageItem(tableColumnOptionsKey, JSON.stringify(ops))
	}

	// The table sorts by the preset's main column. A sort the reader picks (a header, a preset, Reset) lasts while
	// that main column stays the one it was picked under. Persisted presets arrive after hydration and re-sort the
	// SSR-safe TVL table without remounting it, so search, expansion and loaded pages survive. Storage writes reach
	// the preset a task later, so a preset pick or Reset sets its sort here at once, in the same request.
	const presetSortId = selectedMetricPreset ? getMainColumnForPreset(selectedMetricPreset, selectedPeriod) : 'tvl'
	const [pickedSort, setPickedSort] = useState<{ presetSortId: string; sorting: SortingState } | null>(null)
	const sorting = useMemo<SortingState>(
		() => (pickedSort?.presetSortId === presetSortId ? pickedSort.sorting : [{ id: presetSortId, desc: true }]),
		[presetSortId, pickedSort]
	)
	const [expanded, setExpanded] = useState<ExpandedState>({})
	// Rows the user opened or closed during the current search; null until they toggle one.
	const [searchExpandedPick, setSearchExpandedPick] = useState<ExpandedState | null>(null)
	const userReplacementPendingRef = useRef(false)
	const chainQuery = router.query.chain
	const activeChain = Array.isArray(chainQuery) ? chainQuery[0] : chainQuery
	const exportColumns = useMemo(() => {
		const selected = new Set(selectedColumns)
		const result = []
		for (const column of mergedColumns) {
			if (!selected.has(column.key)) continue
			result.push({
				key: column.key,
				name: column.name,
				...('isCustom' in column && column.isCustom && column.formula ? { formula: column.formula } : {})
			})
		}
		return result
	}, [mergedColumns, selectedColumns])
	const remoteRankings = useRemoteProtocolRankingsTable({
		enabled: remoteEnabled,
		chain,
		initialRows: protocols,
		initialPage: protocolRankings,
		nameSearch,
		minTvl: effectiveMinTvl,
		maxTvl: effectiveMaxTvl,
		sorting,
		customColumns,
		extraTvlsEnabled,
		exportColumns,
		exportFilename: `defillama-${activeChain ?? 'all'}-protocols.csv`,
		onRequestSettled: ({ mode, status }: TablePageRequestResult) => {
			if (mode !== 'replace') return
			const userInitiated = userReplacementPendingRef.current
			userReplacementPendingRef.current = false
			if (status === 'error' && userInitiated) {
				toast.error("Couldn't update rankings. Please retry.", { id: 'protocol-rankings-update-error' })
			}
		}
	})
	const finalProtocols = useMemo(
		() =>
			remoteEnabled
				? remoteRankings.rows
				: prepareProtocolsForTable({
						protocols,
						extraTvlsEnabled,
						minTvl: effectiveMinTvl,
						maxTvl: effectiveMaxTvl,
						suppressTvlStrike
					}),
		[
			effectiveMaxTvl,
			effectiveMinTvl,
			extraTvlsEnabled,
			remoteEnabled,
			protocols,
			remoteRankings.rows,
			suppressTvlStrike
		]
	)

	const allColumns = useMemo(() => {
		const customColumnDefs = customColumns.map((col, idx) => {
			const columnId = `custom_formula_${idx}`
			const displayFormat = col.determinedFormat || col.formatType
			const evaluate = createFormulaEvaluator(replaceAliases(col.formula))

			return columnHelper.accessor(
				(row) => {
					const result = evaluate(row)
					return result.status === 'success' ? (getSortableValue(result.value, displayFormat) ?? undefined) : undefined
				},
				{
					id: columnId,
					header: col.name,
					cell: ({ row }) => {
						const result = evaluate(row.original)

						if (result.status === 'error') {
							return (
								<Tooltip content={result.error} className="cursor-help text-data-down">
									Err
								</Tooltip>
							)
						}

						if (result.status === 'missing') return null
						const value = result.value

						if (displayFormat === 'boolean' && typeof value === 'boolean') {
							return (
								<span
									title={value ? 'True' : 'False'}
									aria-label={value ? 'True' : 'False'}
									className="flex items-center"
								>
									{value ? '✅' : '❌'}
								</span>
							)
						}

						return <span className="flex items-center">{formatCustomColumnValue(value, displayFormat)}</span>
					},
					sortFn: (rowA, rowB, sortColumnId) => {
						const direction = rowA.table.getColumn(sortColumnId)?.getIsSorted()
						const desc = direction ? direction === 'desc' : true

						const a = getSortableValue(rowA.getValue(sortColumnId), displayFormat)
						const b = getSortableValue(rowB.getValue(sortColumnId), displayFormat)

						if (a === null && b !== null) {
							return desc ? -1 : 1
						}

						if (a !== null && b === null) {
							return desc ? 1 : -1
						}

						if (a === null && b === null) {
							return 0
						}

						if (displayFormat === 'string') {
							return String(a).localeCompare(String(b))
						} else if (displayFormat === 'boolean') {
							if (a === true && b === false) return 1
							if (a === false && b === true) return -1
							return 0
						}
						return Number(a) - Number(b)
					},
					meta: {
						headerClassName:
							displayFormat === 'string'
								? 'w-[220px] min-w-[220px]'
								: displayFormat === 'boolean'
									? 'w-[110px] min-w-[110px]'
									: 'w-[140px] min-w-[140px]',
						align: displayFormat === 'string' ? 'start' : displayFormat === 'boolean' ? 'center' : 'end',
						headerHelperText: col.formula
					}
				}
			)
		})

		if (customColumnDefs.length === 0) {
			return columns
		}

		return [
			...columns,
			{
				id: 'custom_columns',
				header: 'Custom Columns',
				columns: customColumnDefs
			}
		]
	}, [customColumns])

	// A remote search opens the parents it reached through their children until the user toggles a row.
	const searchExpanded = remoteEnabled ? remoteRankings.searchExpanded : null
	const tableExpanded = searchExpanded ? (searchExpandedPick ?? searchExpanded) : expanded

	const instance = useTable({
		features: tableFeaturesConfig,
		data: finalProtocols,
		columns: allColumns,
		state: {
			sorting,
			expanded: tableExpanded,
			columnVisibility,
			columnFilters
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		filterFromLeafRows: true,
		// Row ids are stable across pages and searches, so new rows must not collapse what the user opened; Reset clears it.
		autoResetExpanded: false,
		onExpandedChange: (updater) =>
			startTransition(() => {
				if (!searchExpanded) return setExpanded(updater)
				setSearchExpandedPick((pick) => functionalUpdate(updater, pick ?? searchExpanded))
			}),
		getSubRows: (row: IProtocol) => row.childProtocols,
		getRowId: (row, index, parent) => row.id ?? `${parent?.id ?? 'root'}:${row.slug || index}`,
		onSortingChange: (updater) => {
			userReplacementPendingRef.current = true
			setPickedSort({ presetSortId, sorting: typeof updater === 'function' ? updater(sorting) : updater })
		},
		manualSorting: remoteEnabled,
		manualFiltering: remoteEnabled
	})
	const hideableIds = new Set(getHideableColumns(instance.getAllLeafColumns()).map((column) => column.id))
	const pickerColumns = mergedColumns.filter((column) => hideableIds.has(column.key))
	const pickerSelectedColumns = selectedColumns.filter((key) => hideableIds.has(key))

	const setSortingForPresetSelection = (selection: TablePresetSelection) => {
		const metricPreset = selection.type === 'period' ? null : selection.metric
		const period = selection.type === 'metric' ? null : selection.period
		const id = metricPreset ? getMainColumnForPreset(metricPreset, period) : 'tvl'
		if (sorting.length !== 1 || sorting[0]?.id !== id || !sorting[0].desc) {
			userReplacementPendingRef.current = true
		}
		setPickedSort({ presetSortId, sorting: [{ id, desc: true }] })
	}
	const setMetricPreset = (metricPreset: TablePreset) => {
		removeStorageItem(legacyTableFilterStateKey)
		setStorageItem(tableMetricPresetKey, metricPreset)
		setSortingForPresetSelection(
			selectedPeriod
				? { type: 'metric-period', metric: metricPreset, period: selectedPeriod }
				: { type: 'metric', metric: metricPreset }
		)
	}
	const setPeriod = (period: TablePeriod) => {
		removeStorageItem(legacyTableFilterStateKey)
		setStorageItem(tablePeriodKey, period)
		setSortingForPresetSelection(
			selectedMetricPreset
				? { type: 'metric-period', metric: selectedMetricPreset, period }
				: { type: 'period', period }
		)
	}
	const resetTable = () => {
		if (
			nameSearch ||
			effectiveMinTvl !== null ||
			effectiveMaxTvl !== null ||
			sorting.length !== 1 ||
			sorting[0]?.id !== 'tvl' ||
			!sorting[0].desc
		) {
			userReplacementPendingRef.current = true
		}
		setNameSearch('')
		setExpanded({})
		setSearchExpandedPick(null)
		setPickedSort({ presetSortId, sorting: [{ id: 'tvl', desc: true }] })
		for (const key of PROTOCOL_RANKING_RESET_STORAGE_KEYS) removeStorageItem(key)
		setIgnoreTvlRangeDuringReset(true)
		void Promise.resolve(pushShallowQuery(router, PROTOCOL_RANKING_RESET_QUERY)).catch(() =>
			setIgnoreTvlRangeDuringReset(false)
		)
	}
	const primaryToolbarControls = (
		<>
			<label className={searchFieldInlineWrapperStyles}>
				<span className="sr-only">Search protocols by name</span>
				<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
				<Input
					type="search"
					value={nameSearch}
					onChange={(event) => {
						userReplacementPendingRef.current = true
						setNameSearch(event.currentTarget.value)
						// Each edit starts a fresh search, which opens its own parents even when the text repeats an earlier one.
						setSearchExpandedPick(null)
					}}
					placeholder="Search protocols..."
					autoComplete="off"
					className={searchFieldInputPlacementStyles}
				/>
			</label>
			<TagGroup
				variant="default"
				setValue={setPeriod}
				selectedValue={selectedPeriod}
				values={TABLE_PERIODS_VALUES}
				ariaLabel="Period"
				size="md"
			/>

			<SelectWithCombobox
				allValues={pickerColumns}
				selectedValues={pickerSelectedColumns}
				setSelectedValues={setColumnOptions}
				nestedMenu={false}
				label="Columns"
				labelType="smol"
				variant="filter"
				size="md"
				customFooter={
					<button className={popoverFooterActionStyles} onClick={handleAddCustomColumn} type="button">
						<Icon name="plus" height={14} width={14} />
						Add Custom Column
					</button>
				}
				onEditCustomColumn={handleEditCustomColumn}
				onDeleteCustomColumn={handleDeleteCustomColumn}
			/>
			<TVLRange
				size="md"
				onValueChange={(nextMinTvl, nextMaxTvl) => {
					if (nextMinTvl !== effectiveMinTvl || nextMaxTvl !== effectiveMaxTvl) {
						userReplacementPendingRef.current = true
					}
				}}
			/>
			{remoteEnabled ? (
				remoteRankings.csvButton
			) : (
				<CSVDownloadButton
					prepareCsv={() => prepareTableCsv({ instance, filename: `defillama-${activeChain ?? 'all'}-protocols` })}
					smol
					size="md"
				/>
			)}
		</>
	)
	const secondaryToolbarControls = (
		<div className="flex w-full items-center gap-2">
			<div className="min-w-0 flex-1 overflow-x-auto">
				<TagGroup
					variant="chips"
					setValue={setMetricPreset}
					selectedValue={selectedMetricPreset}
					values={tablePresets}
					ariaLabel="Metric view"
					size="md"
				/>
			</div>
			<Button type="button" size="md" className="ml-auto" onClick={resetTable}>
				Reset
			</Button>
		</div>
	)

	return (
		<div className={borderless ? 'isolate' : 'isolate rounded-lg border border-subtle bg-surface'}>
			{!borderless && headingAs === 'h1' ? (
				<PanelHeader>
					<PanelTitle as="h1">Protocol Rankings</PanelTitle>
					<TableToolbarControlGroup>{primaryToolbarControls}</TableToolbarControlGroup>
					<div className="w-full pt-1">{secondaryToolbarControls}</div>
				</PanelHeader>
			) : (
				<div className="border-b border-subtle">
					<TableToolbar>
						{borderless ? null : <h2 className="mr-auto label-md">Protocol Rankings</h2>}
						{primaryToolbarControls}
					</TableToolbar>
					<div className="px-2 pb-2">{secondaryToolbarControls}</div>
				</div>
			)}
			<div className="relative">
				<VirtualTable table={instance} useStickyHeader={useStickyHeader} />
				{remoteEnabled && remoteRankings.isReplacing ? <SurfaceLoadingOverlay label="Updating rankings…" /> : null}
			</div>
			{remoteEnabled ? (
				<TablePagesStatus
					noun="protocols"
					replacingLabel={null}
					replaceFailedLabel="Couldn't update rankings."
					sentinelRef={remoteRankings.sentinelRef}
					error={remoteRankings.error}
					isReplacing={remoteRankings.isReplacing}
					isLoadingMore={remoteRankings.isLoadingMore}
					rowCount={remoteRankings.rows.length}
					total={remoteRankings.total}
					hasMore={remoteRankings.hasMore}
					retry={remoteRankings.retry}
				/>
			) : null}
			{customColumnDialogOpen ? (
				<CustomColumnModal
					dialogStore={customColumnDialogStore}
					onSave={handleSaveCustomColumn}
					sampleRow={sampleRow}
					key={`custom-index-${customColumnModalEditIndex}`}
					{...customColumnModalInitialValues}
				/>
			) : null}
		</div>
	)
}

const tableColumnOptionsKey = PROTOCOL_RANKING_STORAGE_KEYS.columns
const legacyTableFilterStateKey = PROTOCOL_RANKING_STORAGE_KEYS.legacyPreset
const tableMetricPresetKey = PROTOCOL_RANKING_STORAGE_KEYS.metricPreset
const tablePeriodKey = PROTOCOL_RANKING_STORAGE_KEYS.period

function clearPresetSelection() {
	removeStorageItem(legacyTableFilterStateKey)
	removeStorageItem(tableMetricPresetKey)
	removeStorageItem(tablePeriodKey)
}

const TABLE_PRESETS = {
	FEES: 'Fees',
	REVENUE: 'Revenue',
	SPOT: 'Spot',
	PERPS: 'Perps',
	TVL: 'TVL'
} as const

enum TABLE_COLUMN_GROUPS {
	SPOT = 'Spot',
	PERPS = 'Perps',
	OPTIONS = 'Options',
	BRIDGES = 'Bridges'
}

const MAIN_COLUMN_BY_PRESET: Record<TablePreset, string> = {
	[TABLE_PRESETS.TVL]: 'tvl',
	[TABLE_PRESETS.FEES]: 'fees_24h',
	[TABLE_PRESETS.REVENUE]: 'revenue_24h',
	[TABLE_PRESETS.SPOT]: 'dex_volume_24h',
	[TABLE_PRESETS.PERPS]: 'perp_volume_24h'
}

const TABLE_PERIODS = {
	ONE_DAY: '1d',
	SEVEN_DAYS: '7d',
	ONE_MONTH: '1m'
} as const

const TABLE_PRESET_VALUES = [
	TABLE_PRESETS.FEES,
	TABLE_PRESETS.REVENUE,
	TABLE_PRESETS.SPOT,
	TABLE_PRESETS.PERPS,
	TABLE_PRESETS.TVL
] as const
const BASE_TABLE_PRESET_VALUES: ReadonlyArray<TablePreset> = [
	TABLE_PRESETS.FEES,
	TABLE_PRESETS.REVENUE,
	TABLE_PRESETS.SPOT,
	TABLE_PRESETS.TVL
]
const TABLE_PERIODS_VALUES = [TABLE_PERIODS.ONE_DAY, TABLE_PERIODS.SEVEN_DAYS, TABLE_PERIODS.ONE_MONTH] as const

function isTablePreset(value: string | null): value is TablePreset {
	return value != null && TABLE_PRESET_VALUES.some((preset) => preset === value)
}

function isTablePeriod(value: string | null): value is TablePeriod {
	return value != null && TABLE_PERIODS_VALUES.some((period) => period === value)
}

function getTablePresetSelection(metric: TablePreset | null, period: TablePeriod | null): TablePresetSelection | null {
	if (metric && period) return { type: 'metric-period', metric, period }
	if (metric) return { type: 'metric', metric }
	if (period) return { type: 'period', period }
	return null
}

function getTablePresets(
	protocols: Array<IProtocol>,
	showExtendedMetrics: boolean,
	availableActivityMetrics?: ReadonlyArray<string>
): ReadonlyArray<TablePreset> {
	if (!showExtendedMetrics) return BASE_TABLE_PRESET_VALUES

	const presets: Array<TablePreset> = [...BASE_TABLE_PRESET_VALUES]
	if (
		availableActivityMetrics?.some((key) =>
			['perps', 'normalizedVolume', 'activeLiquidity', 'openInterest'].includes(key)
		) ||
		protocols.some(
			(protocol) => protocol.perps || protocol.normalizedVolume || protocol.activeLiquidity || protocol.openInterest
		)
	) {
		presets.splice(3, 0, TABLE_PRESETS.PERPS)
	}
	return presets
}

type ProtocolTableColumnOption = {
	name: string
	key: string
	preset?: TablePreset
	period?: TablePeriod
	snapshot?: boolean
	extended?: boolean
	defaultVisible?: boolean
	metricKey?: ProtocolRankingActivityMetricKey
}

type ActivityPeriodColumn<Suffix extends '24h' | '7d' | '30d', Period extends TablePeriod> = {
	id: Extract<ProtocolRankingSortKey, `${string}_${Suffix}`>
	suffix: Suffix
	tablePeriod: Period
	helperText: string
	width: string
}

type ExtendedActivityMetric = {
	metricKey: Exclude<ProtocolRankingActivityMetricKey, 'openInterest' | 'activeLiquidity'>
	label: string
	group: TABLE_COLUMN_GROUPS
	preset?: TablePreset
	overlapWarning?: string
	columns: readonly [
		ActivityPeriodColumn<'24h', typeof TABLE_PERIODS.ONE_DAY>,
		ActivityPeriodColumn<'7d', typeof TABLE_PERIODS.SEVEN_DAYS>,
		ActivityPeriodColumn<'30d', typeof TABLE_PERIODS.ONE_MONTH>
	]
}

const EXTENDED_ACTIVITY_METRICS: ReadonlyArray<ExtendedActivityMetric> = [
	{
		metricKey: 'perps',
		label: 'Perp Volume',
		group: TABLE_COLUMN_GROUPS.PERPS,
		preset: TABLE_PRESETS.PERPS,
		columns: [
			{
				id: 'perp_volume_24h',
				suffix: '24h',
				tablePeriod: TABLE_PERIODS.ONE_DAY,
				helperText: definitions.perps.protocol['24h'],
				width: 'w-[154px] min-w-[154px]'
			},
			{
				id: 'perp_volume_7d',
				suffix: '7d',
				tablePeriod: TABLE_PERIODS.SEVEN_DAYS,
				helperText: definitions.perps.protocol['7d'],
				width: 'w-[143px] min-w-[143px]'
			},
			{
				id: 'perp_volume_30d',
				suffix: '30d',
				tablePeriod: TABLE_PERIODS.ONE_MONTH,
				helperText: definitions.perps.protocol['30d'],
				width: 'w-[154px] min-w-[154px]'
			}
		]
	},
	{
		metricKey: 'normalizedVolume',
		label: 'Normalized Volume',
		group: TABLE_COLUMN_GROUPS.PERPS,
		preset: TABLE_PRESETS.PERPS,
		columns: [
			{
				id: 'normalized_volume_24h',
				suffix: '24h',
				tablePeriod: TABLE_PERIODS.ONE_DAY,
				helperText: definitions.normalizedVolume.protocol['24h'],
				width: 'w-[199px] min-w-[199px]'
			},
			{
				id: 'normalized_volume_7d',
				suffix: '7d',
				tablePeriod: TABLE_PERIODS.SEVEN_DAYS,
				helperText: definitions.normalizedVolume.protocol['7d'],
				width: 'w-[189px] min-w-[189px]'
			},
			{
				id: 'normalized_volume_30d',
				suffix: '30d',
				tablePeriod: TABLE_PERIODS.ONE_MONTH,
				helperText: definitions.normalizedVolume.protocol['30d'],
				width: 'w-[199px] min-w-[199px]'
			}
		]
	},
	{
		metricKey: 'optionsPremiumVolume',
		label: 'Options Premium Volume',
		group: TABLE_COLUMN_GROUPS.OPTIONS,
		columns: [
			{
				id: 'options_premium_volume_24h',
				suffix: '24h',
				tablePeriod: TABLE_PERIODS.ONE_DAY,
				helperText: definitions.optionsPremium.protocol['24h'],
				width: 'w-[237px] min-w-[237px]'
			},
			{
				id: 'options_premium_volume_7d',
				suffix: '7d',
				tablePeriod: TABLE_PERIODS.SEVEN_DAYS,
				helperText: definitions.optionsPremium.protocol['7d'],
				width: 'w-[227px] min-w-[227px]'
			},
			{
				id: 'options_premium_volume_30d',
				suffix: '30d',
				tablePeriod: TABLE_PERIODS.ONE_MONTH,
				helperText: definitions.optionsPremium.protocol['30d'],
				width: 'w-[238px] min-w-[238px]'
			}
		]
	},
	{
		metricKey: 'optionsNotionalVolume',
		label: 'Options Notional Volume',
		group: TABLE_COLUMN_GROUPS.OPTIONS,
		columns: [
			{
				id: 'options_notional_volume_24h',
				suffix: '24h',
				tablePeriod: TABLE_PERIODS.ONE_DAY,
				helperText: definitions.optionsNotional.protocol['24h'],
				width: 'w-[234px] min-w-[234px]'
			},
			{
				id: 'options_notional_volume_7d',
				suffix: '7d',
				tablePeriod: TABLE_PERIODS.SEVEN_DAYS,
				helperText: definitions.optionsNotional.protocol['7d'],
				width: 'w-[224px] min-w-[224px]'
			},
			{
				id: 'options_notional_volume_30d',
				suffix: '30d',
				tablePeriod: TABLE_PERIODS.ONE_MONTH,
				helperText: definitions.optionsNotional.protocol['30d'],
				width: 'w-[234px] min-w-[234px]'
			}
		]
	},
	{
		metricKey: 'dexAggregators',
		label: 'DEX Aggregator Volume',
		group: TABLE_COLUMN_GROUPS.SPOT,
		overlapWarning: 'Routed volume can overlap spot venue volume; do not add them together',
		columns: [
			{
				id: 'dex_aggregator_volume_24h',
				suffix: '24h',
				tablePeriod: TABLE_PERIODS.ONE_DAY,
				helperText: definitions.dexAggregators.protocol['24h'],
				width: 'w-[230px] min-w-[230px]'
			},
			{
				id: 'dex_aggregator_volume_7d',
				suffix: '7d',
				tablePeriod: TABLE_PERIODS.SEVEN_DAYS,
				helperText: definitions.dexAggregators.protocol['7d'],
				width: 'w-[220px] min-w-[220px]'
			},
			{
				id: 'dex_aggregator_volume_30d',
				suffix: '30d',
				tablePeriod: TABLE_PERIODS.ONE_MONTH,
				helperText: definitions.dexAggregators.protocol['30d'],
				width: 'w-[230px] min-w-[230px]'
			}
		]
	},
	{
		metricKey: 'perpsAggregators',
		label: 'Perp Aggregator Volume',
		group: TABLE_COLUMN_GROUPS.PERPS,
		overlapWarning: 'Routed volume can overlap perp venue volume; do not add them together',
		columns: [
			{
				id: 'perp_aggregator_volume_24h',
				suffix: '24h',
				tablePeriod: TABLE_PERIODS.ONE_DAY,
				helperText: definitions.perpsAggregators.protocol['24h'],
				width: 'w-[233px] min-w-[233px]'
			},
			{
				id: 'perp_aggregator_volume_7d',
				suffix: '7d',
				tablePeriod: TABLE_PERIODS.SEVEN_DAYS,
				helperText: definitions.perpsAggregators.protocol['7d'],
				width: 'w-[223px] min-w-[223px]'
			},
			{
				id: 'perp_aggregator_volume_30d',
				suffix: '30d',
				tablePeriod: TABLE_PERIODS.ONE_MONTH,
				helperText: definitions.perpsAggregators.protocol['30d'],
				width: 'w-[233px] min-w-[233px]'
			}
		]
	},
	{
		metricKey: 'bridgeAggregators',
		label: 'Bridge Aggregator Volume',
		group: TABLE_COLUMN_GROUPS.BRIDGES,
		overlapWarning: 'Routed volume can overlap underlying bridge volume; do not add them together',
		columns: [
			{
				id: 'bridge_aggregator_volume_24h',
				suffix: '24h',
				tablePeriod: TABLE_PERIODS.ONE_DAY,
				helperText: definitions.bridgeAggregators.protocol['24h'],
				width: 'w-[245px] min-w-[245px]'
			},
			{
				id: 'bridge_aggregator_volume_7d',
				suffix: '7d',
				tablePeriod: TABLE_PERIODS.SEVEN_DAYS,
				helperText: definitions.bridgeAggregators.protocol['7d'],
				width: 'w-[235px] min-w-[235px]'
			},
			{
				id: 'bridge_aggregator_volume_30d',
				suffix: '30d',
				tablePeriod: TABLE_PERIODS.ONE_MONTH,
				helperText: definitions.bridgeAggregators.protocol['30d'],
				width: 'w-[246px] min-w-[246px]'
			}
		]
	}
]

const columnOptions: Array<ProtocolTableColumnOption> = [
	{ name: 'Name', key: 'name' },
	{ name: 'Category', key: 'category' },
	{
		name: 'TVL',
		key: 'tvl',
		preset: TABLE_PRESETS.TVL,
		snapshot: true
	},
	{ name: 'TVL 1d change', key: 'change_1d', preset: TABLE_PRESETS.TVL, period: TABLE_PERIODS.ONE_DAY },
	{ name: 'TVL 7d change', key: 'change_7d', preset: TABLE_PRESETS.TVL, period: TABLE_PERIODS.SEVEN_DAYS },
	{ name: 'TVL 1m change', key: 'change_1m', preset: TABLE_PRESETS.TVL, period: TABLE_PERIODS.ONE_MONTH },
	{ name: 'Token Price', key: 'token_price' },
	{ name: 'Market Cap', key: 'mcap' },
	{ name: 'Mcap/TVL', key: 'mcaptvl' },
	{ name: 'Fees 24h', key: 'fees_24h', preset: TABLE_PRESETS.FEES, period: TABLE_PERIODS.ONE_DAY },
	{ name: 'Fees 7d', key: 'fees_7d', preset: TABLE_PRESETS.FEES, period: TABLE_PERIODS.SEVEN_DAYS },
	{ name: 'Fees 30d', key: 'fees_30d', preset: TABLE_PRESETS.FEES, period: TABLE_PERIODS.ONE_MONTH },
	{
		name: 'Fees 1Y',
		key: 'fees_1y',
		preset: TABLE_PRESETS.FEES
	},
	{
		name: 'Monthly Avg 1Y Fees',
		key: 'average_fees_1y',
		preset: TABLE_PRESETS.FEES
	},
	{ name: 'Cumulative Fees', key: 'fees_cumulative', preset: TABLE_PRESETS.FEES },
	{ name: 'Revenue 24h', key: 'revenue_24h', preset: TABLE_PRESETS.REVENUE, period: TABLE_PERIODS.ONE_DAY },
	{ name: 'Revenue 7d', key: 'revenue_7d', preset: TABLE_PRESETS.REVENUE, period: TABLE_PERIODS.SEVEN_DAYS },
	{ name: 'Revenue 30d', key: 'revenue_30d', preset: TABLE_PRESETS.REVENUE, period: TABLE_PERIODS.ONE_MONTH },
	{ name: 'Revenue 1y', key: 'revenue_1y', preset: TABLE_PRESETS.REVENUE },
	{
		name: 'Monthly Avg 1Y Rev',
		key: 'average_revenue_1y',
		preset: TABLE_PRESETS.REVENUE
	},
	{ name: 'Cumulative Revenue', key: 'cumulativeRevenue', preset: TABLE_PRESETS.REVENUE },
	{
		name: 'Holders Revenue 24h',
		key: 'holdersRevenue_24h',
		preset: TABLE_PRESETS.REVENUE,
		period: TABLE_PERIODS.ONE_DAY
	},
	{
		name: 'Holders Revenue 7d',
		key: 'holdersRevenue_7d',
		preset: TABLE_PRESETS.REVENUE,
		period: TABLE_PERIODS.SEVEN_DAYS
	},
	{
		name: 'Holders Revenue 30d',
		key: 'holdersRevenue_30d',
		preset: TABLE_PRESETS.REVENUE,
		period: TABLE_PERIODS.ONE_MONTH
	},
	{ name: 'Holders Revenue 1y', key: 'holdersRevenue_1y', preset: TABLE_PRESETS.REVENUE },
	{
		name: 'Monthly Avg 1Y Holders Revenue',
		key: 'average_holdersRevenue_1y',
		preset: TABLE_PRESETS.REVENUE
	},
	{ name: 'Cumulative Holders Revenue', key: 'cumulativeHoldersRevenue', preset: TABLE_PRESETS.REVENUE },
	{ name: 'Incentives 24h', key: 'emissions_24h', preset: TABLE_PRESETS.REVENUE, period: TABLE_PERIODS.ONE_DAY },
	{ name: 'Incentives 7d', key: 'emissions_7d', preset: TABLE_PRESETS.REVENUE, period: TABLE_PERIODS.SEVEN_DAYS },
	{ name: 'Incentives 30d', key: 'emissions_30d', preset: TABLE_PRESETS.REVENUE, period: TABLE_PERIODS.ONE_MONTH },
	{
		name: 'Incentives 1Y',
		key: 'emissions_1y',
		preset: TABLE_PRESETS.REVENUE
	},
	{
		name: 'Monthly Avg 1Y Incentives',
		key: 'average_emissions_1y',
		preset: TABLE_PRESETS.REVENUE
	},
	{ name: 'Cumulative Incentives', key: 'cumulativeEmissions', preset: TABLE_PRESETS.REVENUE },
	{ name: 'Earnings 24h', key: 'earnings_24h', preset: TABLE_PRESETS.REVENUE, period: TABLE_PERIODS.ONE_DAY },
	{ name: 'Earnings 7d', key: 'earnings_7d', preset: TABLE_PRESETS.REVENUE, period: TABLE_PERIODS.SEVEN_DAYS },
	{ name: 'Earnings 30d', key: 'earnings_30d', preset: TABLE_PRESETS.REVENUE, period: TABLE_PERIODS.ONE_MONTH },
	{
		name: 'Earnings 1Y',
		key: 'earnings_1y',
		preset: TABLE_PRESETS.REVENUE
	},
	{
		name: 'Monthly Avg 1Y Earnings',
		key: 'average_earnings_1y',
		preset: TABLE_PRESETS.REVENUE
	},
	{
		name: 'Cumulative Earnings',
		key: 'cumulativeEarnings',
		preset: TABLE_PRESETS.REVENUE
	},
	{ name: 'P/S', key: 'ps', preset: TABLE_PRESETS.REVENUE },
	{ name: 'P/F', key: 'pf', preset: TABLE_PRESETS.FEES },
	{ name: 'Spot Volume 24h', key: 'dex_volume_24h', preset: TABLE_PRESETS.SPOT, period: TABLE_PERIODS.ONE_DAY },
	{ name: 'Spot Volume 7d', key: 'dex_volume_7d', preset: TABLE_PRESETS.SPOT, period: TABLE_PERIODS.SEVEN_DAYS },
	{
		name: 'Spot Volume 30d',
		key: 'dex_volume_30d',
		preset: TABLE_PRESETS.SPOT,
		period: TABLE_PERIODS.ONE_MONTH
	},
	{
		name: 'Spot Volume Change 7d',
		key: 'dex_volume_change_7d',
		preset: TABLE_PRESETS.SPOT,
		period: TABLE_PERIODS.SEVEN_DAYS
	},
	{ name: 'Spot Cumulative Volume', key: 'dex_cumulative_volume', preset: TABLE_PRESETS.SPOT },
	...EXTENDED_ACTIVITY_METRICS.flatMap((metric) =>
		metric.columns.map((column) => ({
			name: `${metric.label} ${column.suffix}`,
			key: column.id,
			...(metric.preset === undefined ? {} : { preset: metric.preset }),
			period: column.tablePeriod,
			extended: true,
			defaultVisible: false,
			metricKey: metric.metricKey
		}))
	),
	{
		name: 'Open Interest',
		key: 'open_interest',
		preset: TABLE_PRESETS.PERPS,
		snapshot: true,
		extended: true,
		defaultVisible: false,
		metricKey: 'openInterest'
	},
	{
		name: 'Active Liquidity',
		key: 'active_liquidity',
		preset: TABLE_PRESETS.PERPS,
		snapshot: true,
		extended: true,
		defaultVisible: false,
		metricKey: 'activeLiquidity'
	}
]

export function getProtocolRankingPresetColumnVisibility(
	selection: TablePresetSelection,
	availablePresets: ReadonlyArray<TablePreset>
): Record<string, boolean> {
	return Object.fromEntries(
		columnOptions.map((column) => {
			if (column.key === 'name' || column.key === 'category') return [column.key, true]
			if (column.preset == null || !availablePresets.includes(column.preset)) return [column.key, false]

			switch (selection.type) {
				case 'metric':
					return [column.key, column.preset === selection.metric]
				case 'period':
					return [column.key, column.period === selection.period || column.snapshot === true]
				case 'metric-period':
					return [
						column.key,
						column.preset === selection.metric && (column.period === selection.period || column.snapshot === true)
					]
				default: {
					const exhaustiveSelection: never = selection
					return exhaustiveSelection
				}
			}
		})
	)
}

const columnHelper = createColumnHelper<typeof tableFeaturesConfig, IProtocol>()

const protocolRankingAccessor = (key: ProtocolRankingSortKey) => (row: IProtocol) => {
	const value = getProtocolRankingSortValue(row, key)
	return typeof value === 'number' ? value : undefined
}

const activityMetricColumn = ({
	id,
	header,
	headerHelperText,
	headerClassName
}: {
	id: ProtocolRankingSortKey
	header: string
	headerHelperText: string
	headerClassName: string
}) =>
	columnHelper.accessor(protocolRankingAccessor(id), {
		id,
		header,
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName,
			align: 'end',
			headerHelperText
		}
	})

const activityMetricColumnsByGroup = (group: TABLE_COLUMN_GROUPS) =>
	EXTENDED_ACTIVITY_METRICS.filter((metric) => metric.group === group).flatMap((metric) =>
		metric.columns.map((column) =>
			activityMetricColumn({
				id: column.id,
				header: `${metric.label} ${column.suffix}`,
				headerHelperText:
					metric.overlapWarning === undefined ? column.helperText : `${column.helperText}. ${metric.overlapWarning}`,
				headerClassName: column.width
			})
		)
	)

const columns = columnHelper.columns([
	columnHelper.accessor('name', {
		id: 'name',
		enableHiding: false,
		header: 'Name',
		enableSorting: false,
		filterFn: 'includesString',
		cell: ({ getValue, row }) => {
			const value = getValue()

			return (
				<span className={`relative flex items-center gap-2 ${row.depth > 0 ? 'pl-12' : 'pl-6'}`}>
					{row.subRows?.length > 0 ? (
						<Button
							size="sm"
							variant="ghost"
							square
							type="button"
							className="absolute -left-1.5"
							aria-expanded={row.getIsExpanded()}
							{...{
								onClick: row.getToggleExpandedHandler()
							}}
						>
							{row.getIsExpanded() ? (
								<>
									<Icon name="chevron-down" height={16} width={16} className="text-tertiary" />
									<span className="sr-only">Hide child protocols</span>
								</>
							) : (
								<>
									<Icon name="chevron-right" height={16} width={16} className="text-tertiary" />
									<span className="sr-only">View child protocols</span>
								</>
							)}
						</Button>
					) : (
						<Bookmark size="sm" readableName={value} className="absolute -left-1.5 hidden lg:flex" />
					)}

					<span className="vf-row-index shrink-0" aria-hidden="true" />

					<TokenLogo src={row.original.logo} data-lgonly alt={`Logo of ${row.original.name}`} />

					<span className="-my-2 flex flex-col">
						<span className="flex items-center gap-1 overflow-hidden">
							<BasicLink
								href={`/protocol/${row.original.slug}`}
								className="min-w-0 truncate label-md text-link hover:underline"
							>
								{value}
							</BasicLink>
							{row.original.deprecated ? <DeprecatedProtocolMarker /> : null}
						</span>

						<ProtocolChainsHovercard chains={row.original.chains} />
					</span>
					{value === 'SyncDEX Finance' ? (
						<Tooltip content="Many users have reported issues with this protocol">
							<Icon name="alert-triangle" height={14} width={14} />
						</Tooltip>
					) : null}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[200px] min-w-[200px] lg:w-[257px] lg:min-w-[257px]'
		}
	}),
	columnHelper.accessor('category', {
		id: 'category',
		header: 'Category',
		enableSorting: false,
		cell: ({ getValue }) => {
			const category = getValue()

			if (!category) return ''

			const href = getCategoryRoute(slug(category))

			return (
				<BasicLink href={href} className="label-md text-link hover:underline">
					{category}
				</BasicLink>
			)
		},
		meta: {
			headerClassName: 'w-[139px] min-w-[139px]'
		}
	}),
	columnHelper.group({
		id: 'tvl',
		header: 'TVL',
		columns: columnHelper.columns([
			columnHelper.accessor(protocolRankingAccessor('tvl'), {
				id: 'tvl',
				header: 'TVL',
				cell: ({ row }) =>
					row.original.tvl ? (
						row.original.strikeTvl || row.original.tvl.excludeParent ? (
							<ProtocolTvlCell rowValues={row.original} />
						) : (
							formatUsd(row.original.tvl.default.tvl, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})
						)
					) : null,
				meta: {
					headerClassName: 'w-[120px] min-w-[120px]',
					align: 'end',
					headerHelperText: 'Value of all coins held in smart contracts of the protocol'
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('change_1d'), {
				id: 'change_1d',
				header: '1d Change',
				cell: ({ getValue }) => <PercentChange percent={getValue()} />,
				meta: {
					headerClassName: 'w-[109px] min-w-[109px]',
					align: 'end',
					headerHelperText: 'Change in TVL in the last 24 hours'
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('change_7d'), {
				id: 'change_7d',
				header: '7d Change',
				cell: ({ getValue }) => <PercentChange percent={getValue()} />,
				meta: {
					headerClassName: 'w-[110px] min-w-[110px]',
					align: 'end',
					headerHelperText: 'Change in TVL in the last 7 days'
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('change_1m'), {
				id: 'change_1m',
				header: '1m Change',
				cell: ({ getValue }) => <PercentChange percent={getValue()} />,
				meta: {
					headerClassName: 'w-[112px] min-w-[112px]',
					align: 'end',
					headerHelperText: 'Change in TVL in the last 30 days'
				}
			})
		]),
		meta: { headerHelperText: 'Value of all coins held in smart contracts of the protocol' }
	}),
	columnHelper.accessor(protocolRankingAccessor('mcap'), {
		id: 'mcap',
		header: 'Market Cap',
		cell: ({ getValue }) =>
			getValue() != null
				? formatUsd(getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[120px] min-w-[120px]',
			align: 'end',
			headerHelperText: 'Current protocol token market cap'
		}
	}),
	columnHelper.accessor(protocolRankingAccessor('token_price'), {
		id: 'token_price',
		header: 'Token Price',
		cell: ({ getValue }) =>
			getValue() != null
				? formatUsd(getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[120px] min-w-[120px]',
			align: 'end',
			headerHelperText: 'Current protocol token price'
		}
	}),
	columnHelper.accessor(protocolRankingAccessor('mcaptvl'), {
		id: 'mcaptvl',
		header: 'Mcap/TVL',
		cell: (info) => formatRatio(info.getValue()),
		meta: {
			headerClassName: 'w-[110px] min-w-[110px]',
			align: 'end',
			headerHelperText: 'Market cap / TVL ratio'
		}
	}),
	columnHelper.group({
		id: 'fees',
		header: 'Fees & Revenue',
		columns: columnHelper.columns([
			columnHelper.accessor(protocolRankingAccessor('fees_24h'), {
				id: 'fees_24h',
				header: 'Fees 24h',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[100px] min-w-[100px]',
					align: 'end',
					headerHelperText: definitions.fees.protocol['24h']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('revenue_24h'), {
				id: 'revenue_24h',
				header: 'Revenue 24h',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[126px] min-w-[126px]',
					align: 'end',
					headerHelperText: definitions.revenue.protocol['24h']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('holdersRevenue_24h'), {
				id: 'holdersRevenue_24h',
				header: 'Holders Revenue 24h',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[182px] min-w-[182px]',
					align: 'end',
					headerHelperText: definitions.holdersRevenue.protocol['24h']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('emissions_24h'), {
				id: 'emissions_24h',
				header: 'Incentives 24h',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[137px] min-w-[137px]',
					align: 'end',
					headerHelperText: definitions.incentives.protocol['24h']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('fees_7d'), {
				id: 'fees_7d',
				header: 'Fees 7d',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[90px] min-w-[90px]',
					align: 'end',
					headerHelperText: definitions.fees.protocol['7d']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('revenue_7d'), {
				id: 'revenue_7d',
				header: 'Revenue 7d',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[116px] min-w-[116px]',
					align: 'end',
					headerHelperText: definitions.revenue.protocol['7d']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('holdersRevenue_7d'), {
				id: 'holdersRevenue_7d',
				header: 'Holders Revenue 7d',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[172px] min-w-[172px]',
					align: 'end',
					headerHelperText: definitions.holdersRevenue.protocol['7d']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('emissions_7d'), {
				id: 'emissions_7d',
				header: 'Incentives 7d',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[127px] min-w-[127px]',
					align: 'end',
					headerHelperText: definitions.incentives.protocol['7d']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('fees_30d'), {
				id: 'fees_30d',
				header: 'Fees 30d',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[100px] min-w-[100px]',
					align: 'end',
					headerHelperText: definitions.fees.protocol['30d']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('revenue_30d'), {
				id: 'revenue_30d',
				header: 'Revenue 30d',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[127px] min-w-[127px]',
					align: 'end',
					headerHelperText: definitions.revenue.protocol['30d']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('holdersRevenue_30d'), {
				id: 'holdersRevenue_30d',
				header: 'Holders Revenue 30d',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[183px] min-w-[183px]',
					align: 'end',
					headerHelperText: definitions.holdersRevenue.protocol['30d']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('emissions_30d'), {
				id: 'emissions_30d',
				header: 'Incentives 30d',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[137px] min-w-[137px]',
					align: 'end',
					headerHelperText: definitions.incentives.protocol['30d']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('fees_1y'), {
				id: 'fees_1y',
				header: 'Fees 1Y',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[93px] min-w-[93px]',
					align: 'end',
					headerHelperText: definitions.fees.protocol['1y']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('average_fees_1y'), {
				id: 'average_fees_1y',
				header: 'Monthly Avg 1Y Fees',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[177px] min-w-[177px]',
					align: 'end',
					headerHelperText: definitions.fees.protocol['monthlyAverage1y']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('revenue_1y'), {
				id: 'revenue_1y',
				header: 'Revenue 1Y',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[116px] min-w-[116px]',
					align: 'end',
					headerHelperText: definitions.revenue.protocol['1y']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('holdersRevenue_1y'), {
				id: 'holdersRevenue_1y',
				header: 'Holders Revenue 1Y',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[172px] min-w-[172px]',
					align: 'end',
					headerHelperText: definitions.holdersRevenue.protocol['1y']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('average_revenue_1y'), {
				id: 'average_revenue_1y',
				header: 'Monthly Avg 1Y Rev',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[170px] min-w-[170px]',
					align: 'end',
					headerHelperText: definitions.revenue.protocol['monthlyAverage1y']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('average_holdersRevenue_1y'), {
				id: 'average_holdersRevenue_1y',
				header: 'Monthly Avg 1Y Holders Revenue',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[259px] min-w-[259px]',
					align: 'end',
					headerHelperText: definitions.holdersRevenue.protocol['monthlyAverage1y']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('emissions_1y'), {
				id: 'emissions_1y',
				header: 'Incentives 1Y',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[127px] min-w-[127px]',
					align: 'end',
					headerHelperText: definitions.incentives.protocol['1y']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('average_emissions_1y'), {
				id: 'average_emissions_1y',
				header: 'Monthly Avg 1Y Incentives',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[214px] min-w-[214px]',
					align: 'end',
					headerHelperText: definitions.incentives.protocol['monthlyAverage1y']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('fees_cumulative'), {
				id: 'fees_cumulative',
				header: 'Cumulative Fees',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[149px] min-w-[149px]',
					align: 'end',
					headerHelperText: definitions.fees.protocol['cumulative']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('cumulativeRevenue'), {
				id: 'cumulativeRevenue',
				header: 'Cumulative Revenue',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[175px] min-w-[175px]',
					align: 'end',
					headerHelperText: definitions.revenue.protocol['cumulative']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('cumulativeHoldersRevenue'), {
				id: 'cumulativeHoldersRevenue',
				header: 'Cumulative Holders Revenue',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[231px] min-w-[231px]',
					align: 'end',
					headerHelperText: definitions.holdersRevenue.protocol['cumulative']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('cumulativeEmissions'), {
				id: 'cumulativeEmissions',
				header: 'Cumulative Incentives',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[186px] min-w-[186px]',
					align: 'end',
					headerHelperText: definitions.incentives.protocol['cumulative']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('pf'), {
				id: 'pf',
				header: 'P/F',
				cell: (info) => (info.getValue() != null ? `${formatRatio(info.getValue())}x` : null),
				meta: {
					headerClassName: 'w-[68px] min-w-[68px]',
					align: 'end',
					headerHelperText: definitions.fees.protocol['pf']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('ps'), {
				id: 'ps',
				header: 'P/S',
				cell: (info) => (info.getValue() != null ? `${formatRatio(info.getValue())}x` : null),
				meta: {
					headerClassName: 'w-[67px] min-w-[67px]',
					align: 'end',
					headerHelperText: definitions.revenue.protocol['ps']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('earnings_24h'), {
				id: 'earnings_24h',
				header: 'Earnings 24h',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,

				meta: {
					headerClassName: 'w-[127px] min-w-[127px]',
					align: 'end',
					headerHelperText: definitions.earnings.protocol['24h']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('earnings_7d'), {
				id: 'earnings_7d',
				header: 'Earnings 7d',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,

				meta: {
					headerClassName: 'w-[117px] min-w-[117px]',
					align: 'end',
					headerHelperText: definitions.earnings.protocol['7d']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('earnings_30d'), {
				id: 'earnings_30d',
				header: 'Earnings 30d',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[127px] min-w-[127px]',
					align: 'end',
					headerHelperText: definitions.earnings.protocol['30d']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('earnings_1y'), {
				id: 'earnings_1y',
				header: 'Earnings 1Y',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[116px] min-w-[116px]',
					align: 'end',
					headerHelperText: definitions.earnings.protocol['1y']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('average_earnings_1y'), {
				id: 'average_earnings_1y',
				header: 'Monthly Avg 1Y Earnings',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})
						: null,
				meta: {
					headerClassName: 'w-[204px] min-w-[204px]',
					align: 'end',
					headerHelperText: definitions.earnings.protocol['monthlyAverage1y']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('cumulativeEarnings'), {
				id: 'cumulativeEarnings',
				header: 'Cumulative Earnings',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[176px] min-w-[176px]',
					align: 'end',
					headerHelperText: definitions.earnings.protocol['cumulative']
				}
			})
		]),
		meta: {
			headerHelperText: `${definitions.fees.common}\n\n${definitions.revenue.common}\n\n${definitions.holdersRevenue.common}`
		}
	}),
	columnHelper.group({
		id: 'spot',
		header: 'Spot Volume',
		columns: columnHelper.columns([
			columnHelper.accessor(protocolRankingAccessor('dex_volume_24h'), {
				id: 'dex_volume_24h',
				header: 'Spot Volume 24h',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[153px] min-w-[153px]',
					align: 'end',
					headerHelperText: definitions.dexs.protocol['24h']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('dex_volume_7d'), {
				id: 'dex_volume_7d',
				header: 'Spot Volume 7d',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[143px] min-w-[143px]',
					align: 'end',
					headerHelperText: definitions.dexs.protocol['7d']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('dex_volume_30d'), {
				id: 'dex_volume_30d',
				header: 'Spot Volume 30d',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[154px] min-w-[154px]',
					align: 'end',
					headerHelperText: definitions.dexs.protocol['30d']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('dex_volume_change_7d'), {
				id: 'dex_volume_change_7d',
				header: 'Spot Change 7d',
				cell: ({ getValue }) => (getValue() !== 0 ? <PercentChange percent={getValue()} /> : null),
				meta: {
					headerClassName: 'w-[145px] min-w-[145px]',
					align: 'end',
					headerHelperText: definitions.dexs.protocol['change7d']
				}
			}),
			columnHelper.accessor(protocolRankingAccessor('dex_cumulative_volume'), {
				id: 'dex_cumulative_volume',
				header: 'Spot Cumulative Volume',
				cell: (info) =>
					info.getValue() != null
						? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null,
				meta: {
					headerClassName: 'w-[202px] min-w-[202px]',
					align: 'end',
					headerHelperText: definitions.dexs.protocol['cumulative']
				}
			}),
			...activityMetricColumnsByGroup(TABLE_COLUMN_GROUPS.SPOT)
		]),
		meta: {
			headerHelperText: definitions.dexs.common
		}
	}),
	columnHelper.group({
		id: 'perps',
		header: 'Perps',
		columns: [
			...activityMetricColumnsByGroup(TABLE_COLUMN_GROUPS.PERPS),
			activityMetricColumn({
				id: 'open_interest',
				header: 'Open Interest',
				headerHelperText: definitions.openInterest.protocol,
				headerClassName: 'w-[129px] min-w-[129px]'
			}),
			activityMetricColumn({
				id: 'active_liquidity',
				header: 'Active Liquidity',
				headerHelperText: definitions.activeLiquidity.protocol,
				headerClassName: 'w-[142px] min-w-[142px]'
			})
		],
		meta: {
			headerHelperText: `${definitions.perps.common}\n\n${definitions.normalizedVolume.common}\n\n${definitions.openInterest.common}\n\n${definitions.activeLiquidity.common}`
		}
	}),
	columnHelper.group({
		id: 'options',
		header: 'Options',
		columns: activityMetricColumnsByGroup(TABLE_COLUMN_GROUPS.OPTIONS),
		meta: {
			headerHelperText: `${definitions.optionsPremium.common}\n\n${definitions.optionsNotional.common}`
		}
	}),
	columnHelper.group({
		id: 'bridges',
		header: 'Bridges',
		columns: activityMetricColumnsByGroup(TABLE_COLUMN_GROUPS.BRIDGES),
		meta: {
			headerHelperText: definitions.bridgeAggregators.common
		}
	})
])
const defaultColumns = JSON.stringify({
	name: true,
	category: true,
	tvl: true,
	change_1d: true,
	change_7d: true,
	change_1m: true,
	mcap: true,
	token_price: true,
	fees_24h: true,
	revenue_24h: true
})

export function getProtocolRankingDefaultColumnVisibility(customColumnCount = 0): Record<string, boolean> {
	const configuredDefaults = parseProtocolTableColumnVisibility(defaultColumns)
	const visibility = Object.fromEntries(
		columnOptions.map((column) => [column.key, configuredDefaults[column.key] === true])
	)
	for (let index = 0; index < customColumnCount; index++) visibility[`custom_formula_${index}`] = false
	return visibility
}

function ProtocolTvlCell({ rowValues }: { rowValues: IProtocol }) {
	// Same settings source the toolbar's "Include in TVL" menu writes to, so the
	// strike marker reacts to the toggles in the same render pass.
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl')
	const tvl = rowValues.tvl
	if (!tvl) return null

	const strike = getProtocolTvlStrike(rowValues, extraTvlsEnabled)

	return (
		<span className="flex items-center justify-end gap-1">
			{strike.text ? <QuestionHelper text={strike.text} /> : null}
			{tvl.excludeParent && rowValues.childProtocols ? (
				<QuestionHelper text="There's some internal doublecounting that is excluded from parent TVL, so sum won't match" />
			) : null}
			<span className={strike.struck ? 'text-tertiary' : ''}>
				{formatUsd(tvl.default.tvl, {
					compact: true,
					minimumCompactValue: 1_000_000,
					compactSuffix: 'lowercase'
				})}
			</span>
		</span>
	)
}
