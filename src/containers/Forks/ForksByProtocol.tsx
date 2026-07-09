import { lazy, Suspense, useMemo } from 'react'
import { LoadingDots } from '~/components/Loaders'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { TokenLogo } from '~/components/TokenLogo'
import { CHART_COLORS } from '~/constants/colors'
import { ChainProtocolsTable } from '~/containers/ProtocolRankings/Table'
import { useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { Card } from '~/ui/Card'
import { Panel } from '~/ui/Panel'
import { formattedNum, getTokenDominance, slug } from '~/utils'
import { tokenIconUrl } from '~/utils/icons'
import { getEnabledForkOracleExtraTvlChartApiKeys } from '~/utils/tvlOverlap'
import { useForkByProtocolExtraSeries } from './queries.client'
import type { ForkByProtocolPageData } from './types'

const MultiSeriesChart2 = lazy(() => import('~/components/ECharts/MultiSeriesChart2'))

export const ForksByProtocol = ({ fork, forkLinks, protocolTableData, chartData }: ForkByProtocolPageData) => {
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl')
	const enabledExtraApiKeys = useMemo(
		() => getEnabledForkOracleExtraTvlChartApiKeys(extraTvlsEnabled),
		[extraTvlsEnabled]
	)
	const { isFetchingExtraSeries, extraTvsByTimestamp } = useForkByProtocolExtraSeries({
		enabledExtraApiKeys,
		protocol: fork
	})

	const { totalValue, topProtocol, dataset, charts } = useMemo(() => {
		const topProtocol = protocolTableData[0] ?? null
		const dataset = {
			source: chartData.map(([timestampInSeconds, baseValue]) => {
				const extraValue = enabledExtraApiKeys.length > 0 ? (extraTvsByTimestamp.get(timestampInSeconds) ?? 0) : 0
				return {
					timestamp: timestampInSeconds * 1000,
					TVL: baseValue + extraValue
				}
			}),
			dimensions: ['timestamp', 'TVL']
		}
		const totalValue = dataset.source.length > 0 ? dataset.source[dataset.source.length - 1].TVL : 0

		const charts = [
			{
				type: 'line' as const,
				name: 'TVL',
				encode: { x: 'timestamp', y: 'TVL' },
				color: CHART_COLORS[0],
				stack: 'TVL'
			}
		]

		return { totalValue, topProtocol, dataset, charts }
	}, [chartData, enabledExtraApiKeys.length, extraTvsByTimestamp, protocolTableData])

	const dominance = topProtocol ? getTokenDominance({ tvl: topProtocol.tvl?.default?.tvl ?? 0 }, totalValue) : null
	const dominanceText = dominance == null ? null : String(dominance)
	const chartTitle = `${fork} Forks`
	const chartFilenameTitle = `${fork} Forks TVL`

	const isLoading = enabledExtraApiKeys.length > 0 && isFetchingExtraSeries
	return (
		<>
			<RowLinksWithDropdown links={forkLinks} activeLink={fork} alternativeOthersText="Others" />
			{isLoading ? (
				<Panel padding="md" className="flex-1 items-center justify-center">
					<p role="status" aria-live="polite" className="flex items-center gap-1 body-sm text-tertiary">
						Loading
						<LoadingDots />
					</p>
				</Panel>
			) : (
				<>
					<div className="relative isolate grid grid-cols-2 gap-2 xl:grid-cols-3">
						<Card padding="md" className="col-span-2 flex w-full flex-col gap-6 overflow-x-auto xl:col-span-1">
							<h1 className="flex items-center gap-2 heading-sm">
								<TokenLogo name={fork} kind="token" size={24} alt={`Logo of ${fork}`} />
								{fork}
							</h1>
							<p className="flex flex-col">
								<span className="text-(--text-label)">TVL in Forks (USD)</span>
								<span className="font-jetbrains text-2xl font-semibold">{formattedNum(totalValue, true)}</span>
							</p>
							<p className="flex flex-col">
								<span className="text-(--text-label)">{topProtocol?.name ?? 'Top Protocol'} Dominance</span>
								<span className="font-jetbrains text-2xl font-semibold">
									{dominanceText == null ? 'N/A' : `${dominanceText}%`}
								</span>
							</p>
						</Card>

						<Panel padding="none" className="col-span-2">
							<Suspense fallback={<div className="min-h-[406px]" />}>
								<MultiSeriesChart2
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
						</Panel>
					</div>
					<Suspense
						fallback={<Panel padding="none" style={{ minHeight: `${protocolTableData.length * 50 + 200}px` }} />}
					>
						<ChainProtocolsTable protocols={protocolTableData} useStickyHeader={false} />
					</Suspense>
				</>
			)}
		</>
	)
}
