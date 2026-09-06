import * as React from 'react'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import {
	buildNFTMarketplaceChartPresentation,
	buildNFTMarketplaceCsvDataset,
	buildNFTMarketplaceRelativeChartData
} from '~/containers/Nft/marketplaceCharts'
import { NftsMarketplaceTable } from '~/containers/Nft/NftsMarketplaceTable'
import { getNFTMarketplacesData } from '~/containers/Nft/queries'
import { useAllSeriesSelection } from '~/hooks/useSeriesSelection'
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
	dailyTotals,
	upstreamRemainder,
	availableSeries
}: Awaited<ReturnType<typeof getNFTMarketplacesData>>) {
	const [viewType, setViewType] = React.useState<ViewType>('Absolute')
	const { activeSeries, setSelectedSeries, includeUpstreamOthers } = useAllSeriesSelection({ availableSeries })
	const canonicalChartData = React.useMemo(
		() => ({
			absoluteVolumeDataset,
			absoluteTradesDataset,
			absoluteBarCharts,
			dailyTotals,
			upstreamRemainder,
			availableSeries
		}),
		[absoluteBarCharts, absoluteTradesDataset, absoluteVolumeDataset, availableSeries, dailyTotals, upstreamRemainder]
	)
	const presentation = React.useMemo(
		() => buildNFTMarketplaceChartPresentation(canonicalChartData, activeSeries, includeUpstreamOthers),
		[activeSeries, canonicalChartData, includeUpstreamOthers]
	)
	const relativeData = React.useMemo(
		() => (viewType === 'Relative' ? buildNFTMarketplaceRelativeChartData(presentation) : null),
		[presentation, viewType]
	)
	const selectableSeries = presentation.availableSeries
	const renderedCharts = React.useMemo(
		() => new Set(presentation.absoluteBarCharts.map((chart) => chart.name)),
		[presentation.absoluteBarCharts]
	)

	return (
		<Layout
			title="NFT Marketplace Volume & Rankings - DefiLlama"
			description="Compare NFT marketplace volume and trading activity. Track OpenSea, Blur, and other marketplaces by daily and weekly volume."
			canonicalUrl="/nfts/marketplaces"
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
					{selectableSeries.length > 1 ? (
						<SelectWithCombobox
							allValues={selectableSeries}
							selectedValues={activeSeries}
							setSelectedValues={setSelectedSeries}
							label="Marketplace"
							labelType="smol"
							variant="filter"
							size="md"
						/>
					) : null}
				</div>
				<div className="grid grid-cols-1 *:col-span-1 xl:min-h-[400px] xl:grid-cols-2">
					<React.Suspense fallback={<ChartPanelExportShellFallback className="w-full" />}>
						<MultiSeriesChart
							title="Volume"
							dataset={relativeData?.relativeVolumeDataset ?? presentation.absoluteVolumeDataset}
							csvSource={{
								type: 'dataset',
								prepare: () =>
									buildNFTMarketplaceCsvDataset({
										canonical: canonicalChartData,
										metric: 'volume',
										relative: viewType === 'Relative'
									})
							}}
							charts={relativeData?.relativeAreaCharts ?? presentation.absoluteBarCharts}
							selectedCharts={renderedCharts}
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
							dataset={relativeData?.relativeTradesDataset ?? presentation.absoluteTradesDataset}
							csvSource={{
								type: 'dataset',
								prepare: () =>
									buildNFTMarketplaceCsvDataset({
										canonical: canonicalChartData,
										metric: 'trades',
										relative: viewType === 'Relative'
									})
							}}
							charts={relativeData?.relativeAreaCharts ?? presentation.absoluteBarCharts}
							selectedCharts={renderedCharts}
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
