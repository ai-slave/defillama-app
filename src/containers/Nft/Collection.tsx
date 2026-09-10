import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import * as React from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { FormattedName } from '~/components/FormattedName'
import { TokenLogo } from '~/components/TokenLogo'
import { WebsiteGlobeLink } from '~/components/WebsiteGlobeLink'
import { getNFTCollection } from '~/containers/Nft/queries'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelExportShellFallback } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { Switch } from '~/ui/Switch'
import { formatNumber } from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'
import type { ICollectionScatterChartProps, IOrderBookChartProps } from './types'

const CollectionScatterChart = React.lazy(
	() => import('./CollectionScatterChart')
) as React.FC<ICollectionScatterChartProps>

const MultiSeriesChart = React.lazy(
	() => import('~/components/ECharts/MultiSeriesChart')
) as React.FC<IMultiSeriesChartProps>

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
	const floorPrice = lastFloorRow?.[1] ?? null
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
						{primaryCollection?.projectUrl ? (
							<span className="-m-2 ml-auto flex items-center justify-end gap-1">
								<WebsiteGlobeLink
									url={primaryCollection.projectUrl}
									name={name}
									event="nft-collection-website-click"
									eventData={{ collection: name }}
								/>
							</span>
						) : null}
					</h1>

					<StatItem label="Floor Price" value={floorPrice != null ? `${formatNumber(floorPrice)} ETH` : ''} />

					<StatItem label="24h Volume" value={volume24h != null ? `${formatNumber(volume24h)} ETH` : ''} />

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
					<React.Suspense fallback={null}>
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
							<MultiSeriesChart dataset={floorHistory} valueSymbol="ETH" title="Floor Price" />
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
