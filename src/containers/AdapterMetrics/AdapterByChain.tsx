import {
	type ColumnFiltersState,
	type ColumnOrderState,
	createColumnHelper,
	getCoreRowModel,
	getExpandedRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	useReactTable,
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
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { VirtualTable } from '~/components/Table/Table'
import {
	prepareTableCsv,
	type ColumnOrdersByBreakpoint,
	useSortColumnOrders,
	useTableSearch
} from '~/components/Table/utils'
import { TokenLogo } from '~/components/TokenLogo'
import { FullOldViewButton } from '~/containers/AdapterMetrics/FullOldViewButton'
import { chainCharts } from '~/containers/ChainOverview/constants'
import { protocolCharts } from '~/containers/ProtocolOverview/constants'
import { getCategoryRoute } from '~/containers/ProtocolTaxonomy/categoryRoutes'
import { setStorageItem } from '~/contexts/localStorageStore'
import { definitions } from '~/public/definitions'
import { Icon } from '~/ui/Icon'
import { searchFieldWrapperStyles, searchFieldIconStyles, searchFieldInputStyles } from '~/ui/Input'
import { MetricRow } from '~/ui/MetricPrimitives'
import { Panel } from '~/ui/Panel'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { TableToolbar } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { formatRatio, formatPercentChange, formatUsd } from '~/utils/numberFormat'
import { parseExcludeParam } from '~/utils/routerQuery'
import { AdapterByChainChart } from './ChainChart'
import type { IAdapterByChainPageData, IProtocol } from './types'
import { getProtocolsByCategory } from './utils'

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
	| 'Earnings'
	| 'P/F'
	| 'P/S'

interface IProps extends IAdapterByChainPageData {
	type: TPageType
	children?: ReactNode
	defaultSorting?: SortingState
}

const SUPPORTED_OLD_VIEWS: TPageType[] = [
	'DEX Volume',
	'Perp Volume',
	'Options Premium Volume',
	'Options Notional Volume',
	'DEX Aggregator Volume',
	'Bridge Aggregator Volume'
]
const FEES_CHART_PAGE_TYPES: TPageType[] = ['Fees', 'Revenue', 'Holders Revenue']

const DEFAULT_SORTING: SortingState = [{ desc: true, id: 'total24h' }]

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
	Earnings: definitions.earnings.chain
}

