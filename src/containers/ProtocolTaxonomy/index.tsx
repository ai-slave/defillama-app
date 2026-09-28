import { type CellContext, createColumnHelper } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { lazy, Suspense, useDeferredValue, useMemo, useState } from 'react'
import { ChartExportButtons } from '~/components/ChartExport/ChartExportButtons'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import {
	ChartGroupingSelector,
	DWMC_GROUPING_OPTIONS_LOWERCASE,
	type LowercaseDwmcGrouping
} from '~/components/ECharts/shared/ChartGroupingSelector'
import { BasicLink } from '~/components/Link'
import { ProtocolChainsHovercard } from '~/components/ProtocolChainsHovercard'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { Select } from '~/components/Select/Select'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableColumnSelect } from '~/components/Table/search/TableColumnSelect'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { TokenLogo } from '~/components/TokenLogo'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useGetChartInstance } from '~/hooks/useGetChartInstance'
import { definitions } from '~/public/definitions'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { searchFieldInlineWrapperStyles } from '~/ui/Input'
import { MetricRow } from '~/ui/MetricPrimitives'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { TableToolbar } from '~/ui/Toolbar'
import { chainIconUrl } from '~/utils/icons'
import { formatRatio, formatUsd } from '~/utils/numberFormat'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'
import { buildProtocolTaxonomyGroupedCharts } from './chartGrouping'
import {
	getProtocolCategoryColumns,
	getProtocolCategoryDefaultSort,
	getProtocolCategoryDexVolumeLabel,
	getProtocolCategoryPresentation,
	type ProtocolCategoryColumn
} from './constants'
import { applyProtocolTaxonomyTvlSettings } from './tvl'
import type { IProtocolTaxonomyPageData, ProtocolTaxonomyBreakdownKey } from './types'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const CHART_BREAKDOWN_OPTIONS: ReadonlyArray<{
	key: 'combined' | ProtocolTaxonomyBreakdownKey
	name: string
	help?: string
}> = [
	{ key: 'combined', name: 'Combined' },
	{ key: 'protocol', name: 'Payment Volume by Protocol' },
	{ key: 'chain', name: 'Payment Volume by Chain' },
	{
		key: 'network',
		name: 'Payment Volume by Network',
		help: 'Excludes cards that run on both Visa and Mastercard, and cards whose network is unknown'
	},
	{
		key: 'custody',
		name: 'Payment Volume by Custody',
		help: 'Excludes cards whose custody model is unknown'
	}
]

