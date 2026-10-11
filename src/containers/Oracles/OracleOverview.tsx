import { createColumnHelper } from '@tanstack/react-table'
import { lazy, Suspense, useMemo } from 'react'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import { tvlOptionNames } from '~/components/Filters/options'
import { BasicLink } from '~/components/Link'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { CHART_COLORS } from '~/constants/colors'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { ChartPanelExportShellLoading } from '~/ui/ChartPanel'
import { Icon } from '~/ui/Icon'
import { Logo } from '~/ui/Logo'
import { Panel } from '~/ui/Panel'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { FailedDataNote } from '~/ui/ScopeNote'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { TableToolbar } from '~/ui/Toolbar'
import { getTokenDominance, slug } from '~/utils'
import { chainIconUrl } from '~/utils/icons'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import {
	calculateTotalWithExtraToggles,
	getEnabledExtraTvlApiKeys,
	getEnabledForkOracleExtraTvlChartApiKeys,
	mergeBaseAndExtraTvlHistory
} from '~/utils/tvlOverlap'
import { getTopMeasuredOracleProtocol } from './byChainData'
import { useOracleOverviewExtraSeries } from './queries.client'
import type { OracleOverviewPageData } from './types'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

type IProtocolTableRow = OracleOverviewPageData['protocolTableData'][number]
const columnHelper = createColumnHelper<SearchTableFeatures, IProtocolTableRow>()

const DEFAULT_PROTOCOL_TABLE_SORTING_STATE = [{ id: 'tvl', desc: true }]

function getStrikeTvlText({
	row,
	extraTvlsEnabled
}: {
	row: IProtocolTableRow
	extraTvlsEnabled: Record<string, boolean>
}): string | null {
	if (!row.strikeTvl) return null

	if (!extraTvlsEnabled['doublecounted'] && !extraTvlsEnabled['liquidstaking']) {
		return 'This protocol deposits into another protocol or is under Liquid Staking category, so it is subtracted from total TVL because both "Liquid Staking" and "Double Count" toggles are off'
	} else if (!extraTvlsEnabled['doublecounted']) {
		return 'This protocol deposits into another protocol and is subtracted from total TVL because "Double Count" toggle is off'
	} else if (!extraTvlsEnabled['liquidstaking']) {
		return 'This protocol is under Liquid Staking category and is subtracted from total TVL because "Liquid Staking" toggle is off'
	}

	return null
}

