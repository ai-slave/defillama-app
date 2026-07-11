import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import * as React from 'react'
import type { IMultiSeriesChart2Props } from '~/components/ECharts/types'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { FormattedName } from '~/components/FormattedName'
import { TokenLogo } from '~/components/TokenLogo'
import { getNFTCollection } from '~/containers/Nft/queries'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelExportShellFallback } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { Switch } from '~/ui/Switch'
import { pushShallowQuery } from '~/utils/routerQuery'
import type { ICollectionScatterChartProps, IOrderBookChartProps } from './types'

const CollectionScatterChart = React.lazy(
	() => import('./CollectionScatterChart')
) as React.FC<ICollectionScatterChartProps>

const MultiSeriesChart2 = React.lazy(
	() => import('~/components/ECharts/MultiSeriesChart2')
) as React.FC<IMultiSeriesChart2Props>

const OrderbookChart = React.lazy(() => import('./OrderbookChart')) as React.FC<IOrderBookChartProps>

export function NFTCollectionContainer() {
	const router = useRouter()
	const collectionSlug =
		typeof router.query.collection === 'string'
			? router.query.collection
			: Array.isArray(router.query.collection)
				? router.query.collection[0]
				: null

	const { data: collectionData, isLoading: fetchingData } = useQuery({
		queryKey: ['nft', 'collection', collectionSlug],
		queryFn: () => (collectionSlug != null ? getNFTCollection(collectionSlug) : Promise.resolve(undefined)),
		enabled: collectionSlug != null,
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0
	})
	if (fetchingData || !collectionData) {
		return fetchingData || !router.isReady ? (
			<PanelLoadingStatus />
		) : (
			<PanelStatus variant="error">Failed to load collection data.</PanelStatus>
		)
	}
	const { name, data, stats, sales, salesExOutliers, salesMedian1d, address, floorHistory, orderbook } = collectionData
	const primaryCollection = data?.[0]
	const lastFloorRow =
		floorHistory?.source != null && Array.isArray(floorHistory.source) && floorHistory.source.length > 0
			? floorHistory.source[floorHistory.source.length - 1]
			: null
	const floorPriceRaw = lastFloorRow != null ? Number(lastFloorRow['Floor Price']) : null
	const floorPrice = typeof floorPriceRaw === 'number' && Number.isFinite(floorPriceRaw) ? floorPriceRaw : null
	const volume24h = stats.length > 0 ? (stats[stats.length - 1]?.[1] ?? null) : null

	const includeOutliers = router.isReady && router.query.includeOutliers === 'true'

	return (
		<>
			<SummaryCardGrid>
				<SummaryStatsCard>
					<h1 className="flex items-center gap-2 text-xl">
						<TokenLogo
							src={primaryCollection?.image}
							fallbackSrc={primaryCollection?.image}
							alt={`Logo of ${name}`}
							size={48}
						/>
						<FormattedName text={name ?? ''} fontWeight={700} />
					</h1>

					<StatItem label="Floor Price" value={floorPrice != null ? floorPrice.toFixed(2) + ' ETH' : ''} />

					<StatItem label="24h Volume" value={volume24h != null ? volume24h.toFixed(2) + ' ETH' : ''} />

					<StatItem label="Total Supply" value={primaryCollection?.totalSupply} />

					<ExternalLinkButton href={`https://etherscan.io/token/${address.split(':')[0]}`} className="mt-auto mr-auto">
						View on Etherscan
					</ExternalLinkButton>
				</SummaryStatsCard>

				<Panel padding="none" className="col-span-2 min-h-[394px]">
					<div className="flex w-full items-center justify-end p-3 pb-0">
						<Switch
							label="Include Outliers"
							value="showMcapChart"
							checked={includeOutliers}
							onChange={() => {
								void pushShallowQuery(router, { includeOutliers: !includeOutliers })
							}}
						/>
					</div>
					<React.Suspense fallback={<></>}>
						<CollectionScatterChart
							sales={includeOutliers ? sales : salesExOutliers}
							salesMedian1d={salesMedian1d}
							volume={stats}
						/>
					</React.Suspense>
				</Panel>
			</SummaryCardGrid>

			<div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
				{floorHistory?.source?.length > 0 ? (
					<ChartPanel className="relative only:col-span-full">
						<React.Suspense fallback={<ChartPanelExportShellFallback />}>
							<MultiSeriesChart2 dataset={floorHistory} valueSymbol="ETH" title="Floor Price" />
						</React.Suspense>
					</ChartPanel>
				) : null}
				{orderbook?.length > 0 ? (
					<ChartPanel className="relative only:col-span-full">
						<React.Suspense fallback={<ChartPanelBodyFallback />}>
							<OrderbookChart chartData={orderbook} />
						</React.Suspense>
					</ChartPanel>
				) : null}
			</div>
		</>
	)
}