export function ProtocolTaxonomyPage(props: IProtocolTaxonomyPageData) {
	const router = useRouter()
	const name = props.category ?? props.tag ?? ''
	const namePrefix = name ? `${name}-` : ''
	const [groupBy, setGroupBy] = useState<LowercaseDwmcGrouping>('daily')
	const { chartInstance, handleChartReady } = useGetChartInstance()
	const categoryPresentation = useMemo(
		() =>
			getProtocolCategoryPresentation({
				label: name,
				effectiveCategory: props.effectiveCategory,
				isTagPage: !!props.tag && !props.category
			}),
		[name, props.effectiveCategory, props.tag, props.category]
	)

	const [tvlSettings] = useLocalStorageSettingsManager('tvl')

	const { finalProtocols, charts } = useMemo<{
		finalProtocols: IProtocolTaxonomyPageData['protocols']
		charts: IProtocolTaxonomyPageData['charts']
	}>(
		() =>
			applyProtocolTaxonomyTvlSettings({
				protocols: props.protocols,
				charts: props.charts,
				extraTvlCharts: props.extraTvlCharts,
				tvlSettings
			}),
		[tvlSettings, props.protocols, props.charts, props.extraTvlCharts]
	)

	const categoryColumns = useMemo(() => {
		return getColumnsForCategory(props.effectiveCategory)
	}, [props.effectiveCategory])

	const sortingState = useMemo(() => {
		const sortId = getProtocolCategoryDefaultSort(props.effectiveCategory)
		return [{ id: sortId, desc: true }]
	}, [props.effectiveCategory])

	const chartBreakdownOptions = useMemo(
		() =>
			CHART_BREAKDOWN_OPTIONS.filter(
				(option) => option.key === 'combined' || props.breakdownCharts[option.key] != null
			),
		[props.breakdownCharts]
	)
	const requestedChartBreakdown = readSingleQueryValue(router.query.chartBreakdown)
	const chartBreakdown = chartBreakdownOptions.some((option) => option.key === requestedChartBreakdown)
		? (requestedChartBreakdown as ProtocolTaxonomyBreakdownKey)
		: 'combined'
	const chartBreakdownLabel = chartBreakdownOptions.find((option) => option.key === chartBreakdown)?.name ?? 'Combined'

	const groupedChartResult = useMemo(() => {
		const activeCharts = chartBreakdown === 'combined' ? charts : (props.breakdownCharts[chartBreakdown] ?? charts)
		return buildProtocolTaxonomyGroupedCharts({ charts: activeCharts, groupBy })
	}, [chartBreakdown, charts, groupBy, props.breakdownCharts])
	const hasBarCharts = groupedChartResult.hasBarCharts
	// Deferred as one snapshot, so labels and exports never pair old rows with a new grouping.
	const deferredGroupedChartResult = useDeferredValue(groupedChartResult)
	const deferredGroupedCharts = deferredGroupedChartResult.charts
	const chartGroupBy = deferredGroupedChartResult.groupBy

	return (
		<>
			{props.chains.length > 1 ? (
				<RowLinksWithDropdown heading="Chains" links={props.chains} activeLink={props.chain} />
			) : null}
			<SummaryCardGrid>
				<SummaryStatsCard>
					{props.chain === 'All' ? (
						<h1 className="heading-xs">{categoryPresentation.headingLabel}</h1>
					) : (
						<h1 className="heading-xs">{`${categoryPresentation.headingLabel} on ${props.chain}`}</h1>
					)}
					<div className="mb-auto flex flex-1 flex-col">
						{charts.dataset.source.length > 0 && charts.dataset.dimensions.includes('TVL') ? (
							<MetricRow
								label="Total Value Locked"
								tooltip="Sum of value of all coins held in smart contracts of all the protocols on the chain"
								value={formatUsd(
									charts.dataset?.source[charts.dataset?.source.length - 1]?.[charts.dataset.dimensions.indexOf('TVL')],
									{ compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }
								)}
							/>
						) : null}
						{props.optionsPremium7d != null ? (
							<MetricRow
								label="Premium Volume (7d)"
								tooltip={definitions.optionsPremium.chain['7d']}
								value={formatUsd(props.optionsPremium7d, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
							/>
						) : null}
						{props.optionsNotional7d != null ? (
							<MetricRow
								label="Notional Volume (7d)"
								tooltip={definitions.optionsNotional.chain['7d']}
								value={formatUsd(props.optionsNotional7d, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
							/>
						) : null}
						{props.fees7d != null ? (
							<MetricRow
								label="Fees (7d)"
								tooltip={definitions.fees.chain['7d']}
								value={formatUsd(props.fees7d, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
							/>
						) : null}
						{props.revenue7d != null ? (
							<MetricRow
								label="Revenue (7d)"
								tooltip={definitions.revenue.chain['7d']}
								value={formatUsd(props.revenue7d, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
							/>
						) : null}
						{props.perpVolume7d != null ? (
							<MetricRow
								label="Perp Volume (7d)"
								tooltip={definitions.perps.protocol['7d']}
								value={formatUsd(props.perpVolume7d, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
							/>
						) : null}
						{props.dexVolume7d != null ? (
							<MetricRow
								label={`${getProtocolCategoryDexVolumeLabel(props.effectiveCategory)} (7d)`}
								value={formatUsd(props.dexVolume7d, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
							/>
						) : null}
						{props.openInterest != null ? (
							<MetricRow
								label="Open Interest"
								tooltip={definitions.openInterest.common}
								value={formatUsd(props.openInterest, {
									compact: true,
									minimumCompactValue: 1_000_000,
									compactSuffix: 'lowercase'
								})}
							/>
						) : null}
					</div>
				</SummaryStatsCard>
				<ChartPanel className="col-span-2">
					<ChartPanelToolbar>
						{chartBreakdownOptions.length > 1 ? (
							<div className="mr-auto">
								<Select
									heading="Breakdown"
									allValues={chartBreakdownOptions}
									selectedValues={chartBreakdown}
									setSelectedValues={(value: string) => {
										const selected = chartBreakdownOptions.find((option) => option.key === value)?.key
										if (!selected) return
										void pushShallowQuery(router, {
											chartBreakdown: selected === 'combined' ? undefined : selected
										})
									}}
									label={chartBreakdownLabel}
									labelType="none"
									variant="filter"
									size="md"
								/>
							</div>
						) : null}
						{hasBarCharts ? (
							<ChartGroupingSelector value={groupBy} setValue={setGroupBy} options={DWMC_GROUPING_OPTIONS_LOWERCASE} />
						) : null}
						<ChartExportButtons
							chartInstance={chartInstance}
							filename={`protocols-${namePrefix}${props.chain || 'all'}${chartBreakdown === 'combined' ? '' : `-by-${chartBreakdown}`}`}
							title={
								props.chain === 'All'
									? categoryPresentation.headingLabel
									: `${categoryPresentation.headingLabel} on ${props.chain}`
							}
							iconUrl={props.chain && props.chain !== 'All' ? chainIconUrl(props.chain) : undefined}
							csvSource={{
								type: 'dataset',
								prepare: () => ({ ...deferredGroupedCharts.dataset, groupBy: chartGroupBy })
							}}
						/>
					</ChartPanelToolbar>
					<Suspense fallback={<ChartPanelBodyFallback />}>
						<MultiSeriesChart
							dataset={deferredGroupedCharts.dataset}
							charts={deferredGroupedCharts.charts}
							groupBy={chartGroupBy}
							hideDefaultLegend={false}
							valueSymbol="$"
							onReady={handleChartReady}
						/>
					</Suspense>
				</ChartPanel>
			</SummaryCardGrid>
			<SearchTableProvider
				options={{
					data: finalProtocols,
					columns: categoryColumns,
					initialState: { sorting: sortingState },
					getSubRows: (row) => row.subRows
				}}
			>
				<Card padding="none">
					<TableToolbar>
						<h2 className="mr-auto label-md">{categoryPresentation.tableHeader}</h2>
						<TableSearchInput
							columnId="name"
							placeholder={categoryPresentation.searchPlaceholder}
							className={searchFieldInlineWrapperStyles}
						/>
						<TableColumnSelect />
						<TableCsvExport filename={`defillama-${namePrefix}${props.chain || 'all'}-protocols`} />
					</TableToolbar>
					<VirtualSearchTableView />
				</Card>
			</SearchTableProvider>
		</>
	)
}

type ProtocolRow = IProtocolTaxonomyPageData['protocols'][0]

const columnHelper = createColumnHelper<SearchTableFeatures, ProtocolRow>()
export function getProtocolMcapTvlRatio(mcap: number | null, tvl: number | null): number | undefined {
	return mcap !== null && tvl !== null && tvl > 0 ? mcap / tvl : undefined
}

const perpVolumeCell = (info: CellContext<SearchTableFeatures, ProtocolRow, number | undefined>) => {
	if (info.getValue() == null) return null
	const helpers: Array<string> = []
	if (info.row.original.perpVolume?.zeroFeePerp) {
		helpers.push('This protocol charges no fees for most of its users')
	}
	if (helpers.length > 0) {
		return (
			<span className="flex items-center justify-end gap-1">
				{helpers.map((helper) => (
					<QuestionHelper key={`${info.row.original.name}-${helper}`} text={helper} />
				))}
				<span className={info.row.original.perpVolume?.doublecounted ? 'text-tertiary' : ''}>
					{formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
				</span>
			</span>
		)
	}
	return formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
}

const COLUMN_REGISTRY = {
	name: columnHelper.accessor('name', {
		id: 'name',
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const value = getValue()
			return (
				<span className={`relative flex items-center gap-2 ${row.depth > 0 ? 'pl-8' : 'pl-4'}`}>
					{row.subRows?.length > 0 ? (
						<Button
							size="sm"
							variant="ghost"
							square
							type="button"
							className="absolute -left-1.5"
							onClick={row.getToggleExpandedHandler()}
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
					) : null}
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
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(280px,40vw)]'
		}
	}),
	tvl: columnHelper.accessor((p) => p.tvl ?? undefined, {
		id: 'tvl',
		header: 'TVL',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end',
			headerHelperText: 'Sum of value of all coins held in smart contracts of the protocol'
		}
	}),
	'mcap/tvl': columnHelper.accessor((p) => getProtocolMcapTvlRatio(p.mcap, p.tvl) ?? undefined, {
		id: 'mcap/tvl',
		header: 'Mcap/TVL',
		cell: (info) => formatRatio(info.getValue()),
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end',
			headerHelperText: 'Market cap / TVL ratio'
		}
	}),
	fees_7d: columnHelper.accessor((p) => p.fees?.total7d ?? undefined, {
		id: 'fees_7d',
		header: 'Fees 7d',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[100px]',
			align: 'end',
			headerHelperText: definitions.fees.protocol['7d']
		}
	}),
	revenue_7d: columnHelper.accessor((p) => p.revenue?.total7d ?? undefined, {
		id: 'revenue_7d',
		header: 'Revenue 7d',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[128px]',
			align: 'end',
			headerHelperText: definitions.revenue.protocol['7d']
		}
	}),
	fees_30d: columnHelper.accessor((p) => p.fees?.total30d ?? undefined, {
		id: 'fees_30d',
		header: 'Fees 30d',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[100px]',
			align: 'end',
			headerHelperText: definitions.fees.protocol['30d']
		}
	}),
	revenue_30d: columnHelper.accessor((p) => p.revenue?.total30d ?? undefined, {
		id: 'revenue_30d',
		header: 'Revenue 30d',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[128px]',
			align: 'end',
			headerHelperText: definitions.revenue.protocol['30d']
		}
	}),
	fees_24h: columnHelper.accessor((p) => p.fees?.total24h ?? undefined, {
		id: 'fees_24h',
		header: 'Fees 24h',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[100px]',
			align: 'end',
			headerHelperText: definitions.fees.protocol['24h']
		}
	}),
	revenue_24h: columnHelper.accessor((p) => p.revenue?.total24h ?? undefined, {
		id: 'revenue_24h',
		header: 'Revenue 24h',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[128px]',
			align: 'end',
			headerHelperText: definitions.revenue.protocol['24h']
		}
	}),
	perp_volume_24h: columnHelper.accessor((p) => p.perpVolume?.total24h ?? undefined, {
		id: 'perp_volume_24h',
		header: 'Perp Volume 24h',
		cell: (info) => perpVolumeCell(info),
		meta: {
			headerClassName: 'w-[160px]',
			align: 'end',
			headerHelperText: definitions.perps.protocol['24h']
		}
	}),
	perp_volume_7d: columnHelper.accessor((p) => p.perpVolume?.total7d ?? undefined, {
		id: 'perp_volume_7d',
		header: 'Perp Volume 7d',
		cell: (info) => perpVolumeCell(info),
		meta: {
			headerClassName: 'w-[160px]',
			align: 'end',
			headerHelperText: definitions.perps.protocol['7d']
		}
	}),
	perp_volume_30d: columnHelper.accessor((p) => p.perpVolume?.total30d ?? undefined, {
		id: 'perp_volume_30d',
		header: 'Perp Volume 30d',
		cell: (info) => perpVolumeCell(info),
		meta: {
			headerClassName: 'w-[160px]',
			align: 'end',
			headerHelperText: definitions.perps.protocol['30d']
		}
	}),
	openInterest: columnHelper.accessor((p) => p.openInterest?.total24h ?? undefined, {
		id: 'openInterest',
		header: 'Open Interest',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[160px]',
			align: 'end',
			headerHelperText: definitions.openInterest.protocol
		}
	}),
	dex_volume_7d: columnHelper.accessor((p) => p.dexVolume?.total7d ?? undefined, {
		id: 'dex_volume_7d',
		header: 'DEX Volume 7d',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: definitions.dexs.protocol['7d']
		}
	}),
	dex_volume_30d: columnHelper.accessor((p) => p.dexVolume?.total30d ?? undefined, {
		id: 'dex_volume_30d',
		header: 'DEX Volume 30d',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[148px]',
			align: 'end',
			headerHelperText: definitions.dexs.protocol['30d']
		}
	}),
	dex_volume_24h: columnHelper.accessor((p) => p.dexVolume?.total24h ?? undefined, {
		id: 'dex_volume_24h',
		header: 'DEX Volume 24h',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[148px]',
			align: 'end',
			headerHelperText: definitions.dexs.protocol['24h']
		}
	}),
	dex_aggregator_volume_7d: columnHelper.accessor((p) => p.dexVolume?.total7d ?? undefined, {
		id: 'dex_aggregator_volume_7d',
		header: 'DEX Aggregator Volume 7d',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[min(220px,40vw)]',
			align: 'end',
			headerHelperText: definitions.dexs.protocol['7d']
		}
	}),
	dex_aggregator_volume_30d: columnHelper.accessor((p) => p.dexVolume?.total30d ?? undefined, {
		id: 'dex_aggregator_volume_30d',
		header: 'DEX Aggregator Volume 30d',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[min(220px,40vw)]',
			align: 'end',
			headerHelperText: definitions.dexs.protocol['30d']
		}
	}),
	dex_aggregator_volume_24h: columnHelper.accessor((p) => p.dexVolume?.total24h ?? undefined, {
		id: 'dex_aggregator_volume_24h',
		header: 'DEX Aggregator Volume 24h',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[min(220px,40vw)]',
			align: 'end',
			headerHelperText: definitions.dexs.protocol['24h']
		}
	}),
	prediction_volume_7d: columnHelper.accessor((p) => p.dexVolume?.total7d ?? undefined, {
		id: 'prediction_volume_7d',
		header: 'Prediction Volume 7d',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[min(180px,40vw)]',
			align: 'end',
			headerHelperText: definitions.dexs.protocol['7d']
		}
	}),
	prediction_volume_30d: columnHelper.accessor((p) => p.dexVolume?.total30d ?? undefined, {
		id: 'prediction_volume_30d',
		header: 'Prediction Volume 30d',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[min(195px,40vw)]',
			align: 'end',
			headerHelperText: definitions.dexs.protocol['30d']
		}
	}),
	prediction_volume_24h: columnHelper.accessor((p) => p.dexVolume?.total24h ?? undefined, {
		id: 'prediction_volume_24h',
		header: 'Prediction Volume 24h',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[min(195px,40vw)]',
			align: 'end',
			headerHelperText: definitions.dexs.protocol['24h']
		}
	}),
	payment_volume_7d: columnHelper.accessor((p) => p.dexVolume?.total7d ?? undefined, {
		id: 'payment_volume_7d',
		header: 'Payment Volume 7d',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[min(180px,40vw)]',
			align: 'end',
			headerHelperText: definitions.dexs.protocol['7d']
		}
	}),
	payment_volume_30d: columnHelper.accessor((p) => p.dexVolume?.total30d ?? undefined, {
		id: 'payment_volume_30d',
		header: 'Payment Volume 30d',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[min(180px,40vw)]',
			align: 'end',
			headerHelperText: definitions.dexs.protocol['30d']
		}
	}),
	payment_volume_24h: columnHelper.accessor((p) => p.dexVolume?.total24h ?? undefined, {
		id: 'payment_volume_24h',
		header: 'Payment Volume 24h',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[min(180px,40vw)]',
			align: 'end',
			headerHelperText: definitions.dexs.protocol['24h']
		}
	}),
	spot_volume_7d: columnHelper.accessor((p) => p.dexVolume?.total7d ?? undefined, {
		id: 'spot_volume_7d',
		header: 'Spot Volume 7d',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[160px]',
			align: 'end',
			headerHelperText: definitions.dexs.protocol['7d']
		}
	}),
	spot_volume_30d: columnHelper.accessor((p) => p.dexVolume?.total30d ?? undefined, {
		id: 'spot_volume_30d',
		header: 'Spot Volume 30d',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[160px]',
			align: 'end',
			headerHelperText: definitions.dexs.protocol['30d']
		}
	}),
	spot_volume_24h: columnHelper.accessor((p) => p.dexVolume?.total24h ?? undefined, {
		id: 'spot_volume_24h',
		header: 'Spot Volume 24h',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[160px]',
			align: 'end',
			headerHelperText: definitions.dexs.protocol['24h']
		}
	}),
	options_premium_7d: columnHelper.accessor((p) => p.optionsPremium?.total7d ?? undefined, {
		id: 'options_premium_7d',
		header: 'Premium Volume 7d',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[min(180px,40vw)]',
			align: 'end',
			headerHelperText: definitions.optionsPremium.protocol['7d']
		}
	}),
	options_premium_30d: columnHelper.accessor((p) => p.optionsPremium?.total30d ?? undefined, {
		id: 'options_premium_30d',
		header: 'Premium Volume 30d',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[min(180px,40vw)]',
			align: 'end',
			headerHelperText: definitions.optionsPremium.protocol['30d']
		}
	}),
	options_premium_24h: columnHelper.accessor((p) => p.optionsPremium?.total24h ?? undefined, {
		id: 'options_premium_24h',
		header: 'Premium Volume 24h',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[min(180px,40vw)]',
			align: 'end',
			headerHelperText: definitions.optionsPremium.protocol['24h']
		}
	}),
	options_notional_7d: columnHelper.accessor((p) => p.optionsNotional?.total7d ?? undefined, {
		id: 'options_notional_7d',
		header: 'Notional Volume 7d',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[min(180px,40vw)]',
			align: 'end',
			headerHelperText: definitions.optionsNotional.protocol['7d']
		}
	}),
	options_notional_30d: columnHelper.accessor((p) => p.optionsNotional?.total30d ?? undefined, {
		id: 'options_notional_30d',
		header: 'Notional Volume 30d',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[min(180px,40vw)]',
			align: 'end',
			headerHelperText: definitions.optionsNotional.protocol['30d']
		}
	}),
	options_notional_24h: columnHelper.accessor((p) => p.optionsNotional?.total24h ?? undefined, {
		id: 'options_notional_24h',
		header: 'Notional Volume 24h',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[min(180px,40vw)]',
			align: 'end',
			headerHelperText: definitions.optionsNotional.protocol['24h']
		}
	}),
	borrowed: columnHelper.accessor((p) => p.borrowed ?? undefined, {
		id: 'borrowed',
		header: 'Active Loans',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: 'Total amount currently borrowed from the protocol'
		}
	}),
	supplied: columnHelper.accessor((p) => p.supplied ?? undefined, {
		id: 'supplied',
		header: 'Supplied',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[100px]',
			align: 'end',
			headerHelperText: 'Total amount supplied to the protocol'
		}
	}),
	'supplied/tvl': columnHelper.accessor((p) => p.suppliedTvl ?? undefined, {
		id: 'supplied/tvl',
		header: 'Supplied/TVL',
		cell: (info) => formatRatio(info.getValue()),
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: '(Total amount supplied / Total value locked) ratio'
		}
	})
} satisfies Record<ProtocolCategoryColumn, object>

export function getColumnsForCategory(effectiveCategory: string | null) {
	const columnIds = getProtocolCategoryColumns(effectiveCategory)
	return columnIds.map((id) => COLUMN_REGISTRY[id])
}
