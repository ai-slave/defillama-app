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
		return {
			paths: [],
			fallback: 'blocking'
		}
	}

	const metadataCache = await import('~/utils/metadata').then((m) => m.default)
	return {
		paths: metadataCache.rwaPerpsList.assetGroups.slice(0, 10).map((assetGroup) => ({
			params: { assetGroup: rwaSlug(assetGroup) }
		})),
		fallback: 'blocking'
	}
}

/* A Perps scope page: the overview container with the markets of one asset group. */
export const getStaticProps = withPerformanceLogging(
	`rwa/perps/asset-group/[assetGroup]`,
	async ({ params }: GetStaticPropsContext<{ assetGroup: string }>) => {
		if (!params?.assetGroup) {
			return { notFound: true }
		}

		const metadataCache = await import('~/utils/metadata').then((m) => m.default)
		const assetGroups = metadataCache.rwaPerpsList.assetGroups
		const assetGroup = findByRwaSlug(params.assetGroup, assetGroups)
		if (!assetGroup) {
			// An asset group with spot assets but no perps markets lands on the Perps overview, not on a 404.
			if (findByRwaSlug(params.assetGroup, metadataCache.rwaList.assetGroups))
				return { ...canonicalRouteRedirect('/rwa/perps'), revalidate: maxAgeForNext([22]) }
			return { notFound: true }
		}

		if (params.assetGroup !== rwaSlug(assetGroup)) {
			return canonicalRouteRedirect(`/rwa/perps/asset-group/${rwaSlug(assetGroup)}`)
		}

		const props = await getRWAPerpsPageProps({
			scope: { kind: 'assetGroup', assetGroup },
			perpsAssetGroups: assetGroups,
			rwaPlatformsIndex: metadataCache.rwaPlatformsIndex
		})
		if (!props) return { notFound: true, revalidate: maxAgeForNext([22]) }

		const entityQuestions = await fetchRwaPageQuestions({
			kind: 'perpsAssetGroup',
			scopeName: assetGroup,
			rows: unpackRwaPerpsMarkets(props.markets)
		})

		return {
			props: { ...props, assetGroup, entityQuestions },
			revalidate: maxAgeForNext([22])
		}
	}
)

const pageName = ['RWA Perps']

export default function RWAPerpsAssetGroupPage({
	assetGroup,
	...props
}: InferGetStaticPropsType<typeof getStaticProps>) {
	const meta = getRwaPageMeta('perpsAssetGroup', { name: assetGroup, slug: rwaSlug(assetGroup) })
	return (
		<Layout title={meta.title} description={meta.description} pageName={pageName} canonicalUrl={meta.canonicalUrl}>
			<RWAPerpsTreePage {...props} pageKind="perpsAssetGroup" perpsAsset={null} />
		</Layout>
	)
}