export function AdapterByChain({ children, defaultSorting, ...props }: IProps) {
	const router = useRouter()
	const isChain = props.chain !== 'All'
	const categoryParam = router.query.category
	const excludeCategoryParam = router.query.excludeCategory
	const hasCategoryParam = Object.prototype.hasOwnProperty.call(router.query, 'category')
	const columnsByType = useMemo(() => getColumnsByType(isChain), [isChain])
	const tableColumns = columnsByType[props.type]
	const columnsOptions = useMemo(() => getColumnsOptions(props.type, columnsByType), [props.type, columnsByType])

	const { selectedCategories, protocols } = useMemo(() => {
		const excludeSet = parseExcludeParam(excludeCategoryParam)

		let selectedCategories =
			props.categories.length > 0 && hasCategoryParam && categoryParam === ''
				? []
				: categoryParam
					? typeof categoryParam === 'string'
						? [categoryParam]
						: categoryParam
					: props.categories

		if (excludeSet.size > 0) {
			const filteredCategories: string[] = []
			for (const category of selectedCategories) {
				if (!excludeSet.has(category)) filteredCategories.push(category)
			}
			selectedCategories = filteredCategories
		}

		const categoriesToFilter: string[] = []
		for (const category of selectedCategories) {
			const normalizedCategory = category.toLowerCase()
			if (normalizedCategory !== 'all' && normalizedCategory !== 'none') {
				categoriesToFilter.push(category)
			}
		}

		const protocols: IProtocol[] =
			props.categories.length === 0
				? props.protocols
				: selectedCategories.length === 0
					? ([] as IProtocol[])
					: categoriesToFilter.length > 0
						? getProtocolsByCategory(props.protocols, categoriesToFilter)
						: props.protocols

		return {
			selectedCategories,
			protocols
		}
	}, [categoryParam, excludeCategoryParam, hasCategoryParam, props.categories, props.protocols])

	const [sorting, setSorting] = useState<SortingState>(defaultSorting ?? DEFAULT_SORTING)
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])

	const instance = useReactTable({
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
		enableSortingRemoval: false,
		filterFromLeafRows: true,
		getSubRows: (row: IAdapterByChainPageData['protocols'][0]) => row.childProtocols,
		onSortingChange: (updater) => startTransition(() => setSorting(updater)),
		onColumnFiltersChange: (updater) => startTransition(() => setColumnFilters(updater)),
		onColumnOrderChange: (updater) => startTransition(() => setColumnOrder(updater)),
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getExpandedRowModel: getExpandedRowModel(),
		getFilteredRowModel: getFilteredRowModel()
	})

	const rankInstance = useReactTable({
		data: protocols,
		columns: tableColumns,
		state: { sorting },
		defaultColumn: { sortUndefined: 'last' },
		enableSortingRemoval: false,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel()
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
		columnOrders
	})
	const metricName = props.type
	const columnsKey = `columns-${props.type}`

	const setColumnOptions: React.Dispatch<React.SetStateAction<string[]>> = (newOptions) => {
		const options = typeof newOptions === 'function' ? newOptions(selectedColumns) : newOptions
		const optionsSet = new Set(options)
		const ops: Record<string, boolean> = {}
		for (const col of instance.getAllLeafColumns()) {
			ops[col.id] = optionsSet.has(col.id)
		}
		setStorageItem(columnsKey, JSON.stringify(ops))
		instance.setColumnVisibility(ops)
	}

	const selectedColumns: string[] = []
	for (const col of instance.getAllLeafColumns()) {
		if (col.getIsVisible()) selectedColumns.push(col.id)
	}
	const showChartPanel = props.adapterType !== 'fees' || FEES_CHART_PAGE_TYPES.includes(props.type)

	return (
		<>
			<RowLinksWithDropdown name={`${props.type}-chains`} links={props.chains} activeLink={props.chain} />
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
							{props.openInterest ? (
								<MetricRow
									label="Open Interest"
									tooltip={definitions.openInterest.chain}
									value={formatUsd(props.openInterest, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})}
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
					/>
				</SummaryCardGrid>
			) : null}
			{children}
			{props.chain === 'All' ? <NewsletterSignup layout="strip" /> : null}
			<Panel padding="none">
				<TableToolbar className="justify-end">
					<label className={searchFieldWrapperStyles}>
						<span className="sr-only">Search protocols</span>
						<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
						<input
							onInput={(e) => setProjectName(e.currentTarget.value)}
							placeholder="Search..."
							className={searchFieldInputStyles}
						/>
					</label>
					<SelectWithCombobox
						allValues={columnsOptions}
						selectedValues={selectedColumns}
						setSelectedValues={setColumnOptions}
						nestedMenu={false}
						label={'Columns'}
						labelType="smol"
						variant="filter-responsive"
						size="md"
					/>
					{props.categories.length > 0 ? (
						<SelectWithCombobox
							allValues={props.categories}
							selectedValues={selectedCategories}
							includeQueryKey="category"
							excludeQueryKey="excludeCategory"
							nestedMenu={false}
							label={'Category'}
							labelType="smol"
							variant="filter-responsive"
							size="md"
						/>
					) : null}
					{SUPPORTED_OLD_VIEWS.includes(props.type) ? <FullOldViewButton /> : null}
					<CSVDownloadButton
						prepareCsv={() => prepareTableCsv({ instance, filename: `${props.type}-${props.chain}-protocols` })}
						smol
						size="md"
					/>
				</TableToolbar>
				<VirtualTable instance={instance} rowSize={64} compact rowRankById={rowRankById} />
			</Panel>
		</>
	)
}
const columnOrders: ColumnOrdersByBreakpoint = {
	0: [
		'name',
		'normalizedVolume24h',
		'total24h',
		'openInterest',
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
		'openInterest',
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
	'DEX Volume': 'dexsVolume',
	'Perp Volume': 'perpsVolume'
}

const getColumnsOptions = (type: IProps['type'], columnsByType: ReturnType<typeof getColumnsByType>) =>
	columnsByType[type].map((c) => {
		let headerName: string
		if (typeof c.header === 'function') {
			switch (c.id) {
				case 'total24h':
					if (type === 'Perp Aggregator Volume') {
						headerName = 'Perp Aggregator Volume 24h'
					} else if (type === 'Bridge Aggregator Volume') {
						headerName = 'Bridge Aggregator Volume 24h'
					} else if (type === 'DEX Aggregator Volume') {
						headerName = 'DEX Aggregator Volume 24h'
					} else {
						headerName = c.id
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
						headerName = c.id
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
						headerName = c.id
					}
					break
				default:
					headerName = c.id ?? ''
			}
		} else {
			headerName = c.header as string
		}

		return { name: headerName, key: c.id ?? ('accessorKey' in c ? (c.accessorKey as string) : '') }
	})

type AdapterProtocolRow = IAdapterByChainPageData['protocols'][0]

const columnHelper = createColumnHelper<AdapterProtocolRow>()

const NameColumn = (type: IProps['type']) =>
	columnHelper.accessor('name', {
		id: 'name',
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
						<button
							className="absolute -left-4.5"
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
					) : null}

					<span className="vf-row-index shrink-0" aria-hidden="true" />

					<TokenLogo src={row.original.logo} data-lgonly alt={`Logo of ${row.original.name}`} />

					<span className="-my-2 flex flex-col">
						<span className="flex min-w-0 items-center gap-1">
							<BasicLink
								href={`/${basePath}/${row.original.slug}${chartKey ? `?tvl=false&events=false&${chartKey}=true` : ''}`}
								className="min-w-0 truncate text-sm font-medium text-link hover:underline"
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

const categoryColumn = (align?: 'center') =>
	columnHelper.accessor('category', {
		header: 'Category',
		enableSorting: false,
		cell: ({ getValue }) =>
			getValue() ? (
				<BasicLink href={getCategoryRoute(slug(getValue()))} className="text-sm font-medium text-link">
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
		<Tooltip content={getValue()} className="flex-1">
			<span className="line-clamp-2 min-w-0 overflow-hidden text-ellipsis whitespace-normal">{getValue()}</span>
		</Tooltip>
	),
	enableSorting: false,
	meta: {
		headerClassName: 'w-[400px]'
	}
})

type MetricColumnSize = 128 | 152 | 160 | 180

const metricColumnWidthClassBySize: Record<MetricColumnSize, string> = {
	128: 'w-[128px]',
	152: 'w-[152px]',
	160: 'w-[160px]',
	180: 'w-[min(180px,40vw)]'
}

const getMetricColumnWidthClass = (size: MetricColumnSize) => metricColumnWidthClassBySize[size]

const centeredMetricColumn = (
	id: string,
	header: string | (() => ReactNode),
	accessor: (protocol: AdapterProtocolRow) => number | null | undefined,
	headerHelperText: string,
	size: MetricColumnSize,
	csvHeader?: string
) =>
	columnHelper.accessor(accessor, {
		id,
		header,
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: getMetricColumnWidthClass(size),
			align: 'center',
			headerHelperText,
			...(csvHeader ? { csvHeader } : {})
		}
	})

