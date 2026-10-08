import {
	createColumnHelper,
	useTable,
	type ColumnFiltersState,
	type ColumnOrderState,
	type SortingState
} from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { startTransition, useMemo, useState, type ReactNode } from 'react'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { DeprecatedEntityText } from '~/components/DeprecatedEntityMarker'
import { EntityQuestionsStrip } from '~/components/EntityQuestionsStrip'
import { BasicLink } from '~/components/Link'
import { NewsletterSignup } from '~/components/Newsletter/NewsletterSignup'
import { ProtocolChainsHovercard } from '~/components/ProtocolChainsHovercard'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { readSelectionFromQuery } from '~/components/Select/query'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { searchTableFeatures } from '~/components/Table/features/search'
import { getColumnVisibilityForSelection, getHideableColumns } from '~/components/Table/search/columnSelect'
import {
	prepareTableCsv,
	useSortColumnOrders,
	useTableSearch,
	type ColumnOrdersByBreakpoint
} from '~/components/Table/utils'
import { VirtualTable } from '~/components/Table/VirtualTable'
import { TokenLogo } from '~/components/TokenLogo'
import { FullOldViewButton } from '~/containers/AdapterMetrics/FullOldViewButton'
import type { chainCharts } from '~/containers/ChainOverview/constants'
import type { protocolCharts } from '~/containers/ProtocolOverview/constants'
import { getCategoryRoute } from '~/containers/ProtocolTaxonomy/categoryRoutes'
import { TokenRightsPieHovercard } from '~/containers/TokenRights/TokenRightsPopover'
import { UtrGradeHovercard } from '~/containers/TokenRights/UtrPopover'
import { setStorageItem } from '~/contexts/localStorageStore'
import { definitions } from '~/public/definitions'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles, searchFieldInputPlacementStyles, searchFieldWrapperStyles } from '~/ui/Input'
import { MetricRow } from '~/ui/MetricPrimitives'
import { Panel } from '~/ui/Panel'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { TableToolbar } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { formatPercentChange, formatRatio, formatUsd } from '~/utils/numberFormat'
import { AdapterByChainChart } from './ChainChart'
import { getRatio, HIGH_RATIO_MULTIPLE, type OptionsRatioKey } from './optionsRatios'
import type { IAdapterByChainPageData } from './types'
import { filterProtocolsByCategoryQuery } from './utils'

type TPageType =
	| 'Fees'
	| 'Revenue'
	| 'Holders Revenue'
	| 'DEX Volume'
	| 'Perp Volume'
	| 'Open Interest'
	| 'Normalized Volume'
	| 'Bridge Aggregator Volume'
	| 'Perp Aggregator Volume'
	| 'DEX Aggregator Volume'
	| 'Options Premium Volume'
	| 'Options Notional Volume'
	| 'Options'
	| 'Earnings'
	| 'P/F'
	| 'P/S'

interface IProps extends IAdapterByChainPageData {
	type: TPageType
	children?: ReactNode
	defaultSorting?: SortingState
}

const SUPPORTED_OLD_VIEWS = new Set<TPageType>([
	'DEX Volume',
	'Perp Volume',
	'Options Premium Volume',
	'Options Notional Volume',
	'DEX Aggregator Volume',
	'Bridge Aggregator Volume'
])
const FEES_CHART_PAGE_TYPES = new Set<TPageType>(['Fees', 'Revenue', 'Holders Revenue'])

const DEFAULT_SORTING: SortingState = [{ desc: true, id: 'total24h' }]
// Columns left unchecked in the Columns picker until a user turns them on.
const DEFAULT_HIDDEN_COLUMNS: Partial<Record<TPageType, Record<string, false>>> = {
	Options: { revenue24h: false, total30d: false }
}

const pageSlugByType: Partial<Record<TPageType, string>> = {
	'Perp Volume': 'perps',
	'DEX Volume': 'dexs',
	Fees: 'fees',
	Revenue: 'revenue'
}

const pageTypeByDefinition: Partial<Record<TPageType, Record<string, string>>> = {
	Fees: definitions.fees.chain,
	Revenue: definitions.revenue.chain,
	'Holders Revenue': definitions.holdersRevenue.chain,
	'DEX Volume': definitions.dexs.chain,
	'Perp Volume': definitions.perps.chain,
	'Normalized Volume': definitions.normalizedVolume.chain,
	'Bridge Aggregator Volume': definitions.bridgeAggregators.chain,
	'Perp Aggregator Volume': definitions.perpsAggregators.chain,
	'DEX Aggregator Volume': definitions.dexAggregators.chain,
	'Options Premium Volume': definitions.optionsPremium.chain,
	'Options Notional Volume': definitions.optionsNotional.chain,
	Options: definitions.optionsPremium.chain,
	Earnings: definitions.earnings.chain
}

