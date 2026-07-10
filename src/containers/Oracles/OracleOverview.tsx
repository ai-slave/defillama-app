import { createColumnHelper } from '@tanstack/react-table'
import { lazy, Suspense, useMemo } from 'react'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import { BasicLink } from '~/components/Link'
import { QuestionHelper } from '~/components/QuestionHelper'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { TokenLogo } from '~/components/TokenLogo'
import { CHART_COLORS } from '~/constants/colors'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { ChartPanel, ChartPanelExportShellFallback } from '~/ui/ChartPanel'
import { LoadingDots } from '~/ui/Loaders'
import { Panel } from '~/ui/Panel'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { formattedNum, getTokenDominance, slug } from '~/utils'
import { chainIconUrl } from '~/utils/icons'
import {
	calculateTotalWithExtraToggles,
	getEnabledExtraTvlApiKeys,
	getEnabledForkOracleExtraTvlChartApiKeys
} from '~/utils/tvlOverlap'
import { useOracleOverviewExtraSeries } from './queries.client'
import type { OracleOverviewPageData } from './types'

const MultiSeriesChart2 = lazy(() => import('~/components/ECharts/MultiSeriesChart2'))

type IProtocolTableRow = OracleOverviewPageData['protocolTableData'][number]
const columnHelper = createColumnHelper<IProtocolTableRow>()

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

export const OracleOverview = ({
	chartData,
	chainLinks,
	oracle,
	tvl,
	extraTvl,
	protocolTableData,
	chain = null
}: OracleOverviewPageData) => {
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl')
	const protocolColumns = useMemo(
		() => [
			columnHelper.accessor('name', {
				header: 'Name',
				enableSorting: false,
				cell: ({ getValue, row }) => {
					const name = getValue()
					return (
						<span className="flex items-center gap-2">
							<span className="vf-row-index shrink-0" aria-hidden="true" />

							<TokenLogo src={row.original.logo} data-lgonly alt={`Logo of ${name}`} />

							<span className="flex items-center gap-1 overflow-hidden">
								<BasicLink
									href={`/protocol/${slug(name)}`}
									className="min-w-0 overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap text-(--legacy-link-text)"
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
			columnHelper.accessor('tvl', {
				header: 'TVL',
				enableSorting: true,
				cell: ({ row }) => {
					const strikeText = getStrikeTvlText({ row: row.original, extraTvlsEnabled })
					return (
						<span className="flex items-center justify-center gap-1">
							{strikeText ? <QuestionHelper text={strikeText} /> : null}
							<span className={strikeText ? 'text-tertiary' : ''}>{formattedNum(row.original.tvl, true)}</span>
						</span>
					)
				},
				meta: {
					headerClassName: 'w-[120px]',
					align: 'center'
				}
			})
		],
		[extraTvlsEnabled]
	)
	const enabledExtraApiKeys = useMemo(() => getEnabledExtraTvlApiKeys(extraTvlsEnabled), [extraTvlsEnabled])
	const enabledExtraChartApiKeys = useMemo(
		() => getEnabledForkOracleExtraTvlChartApiKeys(extraTvlsEnabled),
		[extraTvlsEnabled]
	)

	const { isFetchingExtraSeries, extraTvsByTimestamp } = useOracleOverviewExtraSeries({
		enabledExtraApiKeys: enabledExtraChartApiKeys,
		oracle,
		chain
	})

	const { tableData, totalValue } = useMemo(() => {
		const totalValue =
			enabledExtraApiKeys.length === 0
				? tvl
				: calculateTotalWithExtraToggles({
						values: { tvl, ...extraTvl },
						extraTvlsEnabled
					})

		const tableData: Array<IProtocolTableRow> =
			enabledExtraApiKeys.length === 0
				? protocolTableData
				: protocolTableData
						.map((protocol) => {
							const protocolTvl = calculateTotalWithExtraToggles({
								values: { tvl: protocol.tvl, ...(protocol.extraTvl ?? {}) },
								extraTvlsEnabled
							})

							return {
								...protocol,
								tvl: protocolTvl
							}
						})
						.sort((a, b) => b.tvl - a.tvl)

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
		const shouldApplyExtraSeries = enabledExtraChartApiKeys.length > 0 && !isFetchingExtraSeries

		const datasetSource: Array<{ timestamp: number; TVS: number }> = []

		for (const point of chartBreakdownByTimestamp) {
			const timestampInSeconds = point.timestamp
			const baseTvs = selectedOracle ? (point[selectedOracle] ?? 0) : 0
			const extraTvs = shouldApplyExtraSeries ? (extraTvsByTimestamp.get(timestampInSeconds) ?? 0) : 0
			const tvsValue = baseTvs + extraTvs

			datasetSource.push({
				timestamp: timestampInSeconds * 1e3,
				TVS: tvsValue
			})
		}
		return {
			dataset: {
				source: datasetSource,
				dimensions: ['timestamp', 'TVS']
			},
			charts: [
				{
					type: 'line' as const,
					name: 'TVS',
					encode: { x: 'timestamp', y: 'TVS' },
					color: CHART_COLORS[0],
					stack: 'TVS'
				}
			]
		}
	}, [chartData, enabledExtraChartApiKeys.length, extraTvsByTimestamp, isFetchingExtraSeries, oracle])

	const topProtocol = tableData[0] ?? null
	const dominance = topProtocol ? getTokenDominance({ tvl: topProtocol.tvl }, totalValue) : null
	const dominanceText = dominance == null ? null : String(dominance)
	const displayOracle = oracle ?? 'Oracle'
	const dominanceLabel = topProtocol ? `${topProtocol.name} Dominance` : 'Top Protocol Dominance'
	const chartTitle = chain ? `${displayOracle} on ${chain}` : displayOracle
	const chartFilenameTitle = chain ? `${displayOracle} TVS on ${chain}` : `${displayOracle} TVS`

	return (
		<>
			<RowLinksWithDropdown links={chainLinks} activeLink={chain ?? 'All'} />

			<SummaryCardGrid>
				<SummaryStatsCard>
					<h1 className="heading-sm">{displayOracle}</h1>
					<StatItem label="Total Value Secured (USD)" value={formattedNum(totalValue, true)} />
					<StatItem label={dominanceLabel} value={dominanceText === null ? 'N/A' : `${dominanceText}%`} />
				</SummaryStatsCard>

				<ChartPanel className="col-span-2">
					{isFetchingExtraSeries ? (
						<ChartPanelExportShellFallback
							role="status"
							aria-live="polite"
							className="my-auto flex items-center justify-center gap-1 text-center body-sm text-tertiary"
						>
							Loading
							<LoadingDots />
						</ChartPanelExportShellFallback>
					) : (
						<Suspense fallback={<ChartPanelExportShellFallback />}>
							<MultiSeriesChart2
								dataset={dataset}
								charts={charts}
								alwaysShowTooltip
								exportButtons={{
									png: true,
									csv: true,
									filename: slug(chartFilenameTitle),
									pngTitle: chartTitle,
									pngIconUrl: chain ? chainIconUrl(chain) : undefined
								}}
							/>
						</Suspense>
					)}
				</ChartPanel>
			</SummaryCardGrid>

			<Suspense fallback={<Panel padding="none" style={{ minHeight: `${tableData.length * 50 + 200}px` }} />}>
				<TableWithSearch
					data={tableData}
					columns={protocolColumns}
					columnToSearch="name"
					placeholder="Search protocols..."
					header="Protocols"
					sortingState={DEFAULT_PROTOCOL_TABLE_SORTING_STATE}
					csvFileName="oracle-protocols"
					compact
				/>
			</Suspense>
		</>
	)
}
