import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { getRwaPageMeta } from '~/containers/RWA/layout/pageCopy'
import { RWAPerpsTreePage } from '~/containers/RWA/layout/PerpsTreePage'
import { fetchRwaPageQuestions } from '~/containers/RWA/layout/questions.server'
import { unpackRwaPerpsMarkets } from '~/containers/RWA/perpsPayload'
import { getRWAPerpsPageProps } from '~/containers/RWA/perpsQueries'
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

/* A Perps scope page: the overview container with the markets of one underlying across venues. */
export const getStaticProps = withPerformanceLogging(
	'rwa/perps/asset/[asset]',
	async ({ params }: GetStaticPropsContext<{ asset: string }>) => {
		if (!params?.asset) return { notFound: true }

		const metadataCache = await import('~/utils/metadata').then((m) => m.default)
		const asset = findByRwaSlug(params.asset, metadataCache.rwaPerpsList.assets)
		if (!asset) return { notFound: true }

		const assetSlug = rwaSlug(asset)
		if (params.asset !== assetSlug) {
			return canonicalRouteRedirect(`/rwa/perps/asset/${assetSlug}`)
		}

		const props = await getRWAPerpsPageProps({
			scope: { kind: 'asset', asset },
			perpsAssetGroups: metadataCache.rwaPerpsList.assetGroups,
			rwaPlatformsIndex: metadataCache.rwaPlatformsIndex
		})
		if (!props) return { notFound: true, revalidate: maxAgeForNext([22]) }

		const entityQuestions = await fetchRwaPageQuestions({
			kind: 'perpsAsset',
			scopeName: asset,
			rows: unpackRwaPerpsMarkets(props.markets)
		})

		return {
			props: { ...props, asset, entityQuestions },
			revalidate: maxAgeForNext([22])
		}
	}
)

const pageName = ['RWA Perps']

export default function RWAPerpsAssetPage({ asset, ...props }: InferGetStaticPropsType<typeof getStaticProps>) {
	const meta = getRwaPageMeta('perpsAsset', { name: asset, slug: rwaSlug(asset) })
	return (
		<Layout title={meta.title} description={meta.description} pageName={pageName} canonicalUrl={meta.canonicalUrl}>
			<RWAPerpsTreePage {...props} pageKind="perpsAsset" perpsAsset={asset} />
		</Layout>
	)
}