export function AdapterByChain({ children, defaultSorting, ...props }: IProps) {
	const router = useRouter()
	const isChain = props.chain !== 'All'
	const tableColumns =
		props.type === 'Earnings'
			? isChain
				? CHAIN_EARNINGS_COLUMNS
				: PROTOCOL_EARNINGS_COLUMNS
			: COLUMNS_BY_TYPE[props.type]

	const protocols = useMemo(
		() => filterProtocolsByCategoryQuery(props.protocols, props.categories, router.query),
		[props.protocols, props.categories, router.query]
	)
	const isCategoryFiltered =
		readSelectionFromQuery(router.query, 'category', 'excludeCategory', props.categories).length <
		props.categories.length

	const [sorting, setSorting] = useState<SortingState>(defaultSorting ?? DEFAULT_SORTING)
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])

	const instance = useTable({
		features: searchTableFeatures,
		data: protocols,
		columns: tableColumns,
		state: {
			sorting,
			columnFilters,
			columnOrder
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		initialState: { columnVisibility: DEFAULT_HIDDEN_COLUMNS[props.type] ?? {} },
		enableSortingRemoval: false,
		filterFromLeafRows: true,
		getSubRows: (row: IAdapterByChainPageData['protocols'][0]) => row.childProtocols,
		onSortingChange: (updater) => startTransition(() => setSorting(updater)),
		onColumnFiltersChange: (updater) => startTransition(() => setColumnFilters(updater)),
		onColumnOrderChange: (updater) => startTransition(() => setColumnOrder(updater))
	})

	const rankInstance = useTable({
		features: searchTableFeatures,
		data: protocols,
		columns: tableColumns,
		state: { sorting },
		defaultColumn: { sortUndefined: 'last' },
		enableSortingRemoval: false
	})

	const sortedRankRows = rankInstance.getSortedRowModel().rows
	const rowRankById = useMemo(() => {
		const map = new Map<string, number>()
		let rank = 0
		for (const row of sortedRankRows) {
			rank += 1
			map.set(row.id, rank)
		}
		return map
	}, [sortedRankRows])

	const [_projectName, setProjectName] = useTableSearch({ instance, columnToSearch: 'name' })
	useSortColumnOrders({
		instance,
		// Revenue keeps its column definition order everywhere: the numbers sit next to the name.
		columnOrders: props.type === 'Revenue' ? null : columnOrders
	})
	const metricName = props.type === 'Options' ? 'Options Premium Volume' : props.type
	const columnsKey = `columns-${props.type}`

	const leafColumns = instance.getAllLeafColumns()
	const hideableColumns = getHideableColumns(leafColumns)
	const columnsOptions = getColumnsOptions(props.type, hideableColumns)
	const setColumnOptions: React.Dispatch<React.SetStateAction<Array<string>>> = (newOptions) => {
		const options = typeof newOptions === 'function' ? newOptions(selectedColumns) : newOptions
		const ops = getColumnVisibilityForSelection(leafColumns, options)
		setStorageItem(columnsKey, JSON.stringify(ops))
		instance.setColumnVisibility(ops)
	}

	const selectedColumns: Array<string> = []
	for (const col of hideableColumns) {
		if (col.getIsVisible()) selectedColumns.push(col.id)
	}
	const showChartPanel = props.adapterType !== 'fees' || FEES_CHART_PAGE_TYPES.has(props.type)

	return (
		<>
			<RowLinksWithDropdown
				heading="Chains"
				name={`${props.type}-chains`}
				links={props.chains}
				activeLink={props.chain}
			/>
			{props.entityQuestions && props.entityQuestions.length > 0 ? (
				<EntityQuestionsStrip
					questions={props.entityQuestions}
					entitySlug={pageSlugByType[props.type] || slug(props.type)}
					entityType="page"
					entityName={props.type}
				/>
			) : null}
			{showChartPanel ? (
				<SummaryCardGrid>
					<SummaryStatsCard padding="sm">
						{props.chain !== 'All' ? (
							<h1 className="flex flex-nowrap items-center gap-2">
								<TokenLogo name={props.chain} kind="chain" size={24} alt={`Logo of ${props.chain}`} />
								<span className="heading-sm">{props.chain}</span>
								{props.deprecated ? <DeprecatedEntityText /> : null}
							</h1>
						) : props.total24h != null ? (
							<StatItem
								label={`${metricName} (24h)`}
								labelAs="h1"
								value={formatUsd(props.total24h, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
								truncate
							/>
						) : (
							<h1 className="text-secondary">{metricName}</h1>
						)}

						{props.chain !== 'All' && props.total24h != null ? (
							<StatItem
								label={`${metricName} (24h)`}
								tooltip={pageTypeByDefinition[props.type]?.['24h']}
								value={formatUsd(props.total24h, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
								truncate
							/>
						) : null}

						<div className="flex flex-col">
							{props.optionsTotals?.notionalVolume24h != null ? (
								<MetricRow
									label="Notional Volume (24h)"
									tooltip={definitions.optionsNotional.chain['24h']}
									value={formatUsd(props.optionsTotals.notionalVolume24h, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}
								/>
							) : null}
							{props.openInterest ? (
								<MetricRow
									label={props.adapterType === 'options' ? 'Notional OI' : 'Open Interest'}
									tooltip={
										props.adapterType === 'options'
											? definitions.optionsOpenInterest.chain
											: definitions.openInterest.chain
									}
									value={formatUsd(props.openInterest, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}
								/>
							) : null}
							{props.optionsTotals?.fees24h != null ? (
								<MetricRow
									label="Fees (24h)"
									tooltip={definitions.fees.chain['24h']}
									value={formatUsd(props.optionsTotals.fees24h, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}
								/>
							) : null}
							{getRatio(props.optionsTotals?.notionalVolume24h, props.total24h) != null ? (
								<MetricRow
									label="Notional / Premium"
									tooltip={definitions.optionsOpenInterest.notionalToPremium}
									value={formatRatio(getRatio(props.optionsTotals?.notionalVolume24h, props.total24h))}
								/>
							) : null}
							{props.adapterType === 'options' && getRatio(props.openInterest, props.total24h) != null ? (
								<MetricRow
									label="OI / Premium"
									tooltip={definitions.optionsOpenInterest.openInterestToPremium}
									value={formatRatio(getRatio(props.openInterest, props.total24h))}
								/>
							) : null}
							{props.activeLiquidity != null ? (
								<MetricRow
									label="Active Liquidity"
									tooltip={definitions.activeLiquidity.chain}
									value={formatUsd(props.activeLiquidity, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}
								/>
							) : null}
							{props.total30d != null ? (
								<MetricRow
									label={`${metricName} (30d)`}
									tooltip={pageTypeByDefinition[props.type]?.['30d']}
									value={formatUsd(props.total30d, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}
								/>
							) : null}
							{props.change_7dover7d != null ? (
								<MetricRow
									label="Weekly Change"
									tooltip="Change of last 7d volume over the previous 7d volume"
									value={formatPercentChange(props.change_7dover7d)}
									valueClassName={`mono-md-bold ml-auto ${props.change_7dover7d >= 0 ? 'text-data-up' : 'text-data-down'}`}
								/>
							) : null}
						</div>
					</SummaryStatsCard>
					<AdapterByChainChart
						chartData={props.chartData}
						adapterType={props.adapterType}
						chain={props.chain}
						chartName={props.type}
						dataType={props.dataType}
						tableProtocols={protocols}
						isCategoryFiltered={isCategoryFiltered}
					/>
				</SummaryCardGrid>
			) : null}
			{children}
			{props.chain === 'All' ? <NewsletterSignup layout="strip" /> : null}
			<Panel padding="none">
				<TableToolbar>
					<label className={searchFieldWrapperStyles}>
						<span className="sr-only">Search protocols</span>
						<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
						<Input
							onInput={(e) => setProjectName(e.currentTarget.value)}
							placeholder="Search…"
							className={searchFieldInputPlacementStyles}
						/>
					</label>
					<SelectWithCombobox
						allValues={columnsOptions}
						selectedValues={selectedColumns}
						setSelectedValues={setColumnOptions}
						nestedMenu={false}
						label="Columns"
						labelType="smol"
						variant="filter"
						size="md"
					/>
					{props.categories.length > 0 ? (
						<SelectWithCombobox
							allValues={props.categories}
							includeQueryKey="category"
							excludeQueryKey="excludeCategory"
							nestedMenu={false}
							label="Category"
							labelType="smol"
							variant="filter"
							size="md"
						/>
					) : null}
					{SUPPORTED_OLD_VIEWS.has(props.type) ? <FullOldViewButton /> : null}
					<CSVDownloadButton
						prepareCsv={() => prepareTableCsv({ instance, filename: `${props.type}-${props.chain}-protocols` })}
						smol
						size="md"
					/>
				</TableToolbar>
				<VirtualTable table={instance} rowSize={64} compact rowRankById={rowRankById} />
			</Panel>
		</>
	)
}
const columnOrders: ColumnOrdersByBreakpoint = {
	0: [
		'name',
		'normalizedVolume24h',
		'total24h',
		'notionalVolume24h',
		'openInterest',
		'fees24h',
		'notionalToPremium',
		'openInterestToPremium',
		'revenue24h',
		'activeLiquidity',
		'total7d',
		'total30d',
		'category',
		'definition'
	],
	640: [
		'name',
		'normalizedVolume24h',
		'category',
		'definition',
		'total24h',
		'notionalVolume24h',
		'openInterest',
		'fees24h',
		'notionalToPremium',
		'openInterestToPremium',
		'revenue24h',
		'activeLiquidity',
		'total7d',
		'total30d'
	]
}

const protocolChartsKeys: Partial<Record<IProps['type'], (typeof protocolCharts)[keyof typeof protocolCharts]>> = {
	Fees: 'fees',
	Revenue: 'revenue',
	'Holders Revenue': 'holdersRevenue',
	'Options Premium Volume': 'optionsPremiumVolume',
	'Options Notional Volume': 'optionsNotionalVolume',
	Options: 'optionsPremiumVolume',
	'DEX Volume': 'dexVolume',
	'Perp Volume': 'perpVolume',
	'Open Interest': 'openInterest',
	'Bridge Aggregator Volume': 'bridgeAggregatorVolume',
	'Perp Aggregator Volume': 'perpAggregatorVolume',
	'DEX Aggregator Volume': 'dexAggregatorVolume',
	Earnings: 'incentives'
}

const chainChartsKeys: Partial<Record<IProps['type'], (typeof chainCharts)[keyof typeof chainCharts]>> = {
	Fees: 'chainFees',
	Revenue: 'chainRevenue',
	'Holders Revenue': 'holdersRevenue',
	'DEX Volume': 'dexsVolume',
	'Perp Volume': 'perpsVolume'
}

const getColumnsOptions = <T extends { id: string; columnDef: { header?: unknown } }>(
	type: IProps['type'],
	columns: Array<T>
) =>
	columns.map((column) => {
		const header = column.columnDef.header
		let headerName: string
		if (typeof header === 'function') {
			switch (column.id) {
				case 'total24h':
					if (type === 'Perp Aggregator Volume') {
						headerName = 'Perp Aggregator Volume 24h'
					} else if (type === 'Bridge Aggregator Volume') {
						headerName = 'Bridge Aggregator Volume 24h'
					} else if (type === 'DEX Aggregator Volume') {
						headerName = 'DEX Aggregator Volume 24h'
					} else {
						headerName = column.id
					}
					break
				case 'total7d':
					if (type === 'Perp Aggregator Volume') {
						headerName = 'Perp Aggregator Volume 7d'
					} else if (type === 'Bridge Aggregator Volume') {
						headerName = 'Bridge Aggregator Volume 7d'
					} else if (type === 'DEX Aggregator Volume') {
						headerName = 'DEX Aggregator Volume 7d'
					} else {
						headerName = column.id
					}
					break
				case 'total30d':
					if (type === 'Perp Aggregator Volume') {
						headerName = 'Perp Aggregator Volume 30d'
					} else if (type === 'Bridge Aggregator Volume') {
						headerName = 'Bridge Aggregator Volume 30d'
					} else if (type === 'DEX Aggregator Volume') {
						headerName = 'DEX Aggregator Volume 30d'
					} else {
						headerName = column.id
					}
					break
				default:
					headerName = column.id ?? ''
			}
		} else {
			headerName = typeof header === 'string' ? header : ''
		}

		return { name: headerName, key: column.id }
	})

type AdapterProtocolRow = IAdapterByChainPageData['protocols'][0]

const columnHelper = createColumnHelper<typeof searchTableFeatures, AdapterProtocolRow>()

const NameColumn = (type: IProps['type']) =>
	columnHelper.accessor('name', {
		id: 'name',
		enableHiding: false,
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const value = getValue()

			const basePath =
				row.original.category &&
				['Chain', 'Rollup'].includes(row.original.category) &&
				row.original.slug !== 'berachain-incentive-buys'
					? 'chain'
					: 'protocol'
			const chartKey =
				row.original.category &&
				['Chain', 'Rollup'].includes(row.original.category) &&
				row.original.slug !== 'berachain-incentive-buys'
					? (chainChartsKeys[type] ?? protocolChartsKeys[type])
					: protocolChartsKeys[type]

			return (
				<span className={`relative flex items-center gap-2 ${row.depth > 0 ? 'pl-6' : 'pl-0'}`}>
					{row.subRows?.length > 0 ? (
						<Button
							size="sm"
							variant="ghost"
							square
							type="button"
							aria-expanded={row.getIsExpanded()}
							className="absolute -left-5.5"
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
						</Button>
					) : null}

					<span className="vf-row-index shrink-0" aria-hidden="true" />

					<TokenLogo src={row.original.logo} data-lgonly alt={`Logo of ${row.original.name}`} />

					<span className="-my-2 flex min-w-0 flex-col">
						<span className="flex min-w-0 items-center gap-1">
							<BasicLink
								href={`/${basePath}/${row.original.slug}${chartKey ? `?tvl=false&events=false&${chartKey}=true` : ''}`}
								className="min-w-0 truncate label-md text-link hover:underline"
							>
								{value}
							</BasicLink>
							{row.original.warning ? (
								<Tooltip content={row.original.warning}>
									<Icon name="alert-triangle" height={14} width={14} className="shrink-0 text-warning" />
								</Tooltip>
							) : null}
						</span>

						{row.original.chains ? <ProtocolChainsHovercard chains={row.original.chains} /> : null}
					</span>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[180px] sm:w-[240px] md:w-[280px]'
		}
	})

// Only Revenue pages load token sources, so only their top-level rows carry `token`.
const utrColumn = columnHelper.accessor((row) => row.token?.utr?.score ?? undefined, {
	id: 'utr',
	header: 'Rating',
	cell: ({ row }) =>
		row.original.token?.utr ? (
			<UtrGradeHovercard name={row.original.name} utr={row.original.token.utr} rights={row.original.token.rights} />
		) : null,
	meta: {
		headerClassName: 'w-[98px]',
		align: 'center',
		headerHelperText:
			'Universal Token Rating, from AAA to CCC, based on what the project discloses and how its token performs',
		csvHeader: 'Universal Token Rating',
		csvValue: (row) => row.token?.utr?.grade ?? ''
	}
})

const rightsColumn = columnHelper.display({
	id: 'rights',
	header: 'Rights',
	cell: ({ row }) =>
		row.original.token?.rights ? (
			<TokenRightsPieHovercard
				name={row.original.name}
				rights={row.original.token.rights.preview}
				fullRightsHref={row.original.token.rights.href}
				utr={row.original.token.utr}
				placement="right-start"
			/>
		) : null,
	meta: {
		headerClassName: 'w-[82px]',
		align: 'center',
		headerHelperText:
			'Which rights the token gives its holders: treasury, revenue, burns, equity, value accrual and governance',
		tableOnly: true
	}
})

const categoryColumn = (align?: 'center') =>
	columnHelper.accessor('category', {
		id: 'category',
		header: 'Category',
		enableSorting: false,
		cell: ({ getValue }) =>
			getValue() ? (
				<BasicLink href={getCategoryRoute(slug(getValue()))} className="label-md text-link hover:underline">
					{getValue()}
				</BasicLink>
			) : (
				''
			),
		meta: {
			headerClassName: 'w-[128px]',
			...(align ? { align } : {})
		}
	})

const definitionColumn = columnHelper.accessor((protocol) => protocol.methodology ?? null, {
	id: 'definition',
	header: 'Definition',
	cell: ({ getValue }) => (
		<Tooltip content={getValue()} render={<span className="line-clamp-2 whitespace-normal" />}>
			{getValue()}
		</Tooltip>
	),
	enableSorting: false,
	meta: {
		headerClassName: 'w-[400px]'
	}
})

type MetricColumnSize = 128 | 152 | 160 | 169 | 172 | 180 | 184

const metricColumnWidthClassBySize: Record<MetricColumnSize, string> = {
	128: 'w-[128px]',
	152: 'w-[152px]',
	160: 'w-[160px]',
	169: 'w-[169px] min-w-[169px]',
	172: 'w-[172px] min-w-[172px]',
	180: 'w-[min(180px,40vw)]',
	184: 'w-[184px] min-w-[184px]'
}

const getMetricColumnWidthClass = (size: MetricColumnSize) => metricColumnWidthClassBySize[size]

const metricColumn = (
	id: string,
	header: string,
	accessor: (protocol: AdapterProtocolRow) => number | null | undefined,
	headerHelperText: string,
	size: MetricColumnSize,
	align: 'center' | 'end' = 'center',
	csvHeader?: string
) =>
	columnHelper.accessor((row) => accessor(row) ?? undefined, {
		id,
		header,
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: getMetricColumnWidthClass(size),
			align,
			headerHelperText,
			...(csvHeader ? { csvHeader } : {})
		}
	})

const doubleCountedMetricColumn = (
	id: string,
	header: string | (() => ReactNode),
	accessor: (protocol: AdapterProtocolRow) => number | null | undefined,
	headerHelperText: string,
	size: MetricColumnSize,
	csvHeader?: string
) =>
	columnHelper.accessor((row) => accessor(row) ?? undefined, {
		id,
		header,
		cell: (info) => {
			if (info.getValue() != null && info.row.original.doublecounted) {
				return (
					<span className="flex items-center justify-center gap-1">
						<QuestionHelper text="This protocol is a wrapper interface over another protocol. Its volume is excluded from totals to avoid double-counting the underlying protocol's volume" />
						<span className="text-tertiary">
							{formatUsd(info.getValue(), {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						</span>
					</span>
				)
			}
			return info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null
		},
		meta: {
			headerClassName: getMetricColumnWidthClass(size),
			align: 'center',
			headerHelperText,
			...(csvHeader ? { csvHeader } : {})
		}
	})

const reportedPerpVolumeColumn = (
	id: string,
	header: string,
	accessor: (protocol: AdapterProtocolRow) => number | null | undefined,
	headerHelperText: string,
	size: MetricColumnSize
) =>
	columnHelper.accessor((row) => accessor(row) ?? undefined, {
		id,
		header,
		cell: (info) => {
			if (info.getValue() == null) return null
			const helpers: Array<string> = []
			if (info.row.original.zeroFeePerp) {
				helpers.push('This protocol charges no fees for most of its users')
			}
			if (info.row.original.doublecounted) {
				helpers.push(
					"This protocol is a wrapper interface over another protocol. Its volume is excluded from totals to avoid double-counting the underlying protocol's volume"
				)
			}

			if (helpers.length > 0) {
				return (
					<span className="flex items-center justify-center gap-1">
						{helpers.map((helper) => (
							<QuestionHelper key={`${info.row.original.name}-${helper}`} text={helper} />
						))}
						<span className={info.row.original.doublecounted ? 'text-tertiary' : ''}>
							{formatUsd(info.getValue(), {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						</span>
					</span>
				)
			}

			return (
				<>{formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</>
			)
		},
		meta: {
			headerClassName: getMetricColumnWidthClass(size),
			align: 'center',
			headerHelperText
		}
	})

const openInterestMetricColumn = (
	id: string,
	header: string,
	accessor: (protocol: AdapterProtocolRow) => number | null | undefined,
	headerHelperText: string,
	size: MetricColumnSize,
	align: 'center' | 'end' = 'center'
) =>
	columnHelper.accessor((row) => accessor(row) ?? undefined, {
		id,
		header,
		cell: (info) => {
			if (info.getValue() != null && info.row.original.doublecounted) {
				return (
					<span className={`flex items-center ${align === 'center' ? 'justify-center' : 'justify-end'} gap-1`}>
						<QuestionHelper text="This protocol is a wrapper interface over another protocol. Its open interest is excluded from totals to avoid double-counting the underlying protocol's open interest" />
						<span className="text-tertiary">
							{formatUsd(info.getValue(), {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						</span>
					</span>
				)
			}
			return info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null
		},
		meta: {
			headerClassName: getMetricColumnWidthClass(size),
			align,
			headerHelperText
		}
	})

const ratioColumn = (id: OptionsRatioKey, header: string, headerHelperText: string) =>
	columnHelper.accessor((protocol) => protocol[id] ?? undefined, {
		id,
		header,
		cell: (info) => {
			const median = info.row.original.highRatioMedians?.[id]
			if (median == null) return formatRatio(info.getValue())
			return (
				<span className="flex items-center justify-center gap-1">
					<Tooltip
						content={`More than ${HIGH_RATIO_MULTIPLE}x the median across exchanges on this page (${formatRatio(median)})`}
					>
						<Icon name="alert-triangle" height={14} width={14} className="shrink-0 text-warning" />
					</Tooltip>
					{formatRatio(info.getValue())}
				</span>
			)
		},
		meta: {
			headerClassName: getMetricColumnWidthClass(160),
			align: 'center',
			headerHelperText
		}
	})

const pfOrPsColumn = (label: 'P/F' | 'P/S', headerHelperText: string) =>
	columnHelper.accessor((protocol) => protocol.pfOrPs ?? undefined, {
		id: 'pfOrPs',
		header: label,
		cell: (info) => formatRatio(info.getValue()),
		meta: {
			headerClassName: 'w-[120px]',
			align: 'center',
			headerHelperText
		}
	})

const createEarningsColumns = (metricDefinitions: Record<'24h' | '7d' | '30d', string>) => [
	NameColumn('Earnings'),
	categoryColumn(),
	metricColumn('total24h', 'Earnings 24h', (protocol) => protocol.total24h, metricDefinitions['24h'], 160),
	metricColumn('total7d', 'Earnings 7d', (protocol) => protocol.total7d, metricDefinitions['7d'], 160),
	metricColumn('total30d', 'Earnings 30d', (protocol) => protocol.total30d, metricDefinitions['30d'], 160)
]

const PROTOCOL_EARNINGS_COLUMNS = createEarningsColumns(definitions.earnings.protocol)
const CHAIN_EARNINGS_COLUMNS = createEarningsColumns(definitions.earnings.chain)

const COLUMNS_BY_TYPE = {
	Fees: [
		NameColumn('Fees'),
		categoryColumn(),
		definitionColumn,
		metricColumn('total24h', 'Fees 24h', (protocol) => protocol.total24h, definitions.fees.protocol['24h'], 128),
		metricColumn('total7d', 'Fees 7d', (protocol) => protocol.total7d, definitions.fees.protocol['7d'], 128),
		metricColumn('total30d', 'Fees 30d', (protocol) => protocol.total30d, definitions.fees.protocol['30d'], 128)
	],
	Revenue: [
		NameColumn('Revenue'),
		metricColumn('total24h', 'Revenue 24h', (protocol) => protocol.total24h, definitions.revenue.protocol['24h'], 128),
		metricColumn('total7d', 'Revenue 7d', (protocol) => protocol.total7d, definitions.revenue.protocol['7d'], 128),
		metricColumn('total30d', 'Revenue 30d', (protocol) => protocol.total30d, definitions.revenue.protocol['30d'], 128),
		utrColumn,
		rightsColumn,
		categoryColumn(),
		definitionColumn
	],
	'Holders Revenue': [
		NameColumn('Holders Revenue'),
		categoryColumn(),
		definitionColumn,
		metricColumn(
			'total24h',
			'Holders Revenue 24h',
			(protocol) => protocol.total24h,
			definitions.holdersRevenue.protocol['24h'],
			180
		),
		metricColumn(
			'total7d',
			'Holders Revenue 7d',
			(protocol) => protocol.total7d,
			definitions.holdersRevenue.protocol['7d'],
			180
		),
		metricColumn(
			'total30d',
			'Holders Revenue 30d',
			(protocol) => protocol.total30d,
			definitions.holdersRevenue.protocol['30d'],
			180
		)
	],
	'Options Premium Volume': [
		NameColumn('Options Premium Volume'),
		metricColumn(
			'total24h',
			'Premium Volume 24h',
			(protocol) => protocol.total24h,
			definitions.optionsPremium.protocol['24h'],
			180
		),
		metricColumn(
			'total7d',
			'Premium Volume 7d',
			(protocol) => protocol.total7d,
			definitions.optionsPremium.protocol['7d'],
			180
		),
		metricColumn(
			'total30d',
			'Premium Volume 30d',
			(protocol) => protocol.total30d,
			definitions.optionsPremium.protocol['30d'],
			180
		)
	],
	'Options Notional Volume': [
		NameColumn('Options Notional Volume'),
		metricColumn(
			'total24h',
			'Notional Volume 24h',
			(protocol) => protocol.total24h,
			definitions.optionsNotional.protocol['24h'],
			180
		),
		metricColumn(
			'total7d',
			'Notional Volume 7d',
			(protocol) => protocol.total7d,
			definitions.optionsNotional.protocol['7d'],
			180
		),
		metricColumn(
			'total30d',
			'Notional Volume 30d',
			(protocol) => protocol.total30d,
			definitions.optionsNotional.protocol['30d'],
			180
		)
	],
	Options: [
		NameColumn('Options'),
		metricColumn(
			'total24h',
			'Premium Volume 24h',
			(protocol) => protocol.total24h,
			definitions.optionsPremium.protocol['24h'],
			180
		),
		metricColumn(
			'notionalVolume24h',
			'Notional Volume 24h',
			(protocol) => protocol.notionalVolume24h,
			definitions.optionsNotional.protocol['24h'],
			180
		),
		openInterestMetricColumn(
			'openInterest',
			'Notional OI',
			(protocol) => protocol.openInterest,
			definitions.optionsOpenInterest.protocol,
			160
		),
		metricColumn('fees24h', 'Fees 24h', (protocol) => protocol.fees24h, definitions.fees.protocol['24h'], 128),
		ratioColumn('notionalToPremium', 'Notional / Premium', definitions.optionsOpenInterest.notionalToPremium),
		ratioColumn('openInterestToPremium', 'OI / Premium', definitions.optionsOpenInterest.openInterestToPremium),
		metricColumn(
			'revenue24h',
			'Revenue 24h',
			(protocol) => protocol.revenue24h,
			definitions.revenue.protocol['24h'],
			128
		),
		metricColumn(
			'total7d',
			'Premium Volume 7d',
			(protocol) => protocol.total7d,
			definitions.optionsPremium.protocol['7d'],
			180
		),
		metricColumn(
			'total30d',
			'Premium Volume 30d',
			(protocol) => protocol.total30d,
			definitions.optionsPremium.protocol['30d'],
			180
		)
	],
	'DEX Volume': [
		NameColumn('DEX Volume'),
		doubleCountedMetricColumn(
			'total24h',
			'DEX Volume 24h',
			(protocol) => protocol.total24h,
			definitions.dexs.protocol['24h'],
			152
		),
		doubleCountedMetricColumn(
			'total7d',
			'DEX Volume 7d',
			(protocol) => protocol.total7d,
			definitions.dexs.protocol['7d'],
			152
		),
		doubleCountedMetricColumn(
			'total30d',
			'DEX Volume 30d',
			(protocol) => protocol.total30d,
			definitions.dexs.protocol['30d'],
			152
		)
	],
	'Perp Volume': [
		NameColumn('Perp Volume'),
		doubleCountedMetricColumn(
			'normalizedVolume24h',
			'Normalized Volume 24h',
			(protocol) => protocol.normalizedVolume24h,
			definitions.normalizedVolume.protocol['24h'],
			180
		),
		reportedPerpVolumeColumn(
			'total24h',
			'Reported Volume 24h',
			(protocol) => protocol.total24h,
			definitions.perps.protocol['24h'],
			160
		),
		openInterestMetricColumn(
			'openInterest',
			'Open Interest',
			(protocol) => protocol.openInterest,
			definitions.openInterest.protocol,
			160
		),
		reportedPerpVolumeColumn(
			'total7d',
			'Reported Volume 7d',
			(protocol) => protocol.total7d,
			definitions.perps.protocol['7d'],
			160
		),
		reportedPerpVolumeColumn(
			'total30d',
			'Reported Volume 30d',
			(protocol) => protocol.total30d,
			definitions.perps.protocol['30d'],
			160
		)
	],
	'Open Interest': [
		NameColumn('Open Interest'),
		metricColumn(
			'total24h',
			'Open Interest',
			(protocol) => protocol.total24h,
			definitions.openInterest.protocol,
			160,
			'end'
		)
	],
	'Normalized Volume': [
		NameColumn('Normalized Volume'),
		reportedPerpVolumeColumn(
			'total24h',
			'Normalized Volume 24h',
			(protocol) => protocol.total24h,
			definitions.normalizedVolume.protocol['24h'],
			180
		),
		doubleCountedMetricColumn(
			'activeLiquidity',
			'Active Liquidity',
			(protocol) => protocol.activeLiquidity,
			definitions.activeLiquidity.protocol,
			180
		),
		reportedPerpVolumeColumn(
			'total7d',
			'Normalized Volume 7d',
			(protocol) => protocol.total7d,
			definitions.normalizedVolume.protocol['7d'],
			180
		),
		reportedPerpVolumeColumn(
			'total30d',
			'Normalized Volume 30d',
			(protocol) => protocol.total30d,
			definitions.normalizedVolume.protocol['30d'],
			180
		)
	],
	'Perp Aggregator Volume': [
		NameColumn('Perp Aggregator Volume'),
		metricColumn(
			'total24h',
			'Perp Agg Vol 24h',
			(protocol) => protocol.total24h,
			definitions.perpsAggregators.protocol['24h'],
			172,
			'center',
			'Perp Aggregator Volume 24h'
		),
		metricColumn(
			'total7d',
			'Perp Agg Vol 7d',
			(protocol) => protocol.total7d,
			definitions.perpsAggregators.protocol['7d'],
			172,
			'center',
			'Perp Aggregator Volume 7d'
		),
		metricColumn(
			'total30d',
			'Perp Agg Vol 30d',
			(protocol) => protocol.total30d,
			definitions.perpsAggregators.protocol['30d'],
			172,
			'center',
			'Perp Aggregator Volume 30d'
		)
	],
	'Bridge Aggregator Volume': [
		NameColumn('Bridge Aggregator Volume'),
		metricColumn(
			'total24h',
			'Bridge Agg Vol 24h',
			(protocol) => protocol.total24h,
			definitions.bridgeAggregators.chain['24h'],
			184,
			'center',
			'Bridge Aggregator Volume 24h'
		),
		metricColumn(
			'total7d',
			'Bridge Agg Vol 7d',
			(protocol) => protocol.total7d,
			definitions.bridgeAggregators.chain['7d'],
			184,
			'center',
			'Bridge Aggregator Volume 7d'
		),
		metricColumn(
			'total30d',
			'Bridge Agg Vol 30d',
			(protocol) => protocol.total30d,
			definitions.bridgeAggregators.chain['30d'],
			184,
			'center',
			'Bridge Aggregator Volume 30d'
		)
	],
	'DEX Aggregator Volume': [
		NameColumn('DEX Aggregator Volume'),
		metricColumn(
			'total24h',
			'DEX Agg Vol 24h',
			(protocol) => protocol.total24h,
			definitions.dexAggregators.protocol['24h'],
			169,
			'center',
			'DEX Aggregator Volume 24h'
		),
		metricColumn(
			'total7d',
			'DEX Agg Vol 7d',
			(protocol) => protocol.total7d,
			definitions.dexAggregators.protocol['7d'],
			169,
			'center',
			'DEX Aggregator Volume 7d'
		),
		metricColumn(
			'total30d',
			'DEX Agg Vol 30d',
			(protocol) => protocol.total30d,
			definitions.dexAggregators.protocol['30d'],
			169,
			'center',
			'DEX Aggregator Volume 30d'
		)
	],
	'P/F': [NameColumn('Fees'), categoryColumn('center'), pfOrPsColumn('P/F', definitions.fees.protocol['pf'])],
	'P/S': [NameColumn('Revenue'), categoryColumn('center'), pfOrPsColumn('P/S', definitions.revenue.protocol['ps'])]
}
