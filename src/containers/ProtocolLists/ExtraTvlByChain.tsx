import { createColumnHelper } from '@tanstack/react-table'
import { lazy, Suspense } from 'react'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import { BasicLink } from '~/components/Link'
import { ProtocolChainsHovercard } from '~/components/ProtocolChainsHovercard'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { TokenLogo } from '~/components/TokenLogo'
import { getCategoryRoute } from '~/containers/ProtocolTaxonomy/categoryRoutes'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelExportShellFallback } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { PercentChange } from '~/ui/PercentChange'
import { StatItem, SummaryCardGrid, SummaryChange, SummaryStatsCard } from '~/ui/SummaryStats'
import { TableToolbar } from '~/ui/Toolbar'
import { slug } from '~/utils'
import { chainIconUrl } from '~/utils/icons'
import { formatUsd } from '~/utils/numberFormat'
import type { ExtraTvlMetric, IExtraTvlByChainPageData, IExtraTvlProtocolRow } from './types'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

const METRIC_LABELS: Record<ExtraTvlMetric, { header: string; headerHelperText: string }> = {
	borrowed: {
		header: 'Active Loans',
		headerHelperText: 'Sum of value currently borrowed across all active loans on a Lending protocol'
	},
	staking: {
		header: 'Total Staked',
		headerHelperText: 'Sum of value currently staked across all staking protocols'
	},
	pool2: {
		header: 'Pool2 TVL',
		headerHelperText: 'Sum of value in Pool2 liquidity pools'
	}
}

const DEFAULT_SORTING_STATE = [{ id: 'value', desc: true }]

export function ExtraTvlByChain(props: IExtraTvlByChainPageData) {
	const metricInfo = METRIC_LABELS[props.metric]
	const chartTitle = props.chain === 'All' ? metricInfo.header : props.chain
	const chartFilenameTitle = props.chain === 'All' ? metricInfo.header : `${props.chain} ${metricInfo.header}`
	const exportButtons = {
		png: true,
		csv: true,
		filename: slug(chartFilenameTitle),
		pngTitle: chartTitle,
		...(props.chain !== 'All' ? { pngIconUrl: chainIconUrl(props.chain) } : {})
	}

	return (
		<>
			<RowLinksWithDropdown heading="Chains" links={props.chains} activeLink={props.chain} />
			<SummaryCardGrid>
				<SummaryStatsCard padding="sm">
					{props.chain !== 'All' ? (
						<h1 className="flex flex-nowrap items-center gap-2">
							<TokenLogo name={props.chain} kind="chain" size={24} alt={`Logo of ${props.chain}`} />
							<span className="heading-sm">{props.chain}</span>
						</h1>
					) : null}
					<div className="flex flex-wrap items-end justify-between gap-4">
						<StatItem
							label={metricInfo.header}
							labelAs={props.chain === 'All' ? 'h1' : 'span'}
							value={formatUsd(props.totalValue, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
							truncate
						/>
						{props.change24h != null ? <SummaryChange percent={props.change24h} comparison="over 24h" /> : null}
					</div>
				</SummaryStatsCard>
				<ChartPanel className="col-span-2">
					<Suspense fallback={<ChartPanelExportShellFallback />}>
						<MultiSeriesChart exportButtons={exportButtons} dataset={props.dataset} charts={props.charts} />
					</Suspense>
				</ChartPanel>
			</SummaryCardGrid>
			<SearchTableProvider
				options={{
					data: props.protocols,
					columns: EXTRA_TVL_COLUMNS_BY_METRIC[props.metric],
					initialState: { sorting: DEFAULT_SORTING_STATE },
					getSubRows: (row) => row.subRows
				}}
			>
				<Card padding="none">
					<TableToolbar>
						<TableSearchInput columnId="name" placeholder="Search protocols..." />
						<TableCsvExport filename={`protocols-${props.metric}-${props.chain}`} />
					</TableToolbar>
					<VirtualSearchTableView compact />
				</Card>
			</SearchTableProvider>
		</>
	)
}

const METRIC_CHART_PARAMS: Record<ExtraTvlMetric, string> = {
	borrowed: 'borrowed_tvl=true',
	staking: 'staking=true',
	pool2: 'pool2=true'
}

const columnHelper = createColumnHelper<SearchTableFeatures, IExtraTvlProtocolRow>()

function createColumns(metric: ExtraTvlMetric) {
	const metricInfo = METRIC_LABELS[metric]
	const chartParam = METRIC_CHART_PARAMS[metric]

	return columnHelper.columns([
		columnHelper.accessor('name', {
			id: 'name',
			header: 'Name',
			enableSorting: false,
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
						) : null}

						<span className="vf-row-index shrink-0" aria-hidden="true" />

						<TokenLogo src={row.original.logo} data-lgonly alt={`Logo of ${row.original.name}`} />

						<span className="-my-2 flex flex-col">
							<span className="flex items-center gap-1 overflow-hidden">
								<BasicLink
									href={`/protocol/${row.original.slug}?${chartParam}`}
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
		columnHelper.accessor('category', {
			id: 'category',
			header: 'Category',
			enableSorting: false,
			cell: ({ getValue }) => {
				const value = getValue()
				if (!value) return null
				return (
					<BasicLink href={getCategoryRoute(slug(value))} className="text-sm font-medium text-link">
						{value}
					</BasicLink>
				)
			},
			meta: {
				headerClassName: 'w-[128px]'
			}
		}),
		columnHelper.accessor((row) => row.value ?? undefined, {
			id: 'value',
			header: metricInfo.header,
			cell: (info) =>
				info.getValue() != null
					? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
					: null,
			meta: {
				headerClassName: 'w-[128px]',
				align: 'end',
				headerHelperText: metricInfo.headerHelperText
			}
		}),
		columnHelper.accessor((row) => row.change_1m ?? undefined, {
			id: 'change_1m',
			header: 'Change 30d',
			cell: (info) => <PercentChange percent={info.getValue()} />,
			meta: {
				headerClassName: 'w-[110px]',
				align: 'end'
			}
		})
	])
}

const EXTRA_TVL_COLUMNS_BY_METRIC = {
	borrowed: createColumns('borrowed'),
	staking: createColumns('staking'),
	pool2: createColumns('pool2')
} satisfies Record<ExtraTvlMetric, ReturnType<typeof createColumns>>
