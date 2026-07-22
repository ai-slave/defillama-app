import * as React from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { buildNFTMarketplaceRelativeChartData } from '~/containers/Nft/marketplaceCharts'
import { NftsMarketplaceTable } from '~/containers/Nft/NftsMarketplaceTable'
import { getNFTMarketplacesData } from '~/containers/Nft/queries'
import Layout from '~/layout'
import { ChartPanelExportShellFallback } from '~/ui/ChartPanel'
import { Panel } from '~/ui/Panel'
import { TagGroup } from '~/ui/SegmentedControl'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

const MultiSeriesChart = React.lazy(
	() => import('~/components/ECharts/MultiSeriesChart')
) as React.FC<IMultiSeriesChartProps>

export const getStaticProps = withPerformanceLogging('nfts/marketplaces', async () => {
	const data = await getNFTMarketplacesData()

	return {
		props: {
			...data
		},
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['Volume', 'by', 'NFT Marketplaces']

const VIEW_TYPES = ['Absolute', 'Relative'] as const
type ViewType = (typeof VIEW_TYPES)[number]

function Marketplaces({
	data,
	absoluteVolumeDataset,
	absoluteTradesDataset,
	absoluteBarCharts,
	dailyTotals
}: Awaited<ReturnType<typeof getNFTMarketplacesData>>) {
	const [viewType, setViewType] = React.useState<ViewType>('Absolute')
	const relativeData = React.useMemo(
		() =>
			viewType === 'Relative'
				? buildNFTMarketplaceRelativeChartData({
						absoluteVolumeDataset,
						absoluteTradesDataset,
						absoluteBarCharts,
						dailyTotals
					})
				: null,
		[absoluteBarCharts, absoluteTradesDataset, absoluteVolumeDataset, dailyTotals, viewType]
	)

	return (
		<Layout
			title="NFT Marketplace Volume & Rankings - DefiLlama"
			description="Compare NFT marketplace volume and trading activity. Track OpenSea, Blur, and other marketplaces by daily and weekly volume."
			canonicalUrl={`/nfts/marketplaces`}
			pageName={pageName}
		>
			<Panel padding="none">
				<div className="flex items-center justify-between gap-2 p-2">
					<TagGroup
						variant="default"
						size="md"
						selectedValue={viewType}
						setValue={(v) => setViewType(v)}
						values={VIEW_TYPES}
						className="ml-auto"
					/>
				</div>
				<div className="grid grid-cols-1 *:col-span-1 xl:min-h-[400px] xl:grid-cols-2">
					<React.Suspense fallback={<ChartPanelExportShellFallback className="w-full" />}>
						<MultiSeriesChart
							title="Volume"
							dataset={relativeData?.relativeVolumeDataset ?? absoluteVolumeDataset}
							charts={relativeData?.relativeAreaCharts ?? absoluteBarCharts}
							stacked={viewType === 'Relative'}
							expandTo100Percent={viewType === 'Relative'}
							valueSymbol={viewType === 'Relative' ? '%' : 'ETH'}
							tooltipMaxItems={10}
							showTotalInTooltip
							hideDefaultLegend
							exportButtons={{
								png: true,
								csv: true,
								filename: `nft-marketplaces-volume-${viewType.toLowerCase()}`,
								pngTitle: `NFT Marketplaces Volume (${viewType})`
							}}
						/>
					</React.Suspense>

					<React.Suspense fallback={<ChartPanelExportShellFallback className="w-full" />}>
						<MultiSeriesChart
							title="Trades"
							dataset={relativeData?.relativeTradesDataset ?? absoluteTradesDataset}
							charts={relativeData?.relativeAreaCharts ?? absoluteBarCharts}
							stacked={viewType === 'Relative'}
							expandTo100Percent={viewType === 'Relative'}
							valueSymbol={viewType === 'Relative' ? '%' : ''}
							tooltipMaxItems={10}
							showTotalInTooltip
							hideDefaultLegend
							exportButtons={{
								png: true,
								csv: true,
								filename: `nft-marketplaces-trades-${viewType.toLowerCase()}`,
								pngTitle: `NFT Marketplaces Trades (${viewType})`
							}}
						/>
					</React.Suspense>
				</div>
				<NftsMarketplaceTable data={data} />
			</Panel>
		</Layout>
	)
}

export default Marketplaces
