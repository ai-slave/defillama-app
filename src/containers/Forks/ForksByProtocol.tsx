import { lazy, Suspense, useMemo } from 'react'
import { tvlOptionNames } from '~/components/Filters/options'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { TokenLogo } from '~/components/TokenLogo'
import { CHART_COLORS } from '~/constants/colors'
import { ChainProtocolsTable } from '~/containers/ProtocolRankings/Table'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { ChartPanel, ChartPanelExportShellFallback } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { FailedDataNote } from '~/ui/ScopeNote'
import { LoadingIndicator } from '~/ui/Status'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { getTokenDominance, slug } from '~/utils'
import { tokenIconUrl } from '~/utils/icons'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { getEnabledForkOracleExtraTvlChartApiKeys, mergeBaseAndExtraTvlHistory } from '~/utils/tvlOverlap'
import { useForkByProtocolExtraSeries } from './queries.client'
import type { ForkByProtocolPageData } from './types'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))

export function ForksByProtocol({ fork, forkLinks, protocolTableData, chartData }: ForkByProtocolPageData) {
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl')
	const enabledExtraApiKeys = useMemo(
		() => getEnabledForkOracleExtraTvlChartApiKeys(extraTvlsEnabled),
		[extraTvlsEnabled]
	)
	const { failedApiKeys, isFetchingExtraSeries, extraTvsByTimestamp } = useForkByProtocolExtraSeries({
		enabledExtraApiKeys,
		protocol: fork
	})

	const { totalValue, topProtocol, dataset, charts } = useMemo(() => {
		const topProtocol = protocolTableData[0] ?? null
		const history = isFetchingExtraSeries
			? chartData
			: mergeBaseAndExtraTvlHistory({
					base: chartData,
					extra: extraTvsByTimestamp
				})
		const source: Array<[number, number]> = []
		for (const [timestampInSeconds, value] of history) source.push([timestampInSeconds * 1000, value])
		const dataset = {
			source,
			dimensions: ['timestamp', 'TVL']
		}
		const totalValue = source.at(-1)?.[1] ?? 0

		const charts = [
			{
				type: 'line' as const,
				name: 'TVL',
				encode: { x: 0, y: 1 },
				color: CHART_COLORS[0],
				stack: 'TVL'
			}
		]

		return { totalValue, topProtocol, dataset, charts }
	}, [chartData, extraTvsByTimestamp, isFetchingExtraSeries, protocolTableData])

	const dominance = topProtocol ? getTokenDominance({ tvl: topProtocol.tvl?.default?.tvl ?? 0 }, totalValue) : null
	const dominanceText = dominance == null ? null : String(dominance)
	const chartTitle = `${fork} Forks`
	const chartFilenameTitle = `${fork} Forks TVL`

	return (
		<>
			<RowLinksWithDropdown links={forkLinks} activeLink={fork} alternativeOthersText="Others" />
			<SummaryCardGrid>
				<SummaryStatsCard>
					<h1 className="flex items-center gap-2 heading-sm">
						<TokenLogo name={fork} kind="token" size={24} alt={`Logo of ${fork}`} />
						{fork}
					</h1>
					<StatItem
						label="TVL in Forks (USD)"
						value={formatUsd(totalValue, {
							compact: true,
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})}
					/>
					<StatItem
						label={<>{topProtocol?.name ?? 'Top Protocol'} Dominance</>}
						value={dominanceText == null ? 'N/A' : formatPercent(dominanceText, { input: 'percent' })}
					/>
				</SummaryStatsCard>

				<ChartPanel className="col-span-2">
					{!isFetchingExtraSeries ? (
						<FailedDataNote
							labels={failedApiKeys.map((key) => tvlOptionNames[key])}
							shows="The chart shows TVL without them."
						/>
					) : null}
					{isFetchingExtraSeries ? (
						<ChartPanelExportShellFallback
							role="status"
							aria-live="polite"
							className="my-auto flex items-center justify-center"
						>
							<LoadingIndicator />
						</ChartPanelExportShellFallback>
					) : (
						<Suspense fallback={<ChartPanelExportShellFallback />}>
							<MultiSeriesChart
								dataset={dataset}
								charts={charts}
								alwaysShowTooltip
								exportButtons={{
									png: true,
									csv: true,
									filename: slug(chartFilenameTitle),
									pngTitle: chartTitle,
									pngIconUrl: tokenIconUrl(fork)
								}}
							/>
						</Suspense>
					)}
				</ChartPanel>
			</SummaryCardGrid>
			<Suspense
				fallback={
					<Panel
						padding="none"
						style={{
							minHeight: `${protocolTableData.length * 50 + 200}px`
						}}
					/>
				}
			>
				<ChainProtocolsTable protocols={protocolTableData} useStickyHeader={false} />
			</Suspense>
		</>
	)
}