export function OracleOverview({
	chartData,
	chainLinks,
	oracle,
	tvl,
	extraTvl,
	protocolTableData,
	chain = null
}: OracleOverviewPageData) {
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl')
	const protocolColumns = useMemo(
		() =>
			columnHelper.columns([
				columnHelper.accessor('name', {
					header: 'Name',
					enableSorting: false,
					cell: ({ getValue, row }) => {
						const name = getValue()
						return (
							<span className={`relative flex items-center gap-2 ${row.depth > 0 ? 'pl-8' : 'pl-4'}`}>
								{row.subRows.length > 0 ? (
									<Button
										size="sm"
										variant="ghost"
										square
										aria-expanded={row.getIsExpanded()}
										type="button"
										className="absolute -left-1.5"
										onClick={row.getToggleExpandedHandler()}
									>
										<Icon name={row.getIsExpanded() ? 'chevron-down' : 'chevron-right'} className="size-4" />
										<span className="sr-only">
											{row.getIsExpanded() ? 'Hide child protocols' : 'View child protocols'}
										</span>
									</Button>
								) : null}
								<span className="vf-row-index shrink-0" aria-hidden="true" />

								<Logo size={24} src={row.original.logo} data-lgonly alt={`Logo of ${name}`} />

								<span className="flex items-center gap-1 overflow-hidden">
									<BasicLink
										href={`/protocol/${slug(name)}`}
										className="min-w-0 truncate label-md text-link hover:underline"
									>
										{name}
									</BasicLink>
									{row.original.deprecated ? <DeprecatedProtocolMarker /> : null}
								</span>
							</span>
						)
					},
					meta: {
						headerClassName: 'w-[min(240px,40vw)]'
					}
				}),
				columnHelper.accessor('category', {
					header: 'Category',
					enableSorting: false,
					cell: ({ getValue }) => getValue() ?? 'Unknown',
					meta: {
						headerClassName: 'w-[140px]',
						align: 'center'
					}
				}),
				columnHelper.accessor((row) => row.tvl ?? undefined, {
					id: 'tvl',
					header: 'TVL',
					enableSorting: true,
					sortUndefined: 'last',
					cell: ({ row }) => {
						const strikeText = getStrikeTvlText({ row: row.original, extraTvlsEnabled })
						return (
							<span className="flex items-center justify-center gap-1">
								{strikeText ? <QuestionHelper text={strikeText} /> : null}
								<span className={strikeText ? 'text-tertiary' : ''}>
									{row.original.tvl === null
										? null
										: formatUsd(row.original.tvl, {
												compact: true,
												minimumCompactValue: 1_000_000,
												compactSuffix: 'lowercase'
											})}
								</span>
							</span>
						)
					},
					meta: {
						headerClassName: 'w-[120px]',
						align: 'center'
					}
				})
			]),
		[extraTvlsEnabled]
	)
	const enabledExtraApiKeys = useMemo(() => getEnabledExtraTvlApiKeys(extraTvlsEnabled), [extraTvlsEnabled])
	const enabledExtraChartApiKeys = useMemo(
		() => getEnabledForkOracleExtraTvlChartApiKeys(extraTvlsEnabled),
		[extraTvlsEnabled]
	)

	const { isFetchingExtraSeries, failedApiKeys, extraTvsByTimestamp } = useOracleOverviewExtraSeries({
		enabledExtraApiKeys: enabledExtraChartApiKeys,
		oracle,
		chain
	})

	const { tableData, totalValue } = useMemo(() => {
		const totalValue =
			tvl === null
				? null
				: enabledExtraApiKeys.length === 0
					? tvl
					: calculateTotalWithExtraToggles({
							values: { tvl, ...extraTvl },
							extraTvlsEnabled
						})

		let tableData = protocolTableData
		if (enabledExtraApiKeys.length > 0) {
			const applyExtraTvls = (protocol: IProtocolTableRow): IProtocolTableRow => {
				const childProtocols: Array<IProtocolTableRow> = []
				for (const child of protocol.childProtocols ?? []) childProtocols.push(applyExtraTvls(child))
				const protocolTvl =
					protocol.tvl === null
						? null
						: calculateTotalWithExtraToggles({
								values: { tvl: protocol.tvl, ...protocol.extraTvl },
								extraTvlsEnabled
							})
				const row: IProtocolTableRow = {
					name: protocol.name,
					logo: protocol.logo,
					category: protocol.category,
					tvl: protocolTvl,
					extraTvl: protocol.extraTvl,
					strikeTvl: protocol.strikeTvl
				}
				if (protocol.deprecated) row.deprecated = true
				if (childProtocols.length > 0) row.childProtocols = childProtocols
				return row
			}
			tableData = []
			for (const protocol of protocolTableData) tableData.push(applyExtraTvls(protocol))
			tableData.sort((a, b) => {
				if (a.tvl === null) return b.tvl === null ? 0 : 1
				if (b.tvl === null) return -1
				return b.tvl - a.tvl
			})
		}

		return {
			tableData,
			totalValue
		}
	}, [enabledExtraApiKeys.length, extraTvl, extraTvlsEnabled, protocolTableData, tvl])

	const { dataset, charts } = useMemo(() => {
		const chartBreakdownByTimestamp = chartData
		let firstOracle = ''
		const firstPoint = chartBreakdownByTimestamp[0] ?? {}
		for (const key in firstPoint) {
			if (key !== 'timestamp') {
				firstOracle = key
				break
			}
		}
		const selectedOracle = oracle ?? firstOracle
		const baseHistory: Array<[number, number]> = []

		for (const point of chartBreakdownByTimestamp) {
			const baseTvs = selectedOracle ? point[selectedOracle] : undefined
			if (baseTvs !== undefined) baseHistory.push([point.timestamp, baseTvs])
		}
		const history = mergeBaseAndExtraTvlHistory({
			base: baseHistory,
			extra: extraTvsByTimestamp
		})
		const datasetSource: Array<[number, number]> = []
		for (const [timestampInSeconds, value] of history) datasetSource.push([timestampInSeconds * 1e3, value])
		return {
			dataset: {
				source: datasetSource,
				dimensions: ['timestamp', 'TVS']
			},
			charts: [
				{
					type: 'line' as const,
					name: 'TVS',
					encode: { x: 0, y: 1 },
					color: CHART_COLORS[0],
					stack: 'TVS'
				}
			]
		}
	}, [chartData, extraTvsByTimestamp, oracle])

	const topProtocol = getTopMeasuredOracleProtocol(tableData)
	const dominance =
		topProtocol?.tvl != null && totalValue != null ? getTokenDominance({ tvl: topProtocol.tvl }, totalValue) : null
	const dominanceText = dominance == null ? null : String(dominance)
	const displayOracle = oracle ?? 'Oracle'
	const dominanceLabel = topProtocol ? `${topProtocol.name} Dominance` : 'Top Protocol Dominance'
	const chartTitle = chain ? `${displayOracle} on ${chain}` : displayOracle
	const chartFilenameTitle = chain ? `${displayOracle} TVS on ${chain}` : `${displayOracle} TVS`

	return (
		<>
			<RowLinksWithDropdown heading="Chains" links={chainLinks} activeLink={chain ?? 'All'} />

			<SummaryCardGrid>
				<SummaryStatsCard>
					<h1 className="heading-sm">{displayOracle}</h1>
					<StatItem
						label="Total Value Secured (USD)"
						value={
							totalValue === null
								? null
								: formatUsd(totalValue, {
										compact: true,
										minimumCompactValue: 1_000_000,
										compactSuffix: 'lowercase'
									})
						}
					/>
					<StatItem
						label={dominanceLabel}
						value={dominanceText === null ? 'N/A' : formatPercent(dominanceText, { input: 'percent' })}
					/>
				</SummaryStatsCard>

				<Panel className="col-span-2">
					{!isFetchingExtraSeries ? (
						<FailedDataNote
							labels={failedApiKeys.map((key) => tvlOptionNames[key])}
							shows="The chart shows TVL without them."
						/>
					) : null}
					{isFetchingExtraSeries ? (
						<ChartPanelExportShellLoading />
					) : (
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								dataset={dataset}
								charts={charts}
								alwaysShowTooltip
								exportButtons={{
									png: true,
									csv: true,
									filename: slug(chartFilenameTitle),
									pngTitle: chartTitle,
									...(chain ? { pngIconUrl: chainIconUrl(chain) } : {})
								}}
							/>
						</Suspense>
					)}
				</Panel>
			</SummaryCardGrid>

			<Suspense fallback={<Panel style={{ minHeight: `${tableData.length * 50 + 200}px` }} />}>
				<SearchTableProvider
					options={{
						data: tableData,
						columns: protocolColumns,
						initialState: { sorting: DEFAULT_PROTOCOL_TABLE_SORTING_STATE },
						getSubRows: (row) => row.childProtocols
					}}
				>
					<Card padding="none">
						<TableToolbar>
							<h2 className="mr-auto label-md">Protocols</h2>
							<TableSearchInput columnId="name" placeholder="Search protocols…" width="inline" />
							<TableCsvExport filename="oracle-protocols" />
						</TableToolbar>
						<VirtualSearchTableView compact />
					</Card>
				</SearchTableProvider>
			</Suspense>
		</>
	)
}
