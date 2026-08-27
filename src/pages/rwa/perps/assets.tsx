import type { InferGetStaticPropsType } from 'next'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { RWAPerpsAssetsOverview } from '~/containers/RWA/Perps/Assets'
import { getRWAPerpsAssetsOverview } from '~/containers/RWA/Perps/queries'
import { RWAPerpsTabNav } from '~/containers/RWA/Perps/TabNav'
import { rwaSlug } from '~/containers/RWA/rwaSlug'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging(`rwa/perps/assets`, async () => {
	const [metadataCache, { rows: assets, dexRows: dexAssets, initialChartDataset }] = await Promise.all([
		import('~/utils/metadata').then((m) => m.default),
		getRWAPerpsAssetsOverview()
	])

	return {
		props: {
			assets,
			dexAssets,
			initialChartDataset,
			assetLinks: [
				{ label: 'All', to: '/rwa/perps/assets' },
				...metadataCache.rwaPerpsList.assets.map((asset) => ({
					label: asset,
					to: `/rwa/perps/asset/${rwaSlug(asset)}`
				}))
			]
		},
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['RWA Perps']

export default function RWAPerpsAssetsPage({
	assets,
	dexAssets,
	initialChartDataset,
	assetLinks
}: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="RWA Perps by Asset - DefiLlama"
			description="Compare RWA perpetual assets across venues by open interest, 24h volume, market count, and funding rates."
			pageName={pageName}
			canonicalUrl="/rwa/perps/assets"
		>
			<RWAPerpsTabNav active="assets" />
			<RowLinksWithDropdown links={assetLinks} activeLink="All" />
			<RWAPerpsAssetsOverview assets={assets} dexAssets={dexAssets} initialChartDataset={initialChartDataset} />
		</Layout>
	)
}