const endMetricColumn = (
	id: string,
	header: string | (() => ReactNode),
	accessor: (protocol: AdapterProtocolRow) => number | null | undefined,
	headerHelperText: string,
	size: MetricColumnSize
) =>
	columnHelper.accessor(accessor, {
		id,
		header,
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: getMetricColumnWidthClass(size),
			align: 'end',
			headerHelperText
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
	columnHelper.accessor(accessor, {
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
	columnHelper.accessor(accessor, {
		id,
		header,
		cell: (info) => {
			if (info.getValue() == null) return null
			const helpers: string[] = []
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
	columnHelper.accessor(accessor, {
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

const pfOrPsColumn = (label: 'P/F' | 'P/S', headerHelperText: string) =>
	columnHelper.accessor((protocol) => protocol.pfOrPs, {
		id: 'pfOrPs',
		header: label,
		cell: (info) => formatRatio(info.getValue()),
		meta: {
			headerClassName: 'w-[120px]',
			align: 'center',
			headerHelperText
		}
	})

const getColumnsByType = (isChain: boolean = false) => {
	return {
		Fees: [
			NameColumn('Fees'),
			categoryColumn(),
			definitionColumn,
			centeredMetricColumn(
				'total24h',
				'Fees 24h',
				(protocol) => protocol.total24h,
				definitions.fees.protocol['24h'],
				128
			),
			centeredMetricColumn('total7d', 'Fees 7d', (protocol) => protocol.total7d, definitions.fees.protocol['7d'], 128),
			centeredMetricColumn(
				'total30d',
				'Fees 30d',
				(protocol) => protocol.total30d,
				definitions.fees.protocol['30d'],
				128
			)
		],
		Revenue: [
			NameColumn('Revenue'),
			categoryColumn(),
			definitionColumn,
			centeredMetricColumn(
				'total24h',
				'Revenue 24h',
				(protocol) => protocol.total24h,
				definitions.revenue.protocol['24h'],
				128
			),
			centeredMetricColumn(
				'total7d',
				'Revenue 7d',
				(protocol) => protocol.total7d,
				definitions.revenue.protocol['7d'],
				128
			),
			centeredMetricColumn(
				'total30d',
				'Revenue 30d',
				(protocol) => protocol.total30d,
				definitions.revenue.protocol['30d'],
				128
			)
		],
		'Holders Revenue': [
			NameColumn('Holders Revenue'),
			categoryColumn(),
			definitionColumn,
			centeredMetricColumn(
				'total24h',
				'Holders Revenue 24h',
				(protocol) => protocol.total24h,
				definitions.holdersRevenue.protocol['24h'],
				180
			),
			centeredMetricColumn(
				'total7d',
				'Holders Revenue 7d',
				(protocol) => protocol.total7d,
				definitions.holdersRevenue.protocol['7d'],
				180
			),
			centeredMetricColumn(
				'total30d',
				'Holders Revenue 30d',
				(protocol) => protocol.total30d,
				definitions.holdersRevenue.protocol['30d'],
				180
			)
		],
		'Options Premium Volume': [
			NameColumn('Options Premium Volume'),
			centeredMetricColumn(
				'total24h',
				'Premium Volume 24h',
				(protocol) => protocol.total24h,
				definitions.optionsPremium.protocol['24h'],
				180
			),
			centeredMetricColumn(
				'total7d',
				'Premium Volume 7d',
				(protocol) => protocol.total7d,
				definitions.optionsPremium.protocol['7d'],
				180
			),
			centeredMetricColumn(
				'total30d',
				'Premium Volume 30d',
				(protocol) => protocol.total30d,
				definitions.optionsPremium.protocol['30d'],
				180
			)
		],
		'Options Notional Volume': [
			NameColumn('Options Notional Volume'),
			centeredMetricColumn(
				'total24h',
				'Notional Volume 24h',
				(protocol) => protocol.total24h,
				definitions.optionsNotional.protocol['24h'],
				180
			),
			centeredMetricColumn(
				'total7d',
				'Notional Volume 7d',
				(protocol) => protocol.total7d,
				definitions.optionsNotional.protocol['7d'],
				180
			),
			centeredMetricColumn(
				'total30d',
				'Notional Volume 30d',
				(protocol) => protocol.total30d,
				definitions.optionsNotional.protocol['30d'],
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
			endMetricColumn(
				'total24h',
				'Open Interest',
				(protocol) => protocol.total24h,
				definitions.openInterest.protocol,
				160
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
			centeredMetricColumn(
				'total24h',
				'Perp Agg Vol 24h',
				(protocol) => protocol.total24h,
				definitions.perpsAggregators.protocol['24h'],
				160,
				'Perp Aggregator Volume 24h'
			),
			centeredMetricColumn(
				'total7d',
				'Perp Agg Volume 7d',
				(protocol) => protocol.total7d,
				definitions.perpsAggregators.protocol['7d'],
				160
			),
			centeredMetricColumn(
				'total30d',
				'Perp Agg Vol 30d',
				(protocol) => protocol.total30d,
				definitions.perpsAggregators.protocol['30d'],
				160,
				'Perp Aggregator Volume 30d'
			)
		],
		'Bridge Aggregator Volume': [
			NameColumn('Bridge Aggregator Volume'),
			centeredMetricColumn(
				'total24h',
				'Bridge Agg Vol 24h',
				(protocol) => protocol.total24h,
				definitions.bridgeAggregators.chain['24h'],
				160,
				'Bridge Aggregator Volume 24h'
			),
			centeredMetricColumn(
				'total7d',
				'Bridge Aggregator Volume 7d',
				(protocol) => protocol.total7d,
				definitions.bridgeAggregators.chain['7d'],
				160
			),
			centeredMetricColumn(
				'total30d',
				'Bridge Agg Vol 30d',
				(protocol) => protocol.total30d,
				definitions.bridgeAggregators.chain['30d'],
				160,
				'Bridge Aggregator Volume 30d'
			)
		],
		'DEX Aggregator Volume': [
			NameColumn('DEX Aggregator Volume'),
			centeredMetricColumn(
				'total24h',
				'DEX Agg Vol 24h',
				(protocol) => protocol.total24h,
				definitions.dexAggregators.protocol['24h'],
				160,
				'DEX Aggregator Volume 24h'
			),
			centeredMetricColumn(
				'total7d',
				'DEX Aggregator Volume 7d',
				(protocol) => protocol.total7d,
				definitions.dexAggregators.protocol['7d'],
				160
			),
			centeredMetricColumn(
				'total30d',
				'DEX Agg Vol 30d',
				(protocol) => protocol.total30d,
				definitions.dexAggregators.protocol['30d'],
				160,
				'DEX Aggregator Volume 30d'
			)
		],
		Earnings: [
			NameColumn('Earnings'),
			categoryColumn(),
			centeredMetricColumn(
				'total24h',
				'Earnings 24h',
				(protocol) => protocol.total24h,
				isChain ? definitions.earnings.chain['24h'] : definitions.earnings.protocol['24h'],
				160
			),
			centeredMetricColumn(
				'total7d',
				'Earnings 7d',
				(protocol) => protocol.total7d,
				isChain ? definitions.earnings.chain['7d'] : definitions.earnings.protocol['7d'],
				160
			),
			centeredMetricColumn(
				'total30d',
				'Earnings 30d',
				(protocol) => protocol.total30d,
				isChain ? definitions.earnings.chain['30d'] : definitions.earnings.protocol['30d'],
				160
			)
		],
		'P/F': [NameColumn('Fees'), categoryColumn('center'), pfOrPsColumn('P/F', definitions.fees.protocol['pf'])],
		'P/S': [NameColumn('Revenue'), categoryColumn('center'), pfOrPsColumn('P/S', definitions.revenue.protocol['ps'])]
	}
}
