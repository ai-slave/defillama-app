import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { lazy, Suspense } from 'react'
import { FormattedName } from '~/components/FormattedName'
import { TokenLogo } from '~/components/TokenLogo'
import { getNFTRoyaltyHistory } from '~/containers/Nft/queries'
import Layout from '~/layout'
import { ChartPanel, ChartPanelExportShellFallback } from '~/ui/ChartPanel'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { StatItem, SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { formattedNum, slug } from '~/utils'

const MultiSeriesChart2 = lazy(() => import('~/components/ECharts/MultiSeriesChart2'))

export default function Collection() {
	const router = useRouter()
	const collection =
		typeof router.query.collection === 'string'
			? router.query.collection
			: Array.isArray(router.query.collection)
				? router.query.collection[0]
				: undefined

	const {
		data: collectionData,
		isLoading: fetchingData,
		error
	} = useQuery({
		queryKey: ['nft', 'collection', collection],
		queryFn: () => (collection ? getNFTRoyaltyHistory(collection) : null),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0,
		enabled: !!collection
	})

	const chartData = collectionData?.royaltyHistory?.[0]?.earningsChart ?? {
		dataset: { source: [], dimensions: ['timestamp', 'Earnings'] },
		charts: []
	}
	const collectionDescription = collection
		? `Track NFT royalties for ${collection}. Compare 30d and lifetime earnings with historical charts.`
		: `Track NFT royalty earnings by collection. Compare 30d and lifetime royalties with historical charts.`

	if (fetchingData) {
		return (
			<Layout
				title={'NFT Royalties - DefiLlama'}
				description={collectionDescription}
				canonicalUrl={collection ? `/nfts/royalties/${collection}` : `/nfts/royalties`}
			>
				<PanelLoadingStatus />
			</Layout>
		)
	}

	if (error || !collectionData) {
		return (
			<Layout
				title={'NFT Royalties - DefiLlama'}
				description={collectionDescription}
				canonicalUrl={collection ? `/nfts/royalties/${collection}` : `/nfts/royalties`}
			>
				<PanelStatus variant="error">{error?.message ?? 'Failed to fetch'}</PanelStatus>
			</Layout>
		)
	}

	const props = collectionData.royaltyHistory[0]

	return (
		<Layout
			title={props.name + ' Royalties - DefiLlama'}
			description={`Track NFT royalties for ${props.name}. Compare 30d and lifetime earnings with historical charts.`}
			canonicalUrl={collection ? `/nfts/royalties/${collection}` : `/nfts/royalties`}
		>
			<SummaryCardGrid className="*:last:col-span-2">
				<SummaryStatsCard>
					<h1 className="flex items-center gap-2 text-xl">
						<TokenLogo src={props.logo} fallbackSrc={props.fallbackLogo} alt={`Logo of ${props.name}`} size={48} />
						<FormattedName text={props.name} fontWeight={700} />
					</h1>

					<StatItem label="30d royalty earnings" value={formattedNum(props.total30d, true)} />

					<StatItem label="Lifetime royalty earnings" value={formattedNum(props.totalAllTime, true)} />
				</SummaryStatsCard>

				<ChartPanel className="col-span-full">
					<Suspense fallback={<ChartPanelExportShellFallback />}>
						<MultiSeriesChart2
							dataset={chartData.dataset}
							charts={chartData.charts}
							valueSymbol="$"
							exportButtons={{
								png: true,
								csv: true,
								filename: `${slug(props.name)}-royalty-earnings`,
								pngTitle: `${props.name} Royalty Earnings`
							}}
						/>
					</Suspense>
				</ChartPanel>
			</SummaryCardGrid>
		</Layout>
	)
}
