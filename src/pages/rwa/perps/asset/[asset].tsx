import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { DEFAULT_CHART_VIEW } from '~/containers/RWA/Perps/chartState'
import { RWAPerpsDashboard } from '~/containers/RWA/Perps/Dashboard'
import { getRWAPerpsAssetPage } from '~/containers/RWA/Perps/queries'
import { RWAPerpsTabNav } from '~/containers/RWA/Perps/TabNav'
import { findByRwaSlug, rwaSlug } from '~/containers/RWA/rwaSlug'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

export async function getStaticPaths() {
	if (SKIP_BUILD_STATIC_GENERATION) {
		return { paths: [], fallback: 'blocking' }
	}

	const metadataCache = await import('~/utils/metadata').then((m) => m.default)
	return {
		paths: metadataCache.rwaPerpsList.assets.slice(0, 10).map((asset) => ({ params: { asset: rwaSlug(asset) } })),
		fallback: 'blocking'
	}
}

export const getStaticProps = withPerformanceLogging(
	'rwa/perps/asset/[asset]',
	async ({ params }: GetStaticPropsContext<{ asset: string }>) => {
		if (!params?.asset) return { notFound: true }

		const metadataCache = await import('~/utils/metadata').then((m) => m.default)
		const assets = metadataCache.rwaPerpsList.assets
		const asset = findByRwaSlug(params.asset, assets)
		if (!asset) return { notFound: true }

		const assetSlug = rwaSlug(asset)
		if (params.asset !== assetSlug) {
			return canonicalRouteRedirect(`/rwa/perps/asset/${assetSlug}`)
		}

		const data = await getRWAPerpsAssetPage({
			asset,
			assetLinks: [
				{ label: 'All', to: '/rwa/perps/assets' },
				...assets.map((item) => ({ label: item, to: `/rwa/perps/asset/${rwaSlug(item)}` }))
			],
			activeView: DEFAULT_CHART_VIEW
		})

		return {
			props: { data },
			revalidate: maxAgeForNext([22])
		}
	}
)

const pageName = ['RWA Perps']

export default function RWAPerpsAssetPage({ data }: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title={`${data.asset} Perpetual Markets - DefiLlama`}
			description={`Compare ${data.asset} perpetual markets across venues by open interest, volume, funding, and market activity.`}
			pageName={pageName}
			canonicalUrl={`/rwa/perps/asset/${rwaSlug(data.asset)}`}
		>
			<RWAPerpsTabNav active="assets" />
			<RWAPerpsDashboard mode="asset" data={data} />
		</Layout>
	)
}
