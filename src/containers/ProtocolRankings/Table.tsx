import * as Ariakit from '@ariakit/react'
import {
	createColumnHelper,
	getCoreRowModel,
	getExpandedRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	useReactTable,
	type ExpandedState,
	type SortingState
} from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { startTransition, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react'
import { Bookmark } from '~/components/Bookmark'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import { TVLRange } from '~/components/Filters/TVLRange'
import { BasicLink } from '~/components/Link'
import { ProtocolChainsHovercard } from '~/components/ProtocolChainsHovercard'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { VirtualTable } from '~/components/Table/Table'
import { prepareTableCsv } from '~/components/Table/utils'
import { TokenLogo } from '~/components/TokenLogo'
import { removedCategoriesFromChainTvlSet } from '~/containers/ProtocolRankings/constants'
import { getCategoryRoute } from '~/containers/ProtocolTaxonomy/categoryRoutes'
import {
	useCustomColumns,
	useLocalStorageSettingsManager,
	type CustomColumnDef,
	type TvlSettingsKey
} from '~/contexts/LocalStorage'
import { removeStorageItem, setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import { definitions } from '~/public/definitions'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { searchFieldIconStyles, searchFieldInlineWrapperStyles, searchFieldInputStyles } from '~/ui/Input'
import { PanelHeader, PanelTitle } from '~/ui/Panel'
import { PercentChange } from '~/ui/PercentChange'
import { popoverFooterActionStyles } from '~/ui/Popover'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { TagGroup } from '~/ui/SegmentedControl'
import { TableToolbar, TableToolbarControlGroup } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { formatRatio, formatUsd } from '~/utils/numberFormat'
import { parseNumberQueryParam, pushShallowQuery } from '~/utils/routerQuery'
import { CustomColumnModal } from './CustomColumnModal'
import { parseProtocolTableColumnVisibility, replaceAliases, sampleProtocol } from './customColumnsUtils'
import { createFormulaEvaluator, formatCustomColumnValue, getSortableValue } from './formula.service'
import { prepareProtocolsForTable } from './prepareProtocolsForTable'
import { getProtocolEarningsValue } from './readModel'
import type { IProtocol } from './types'

type ChainProtocolsTableProps = {
	protocols: Array<IProtocol>
	sampleRow?: IProtocol
	useStickyHeader?: boolean
	borderless?: boolean
	headingAs?: 'h1' | 'h2'
	tvlSettings?: Record<TvlSettingsKey, boolean>
	suppressTvlStrike?: boolean
	showExtendedMetrics?: boolean
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
	tablePresets: readonly TablePreset[]
}

export const ChainProtocolsTable = (props: ChainProtocolsTableProps) => {
	const legacyFilterState = useStorageItem(legacyTableFilterStateKey, null)
	const storedMetricPreset = useStorageItem(tableMetricPresetKey, null)
	const storedPeriod = useStorageItem(tablePeriodKey, null)
	const normalizedLegacyFilterState = legacyFilterState === 'Volume' ? TABLE_PRESETS.SPOT : legacyFilterState
	const tablePresets = getTablePresets(props.protocols, props.showExtendedMetrics ?? false)
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

const ChainProtocolsTableInner = ({
	protocols,
	sampleRow = sampleProtocol,
	useStickyHeader = true,
	borderless = false,
	headingAs = 'h2',
	tvlSettings,
	suppressTvlStrike = false,
	showExtendedMetrics = false,
	selectedMetricPreset,
	selectedPeriod,
	tablePresets
}: ChainProtocolsTableInnerProps) => {
	const { customColumns, setCustomColumns } = useCustomColumns()

	const router = useRouter()
	const [globalExtraTvlsEnabled] = useLocalStorageSettingsManager('tvl')
	const extraTvlsEnabled = tvlSettings ?? globalExtraTvlsEnabled
	const minTvl = parseNumberQueryParam(router.query.minTvl)
	const maxTvl = parseNumberQueryParam(router.query.maxTvl)
	const [nameSearch, setNameSearch] = useState('')
	const deferredNameSearch = useDeferredValue(nameSearch.trim())
	const columnFilters = useMemo(
		() => (deferredNameSearch ? [{ id: 'name', value: deferredNameSearch }] : []),
		[deferredNameSearch]
	)

	const finalProtocols = useMemo(
		() =>
			prepareProtocolsForTable({
				protocols,
				extraTvlsEnabled,
				minTvl,
				maxTvl,
				suppressTvlStrike
			}),
		[protocols, extraTvlsEnabled, minTvl, maxTvl, suppressTvlStrike]
	)

	const rawColumnsInStorage = useStorageItem(tableColumnOptionsKey, defaultColumns)
	const columnsInStorage = useDeferredValue(rawColumnsInStorage)
	const availableActivityMetrics = useMemo(() => {
		const available = new Set<ActivityMetricKey>()
		if (!showExtendedMetrics) return available
		for (const protocol of protocols) {
			for (const metricKey of ACTIVITY_METRIC_KEYS) {
				if (protocol[metricKey] !== undefined) available.add(metricKey)
			}
			if (available.size === ACTIVITY_METRIC_KEYS.length) break
		}
		return available
	}, [protocols, showExtendedMetrics])
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
	const clearPresetSelection = () => {
		removeStorageItem(legacyTableFilterStateKey)
		removeStorageItem(tableMetricPresetKey)
		removeStorageItem(tablePeriodKey)
	}
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
		let next: CustomColumnDef[]
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
		const selectedColumns = mergedColumns.flatMap((column) => (columnVisibility[column.key] ? [column.key] : []))

		return { mergedColumns, columnVisibility, selectedColumns }
	}, [availableColumnOptions, customColumns, columnsInStorage, presetSelection, tablePresets])

	const setColumnOptions = (newColumns: string[]) => {
		clearPresetSelection()
		const allKeys = [
			...columnOptions.map((column) => column.key),
			...customColumns.map((_, idx) => `custom_formula_${idx}`)
		]
		const ops = Object.fromEntries(allKeys.map((key) => [key, newColumns.includes(key)]))
		setStorageItem(tableColumnOptionsKey, JSON.stringify(ops))
	}

	const [sorting, setSorting] = useState<SortingState>([
		{
			desc: true,
			id: selectedMetricPreset ? getMainColumnForPreset(selectedMetricPreset, selectedPeriod) : 'tvl'
		}
	])
	const [expanded, setExpanded] = useState<ExpandedState>({})
	const sortingRef = useRef(sorting)
	sortingRef.current = sorting

	const allColumns = useMemo(() => {
		const customColumnDefs = customColumns.map((col, idx) => {
			const columnId = `custom_formula_${idx}`
			const displayFormat = col.determinedFormat || col.formatType
			const evaluate = createFormulaEvaluator(replaceAliases(col.formula))

			return columnHelper.accessor(
				(row) => {
					const result = evaluate(row)
					return result.status === 'success' ? getSortableValue(result.value, displayFormat) : null
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
					sortingFn: (rowA, rowB, sortColumnId) => {
						const sortEntry = sortingRef.current.find((s) => s.id === sortColumnId)
						const desc = sortEntry?.desc ?? true

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
						} else {
							return Number(a) - Number(b)
						}
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

	const instance = useReactTable({
		data: finalProtocols,
		columns: allColumns,
		state: {
			sorting,
			expanded,
			columnVisibility,
			columnFilters
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		filterFromLeafRows: true,
		onExpandedChange: (updater) => startTransition(() => setExpanded(updater)),
		getSubRows: (row: IProtocol) => row.childProtocols,
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getExpandedRowModel: getExpandedRowModel()
	})

	const setSortingForPresetSelection = (selection: TablePresetSelection) => {
		const metricPreset = selection.type === 'period' ? null : selection.metric
		const period = selection.type === 'metric' ? null : selection.period
		setSorting([{ id: metricPreset ? getMainColumnForPreset(metricPreset, period) : 'tvl', desc: true }])
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
		setNameSearch('')
		setExpanded({})
		setSorting([{ id: 'tvl', desc: true }])
		removeStorageItem(legacyTableFilterStateKey)
		removeStorageItem(tableMetricPresetKey)
		removeStorageItem(tablePeriodKey)
		removeStorageItem(tableColumnOptionsKey)
		void pushShallowQuery(router, { minTvl: undefined, maxTvl: undefined })
	}
	const chainQuery = router.query.chain
	const activeChain = Array.isArray(chainQuery) ? chainQuery[0] : chainQuery
	const primaryToolbarControls = (
		<>
			<label className={searchFieldInlineWrapperStyles}>
				<span className="sr-only">Search protocols by name</span>
				<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
				<input
					type="search"
					value={nameSearch}
					onChange={(event) => setNameSearch(event.currentTarget.value)}
					placeholder="Search protocols..."
					autoComplete="off"
					className={searchFieldInputStyles}
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
				allValues={mergedColumns}
				selectedValues={selectedColumns}
				setSelectedValues={setColumnOptions}
				nestedMenu={false}
				label={'Columns'}
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
			<TVLRange size="md" />
			<CSVDownloadButton
				prepareCsv={() => prepareTableCsv({ instance, filename: `defillama-${activeChain ?? 'all'}-protocols` })}
				smol
				size="md"
			/>
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
				<PanelHeader className="justify-end">
					<PanelTitle as="h1">Protocol Rankings</PanelTitle>
					<TableToolbarControlGroup className="justify-end">{primaryToolbarControls}</TableToolbarControlGroup>
					<div className="w-full pt-1">{secondaryToolbarControls}</div>
				</PanelHeader>
			) : (
				<div className="border-b border-subtle">
					<TableToolbar className="justify-end">
						{borderless ? null : <h2 className="mr-auto flex w-full grow label-md md:w-auto">Protocol Rankings</h2>}
						{primaryToolbarControls}
					</TableToolbar>
					<div className="px-2 pb-2">{secondaryToolbarControls}</div>
				</div>
			)}
			<VirtualTable instance={instance} useStickyHeader={useStickyHeader} />
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

const tableColumnOptionsKey = 'ptc'
const legacyTableFilterStateKey = 'ptcfs'
const tableMetricPresetKey = 'ptcmp'
const tablePeriodKey = 'ptcp'

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
const BASE_TABLE_PRESET_VALUES: readonly TablePreset[] = [
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

function getTablePresets(protocols: Array<IProtocol>, showExtendedMetrics: boolean): readonly TablePreset[] {
	if (!showExtendedMetrics) return BASE_TABLE_PRESET_VALUES

	const presets: TablePreset[] = [...BASE_TABLE_PRESET_VALUES]
	if (
		protocols.some(
			(protocol) => protocol.perps || protocol.normalizedVolume || protocol.activeLiquidity || protocol.openInterest
		)
	) {
		presets.splice(3, 0, TABLE_PRESETS.PERPS)
	}
	return presets
}

type ActivityMetricKey =
	| 'perps'
	| 'normalizedVolume'
	| 'activeLiquidity'
	| 'openInterest'
	| 'optionsPremiumVolume'
	| 'optionsNotionalVolume'
	| 'dexAggregators'
	| 'perpsAggregators'
	| 'bridgeAggregators'

const ACTIVITY_METRIC_KEYS: readonly ActivityMetricKey[] = [
	'perps',
	'normalizedVolume',
	'activeLiquidity',
	'openInterest',
	'optionsPremiumVolume',
	'optionsNotionalVolume',
	'dexAggregators',
	'perpsAggregators',
	'bridgeAggregators'
]

type ProtocolTableColumnOption = {
	name: string
	key: string
	preset?: TablePreset
	period?: TablePeriod
	snapshot?: boolean
	extended?: boolean
	defaultVisible?: boolean
	metricKey?: ActivityMetricKey
}

const ACTIVITY_PERIODS = [
	{ field: 'total24h', suffix: '24h', tablePeriod: TABLE_PERIODS.ONE_DAY },
	{ field: 'total7d', suffix: '7d', tablePeriod: TABLE_PERIODS.SEVEN_DAYS },
	{ field: 'total30d', suffix: '30d', tablePeriod: TABLE_PERIODS.ONE_MONTH }
] as const

const EXTENDED_ACTIVITY_METRICS: Array<{
	metricKey: Exclude<ActivityMetricKey, 'openInterest' | 'activeLiquidity'>
	idPrefix: string
	label: string
	group: TABLE_COLUMN_GROUPS
	preset?: TablePreset
	helperText: readonly [string, string, string]
	widths: readonly [string, string, string]
	overlapWarning?: string
}> = [
	{
		metricKey: 'perps',
		idPrefix: 'perp_volume',
		label: 'Perp Volume',
		group: TABLE_COLUMN_GROUPS.PERPS,
		preset: TABLE_PRESETS.PERPS,
		helperText: [
			definitions.perps.protocol['24h'],
			definitions.perps.protocol['7d'],
			definitions.perps.protocol['30d']
		],
		widths: ['w-[154px] min-w-[154px]', 'w-[143px] min-w-[143px]', 'w-[154px] min-w-[154px]']
	},
	{
		metricKey: 'normalizedVolume',
		idPrefix: 'normalized_volume',
		label: 'Normalized Volume',
		group: TABLE_COLUMN_GROUPS.PERPS,
		preset: TABLE_PRESETS.PERPS,
		helperText: [
			definitions.normalizedVolume.protocol['24h'],
			definitions.normalizedVolume.protocol['7d'],
			definitions.normalizedVolume.protocol['30d']
		],
		widths: ['w-[199px] min-w-[199px]', 'w-[189px] min-w-[189px]', 'w-[199px] min-w-[199px]']
	},
	{
		metricKey: 'optionsPremiumVolume',
		idPrefix: 'options_premium_volume',
		label: 'Options Premium Volume',
		group: TABLE_COLUMN_GROUPS.OPTIONS,
		helperText: [
			definitions.optionsPremium.protocol['24h'],
			definitions.optionsPremium.protocol['7d'],
			definitions.optionsPremium.protocol['30d']
		],
		widths: ['w-[237px] min-w-[237px]', 'w-[227px] min-w-[227px]', 'w-[238px] min-w-[238px]']
	},
	{
		metricKey: 'optionsNotionalVolume',
		idPrefix: 'options_notional_volume',
		label: 'Options Notional Volume',
		group: TABLE_COLUMN_GROUPS.OPTIONS,
		helperText: [
			definitions.optionsNotional.protocol['24h'],
			definitions.optionsNotional.protocol['7d'],
			definitions.optionsNotional.protocol['30d']
		],
		widths: ['w-[234px] min-w-[234px]', 'w-[224px] min-w-[224px]', 'w-[234px] min-w-[234px]']
	},
	{
		metricKey: 'dexAggregators',
		idPrefix: 'dex_aggregator_volume',
		label: 'DEX Aggregator Volume',
		group: TABLE_COLUMN_GROUPS.SPOT,
		helperText: [
			definitions.dexAggregators.protocol['24h'],
			definitions.dexAggregators.protocol['7d'],
			definitions.dexAggregators.protocol['30d']
		],
		widths: ['w-[230px] min-w-[230px]', 'w-[220px] min-w-[220px]', 'w-[230px] min-w-[230px]'],
		overlapWarning: 'Routed volume can overlap spot venue volume; do not add them together'
	},
	{
		metricKey: 'perpsAggregators',
		idPrefix: 'perp_aggregator_volume',
		label: 'Perp Aggregator Volume',
		group: TABLE_COLUMN_GROUPS.PERPS,
		helperText: [
			definitions.perpsAggregators.protocol['24h'],
			definitions.perpsAggregators.protocol['7d'],
			definitions.perpsAggregators.protocol['30d']
		],
		widths: ['w-[233px] min-w-[233px]', 'w-[223px] min-w-[223px]', 'w-[233px] min-w-[233px]'],
		overlapWarning: 'Routed volume can overlap perp venue volume; do not add them together'
	},
	{
		metricKey: 'bridgeAggregators',
		idPrefix: 'bridge_aggregator_volume',
		label: 'Bridge Aggregator Volume',
		group: TABLE_COLUMN_GROUPS.BRIDGES,
		helperText: [
			definitions.bridgeAggregators.protocol['24h'],
			definitions.bridgeAggregators.protocol['7d'],
			definitions.bridgeAggregators.protocol['30d']
		],
		widths: ['w-[245px] min-w-[245px]', 'w-[235px] min-w-[235px]', 'w-[246px] min-w-[246px]'],
		overlapWarning: 'Routed volume can overlap underlying bridge volume; do not add them together'
	}
]

const columnOptions: ProtocolTableColumnOption[] = [
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
		ACTIVITY_PERIODS.map((period) => ({
			name: `${metric.label} ${period.suffix}`,
			key: `${metric.idPrefix}_${period.suffix}`,
			preset: metric.preset,
			period: period.tablePeriod,
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
	availablePresets: readonly TablePreset[]
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

const columnHelper = createColumnHelper<IProtocol>()

const activityMetricColumn = ({
	metricKey,
	period,
	id,
	header,
	headerHelperText,
	headerClassName
}: {
	metricKey: ActivityMetricKey
	period: 'total24h' | 'total7d' | 'total30d'
	id: string
	header: string
	headerHelperText: string
	headerClassName: string
}) =>
	columnHelper.accessor((row) => row[metricKey]?.[period] ?? undefined, {
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
		ACTIVITY_PERIODS.map((period, index) =>
			activityMetricColumn({
				metricKey: metric.metricKey,
				period: period.field,
				id: `${metric.idPrefix}_${period.suffix}`,
				header: `${metric.label} ${period.suffix}`,
				headerHelperText: [metric.helperText[index], metric.overlapWarning].filter(Boolean).join('. '),
				headerClassName: metric.widths[index]
			})
		)
	)

const columns = [
	columnHelper.accessor('name', {
		id: 'name',
		header: 'Name',
		enableSorting: false,
		filterFn: 'includesString',
		cell: ({ getValue, row }) => {
			const value = getValue()

			return (
				<span className={`relative flex items-center gap-2 ${row.depth > 0 ? 'pl-12' : 'pl-6'}`}>
					{row.subRows?.length > 0 ? (
						<button
							className="absolute -left-0.5"
							{...{
								onClick: row.getToggleExpandedHandler()
							}}
						>
							{row.getIsExpanded() ? (
								<>
									<Icon name="chevron-down" height={16} width={16} className="text-tertiary" />
									<span className="sr-only">View child protocols</span>
								</>
							) : (
								<>
									<Icon name="chevron-right" height={16} width={16} className="text-tertiary" />
									<span className="sr-only">Hide child protocols</span>
								</>
							)}
						</button>
					) : (
						<Bookmark readableName={value} data-lgonly data-bookmark />
					)}

					<span className="vf-row-index shrink-0" aria-hidden="true" />

					<TokenLogo src={row.original.logo} data-lgonly alt={`Logo of ${row.original.name}`} />

					<span className="-my-2 flex flex-col">
						<span className="flex items-center gap-1 overflow-hidden">
							<BasicLink
								href={`/protocol/${row.original.slug}`}
								className="min-w-0 truncate text-sm font-medium text-link hover:underline"
							>
								{value}
							</BasicLink>
							{row.original.deprecated ? <DeprecatedProtocolMarker /> : null}
						</span>

						<ProtocolChainsHovercard chains={row.original.chains} />
					</span>
					{value === 'SyncDEX Finance' ? (
						<Tooltip content={'Many users have reported issues with this protocol'}>
							<Icon name="alert-triangle" height={14} width={14} />
						</Tooltip>
					) : null}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[257px] min-w-[257px]'
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
				<BasicLink href={href} className="text-sm font-medium text-link">
					{category}
				</BasicLink>
			)
		},
		meta: {
			headerClassName: 'w-[139px] min-w-[139px]',
			align: 'end'
		}
	}),
	columnHelper.group({
		id: 'tvl',
		header: 'TVL',
		columns: [
			columnHelper.accessor((row) => row.tvl?.default?.tvl ?? undefined, {
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
			columnHelper.accessor((row) => row.tvlChange?.change1d ?? undefined, {
				id: 'change_1d',
				header: '1d Change',
				cell: ({ getValue }) => <PercentChange percent={getValue()} />,
				meta: {
					headerClassName: 'w-[109px] min-w-[109px]',
					align: 'end',
					headerHelperText: 'Change in TVL in the last 24 hours'
				}
			}),
			columnHelper.accessor((row) => row.tvlChange?.change7d ?? undefined, {
				id: 'change_7d',
				header: '7d Change',
				cell: ({ getValue }) => <PercentChange percent={getValue()} />,
				meta: {
					headerClassName: 'w-[110px] min-w-[110px]',
					align: 'end',
					headerHelperText: 'Change in TVL in the last 7 days'
				}
			}),
			columnHelper.accessor((row) => row.tvlChange?.change1m ?? undefined, {
				id: 'change_1m',
				header: '1m Change',
				cell: ({ getValue }) => <PercentChange percent={getValue()} />,
				meta: {
					headerClassName: 'w-[112px] min-w-[112px]',
					align: 'end',
					headerHelperText: 'Change in TVL in the last 30 days'
				}
			})
		],
		meta: { headerHelperText: 'Value of all coins held in smart contracts of the protocol' }
	}),
	columnHelper.accessor((row) => row.mcap ?? undefined, {
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
	columnHelper.accessor((row) => row.tokenPrice ?? undefined, {
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
	columnHelper.accessor((row) => row.mcaptvl ?? undefined, {
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
		columns: [
			columnHelper.accessor((row) => row.fees?.total24h ?? undefined, {
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
			columnHelper.accessor((row) => row.revenue?.total24h ?? undefined, {
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
			columnHelper.accessor((row) => row.holdersRevenue?.total24h ?? undefined, {
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
			columnHelper.accessor((row) => row.emissions?.total24h ?? undefined, {
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
			columnHelper.accessor((row) => row.fees?.total7d ?? undefined, {
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
			columnHelper.accessor((row) => row.revenue?.total7d ?? undefined, {
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
			columnHelper.accessor((row) => row.holdersRevenue?.total7d ?? undefined, {
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
			columnHelper.accessor((row) => row.emissions?.total7d ?? undefined, {
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
			columnHelper.accessor((row) => row.fees?.total30d ?? undefined, {
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
			columnHelper.accessor((row) => row.revenue?.total30d ?? undefined, {
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
			columnHelper.accessor((row) => row.holdersRevenue?.total30d ?? undefined, {
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
			columnHelper.accessor((row) => row.emissions?.total30d ?? undefined, {
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
			columnHelper.accessor((row) => row.fees?.total1y ?? undefined, {
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
			columnHelper.accessor((row) => row.fees?.monthlyAverage1y ?? undefined, {
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
			columnHelper.accessor((row) => row.revenue?.total1y ?? undefined, {
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
			columnHelper.accessor((row) => row.holdersRevenue?.total1y ?? undefined, {
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
			columnHelper.accessor((row) => row.revenue?.monthlyAverage1y ?? undefined, {
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
			columnHelper.accessor((row) => row.holdersRevenue?.monthlyAverage1y ?? undefined, {
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
			columnHelper.accessor((row) => row.emissions?.total1y ?? undefined, {
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
			columnHelper.accessor((row) => row.emissions?.monthlyAverage1y ?? undefined, {
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
			columnHelper.accessor((row) => row.fees?.totalAllTime ?? undefined, {
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
			columnHelper.accessor((row) => row.revenue?.totalAllTime ?? undefined, {
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
			columnHelper.accessor((row) => row.holdersRevenue?.totalAllTime ?? undefined, {
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
			columnHelper.accessor((row) => row.emissions?.totalAllTime ?? undefined, {
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
			columnHelper.accessor((row) => row.fees?.pf ?? undefined, {
				id: 'pf',
				header: 'P/F',
				cell: (info) => (info.getValue() != null ? `${formatRatio(info.getValue())}x` : null),
				meta: {
					headerClassName: 'w-[68px] min-w-[68px]',
					align: 'end',
					headerHelperText: definitions.fees.protocol['pf']
				}
			}),
			columnHelper.accessor((row) => row.revenue?.ps ?? undefined, {
				id: 'ps',
				header: 'P/S',
				cell: (info) => (info.getValue() != null ? `${formatRatio(info.getValue())}x` : null),
				meta: {
					headerClassName: 'w-[67px] min-w-[67px]',
					align: 'end',
					headerHelperText: definitions.revenue.protocol['ps']
				}
			}),
			columnHelper.accessor((row) => getProtocolEarningsValue(row.revenue?.total24h, row.emissions?.total24h), {
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
			columnHelper.accessor((row) => getProtocolEarningsValue(row.revenue?.total7d, row.emissions?.total7d), {
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
			columnHelper.accessor((row) => getProtocolEarningsValue(row.revenue?.total30d, row.emissions?.total30d), {
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
			columnHelper.accessor((row) => getProtocolEarningsValue(row.revenue?.total1y, row.emissions?.total1y), {
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
			columnHelper.accessor(
				(row) => getProtocolEarningsValue(row.revenue?.monthlyAverage1y, row.emissions?.monthlyAverage1y),
				{
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
				}
			),
			columnHelper.accessor((row) => getProtocolEarningsValue(row.revenue?.totalAllTime, row.emissions?.totalAllTime), {
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
		],
		meta: {
			headerHelperText:
				definitions.fees.common + '\n\n' + definitions.revenue.common + '\n\n' + definitions.holdersRevenue.common
		}
	}),
	columnHelper.group({
		id: 'spot',
		header: 'Spot Volume',
		columns: [
			columnHelper.accessor((row) => row.dexs?.total24h ?? undefined, {
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
			columnHelper.accessor((row) => row.dexs?.total7d ?? undefined, {
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
			columnHelper.accessor((row) => row.dexs?.total30d ?? undefined, {
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
			columnHelper.accessor((row) => row.dexs?.change_7dover7d ?? undefined, {
				id: 'dex_volume_change_7d',
				header: 'Spot Change 7d',
				cell: ({ getValue }) => (getValue() !== 0 ? <PercentChange percent={getValue()} /> : null),
				meta: {
					headerClassName: 'w-[145px] min-w-[145px]',
					align: 'end',
					headerHelperText: definitions.dexs.protocol['change7d']
				}
			}),
			columnHelper.accessor((row) => row.dexs?.totalAllTime ?? undefined, {
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
		],
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
				metricKey: 'openInterest',
				period: 'total24h',
				id: 'open_interest',
				header: 'Open Interest',
				headerHelperText: definitions.openInterest.protocol,
				headerClassName: 'w-[129px] min-w-[129px]'
			}),
			activityMetricColumn({
				metricKey: 'activeLiquidity',
				period: 'total24h',
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
]
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

const ProtocolTvlCell = ({ rowValues }: { rowValues: IProtocol }) => {
	const tvl = rowValues.tvl
	if (!tvl) return null

	let text = null

	if (rowValues.strikeTvl) {
		text = 'This protocol is excluded from chain TVL to avoid double counting'

		const whiteLabeledVaultProviders = ['Veda']
		if (whiteLabeledVaultProviders.includes(rowValues.name)) {
			text =
				'This protocol issues white-labeled vaults which may result in TVL being counted by another protocol (e.g., double counted).'
		}

		if (rowValues.category && removedCategoriesFromChainTvlSet.has(rowValues.category)) {
			text = `${rowValues.category} protocols are not counted into Chain TVL`
		}

		if (text && rowValues.childProtocols) {
			text = 'Some sub-protocols are excluded from chain tvl'
		}
	}

	return (
		<span className="flex items-center justify-end gap-1">
			{text ? <QuestionHelper text={text} /> : null}
			{tvl.excludeParent && rowValues.childProtocols ? (
				<QuestionHelper
					text={"There's some internal doublecounting that is excluded from parent TVL, so sum won't match"}
				/>
			) : null}
			<span className={rowValues.strikeTvl ? 'text-tertiary' : ''}>
				{formatUsd(tvl.default.tvl, {
					compact: true,
					minimumCompactValue: 1_000_000,
					compactSuffix: 'lowercase'
				})}
			</span>
		</span>
	)
}
