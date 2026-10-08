import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { RWAOverview } from '~/containers/RWA'
import { appendUnknownRwaAssetGroup, normalizeRwaAssetGroup } from '~/containers/RWA/assetGroup'
import { getRwaPageMeta } from '~/containers/RWA/layout/pageCopy'
import { fetchRwaPageQuestions } from '~/containers/RWA/layout/questions.server'
import { getRWAAssetsOverview } from '~/containers/RWA/queries'
import { rwaSlug } from '~/containers/RWA/rwaSlug'
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
	const rwaList = metadataCache.rwaList
	return {
		paths: appendUnknownRwaAssetGroup(rwaList.assetGroups)
			.slice(0, 10)
			.map((assetGroup) => ({ params: { assetGroup: rwaSlug(normalizeRwaAssetGroup(assetGroup)) } })),
		fallback: 'blocking'
	}
}

export const getStaticProps = withPerformanceLogging(
	`rwa/asset-group/[assetGroup]`,
	async ({ params }: GetStaticPropsContext<{ assetGroup: string }>) => {
		if (!params?.assetGroup) {
			return { notFound: true }
		}

		const assetGroupSlug = rwaSlug(params.assetGroup)
		const metadataCache = await import('~/utils/metadata').then((m) => m.default)
		const rwaList = metadataCache.rwaList

		let assetGroupName = null
		for (const assetGroup of appendUnknownRwaAssetGroup(rwaList.assetGroups)) {
			const normalizedAssetGroup = normalizeRwaAssetGroup(assetGroup)
			if (rwaSlug(normalizedAssetGroup) === assetGroupSlug) {
				assetGroupName = normalizedAssetGroup
				break
			}
		}

		if (!assetGroupName) {
			return { notFound: true }
		}

		if (params.assetGroup !== assetGroupSlug) {
			return canonicalRouteRedirect(`/rwa/asset-group/${assetGroupSlug}`)
		}

		const props = await getRWAAssetsOverview({
			assetGroup: assetGroupSlug,
			rwaList,
			rwaPlatformsIndex: metadataCache.rwaPlatformsIndex
		})
		if (!props || props.assets.length === 0) {
			return { notFound: true, revalidate: maxAgeForNext([22]) }
		}

		const entityQuestions = await fetchRwaPageQuestions({
			kind: 'assetGroup',
			scopeName: assetGroupName,
			rows: props.assets,
			defaultInclusion: props.defaultInclusion
		})

		return {
			props: { ...props, assetGroupName, entityQuestions },
			revalidate: maxAgeForNext([22])
		}
	}
)

const pageName = ['RWA']

export default function RWAAssetGroupPage(props: InferGetStaticPropsType<typeof getStaticProps>) {
	const meta = getRwaPageMeta('assetGroup', { name: props.assetGroupName, slug: props.assetGroupSlug ?? '' })
	return (
		<Layout title={meta.title} description={meta.description} pageName={pageName} canonicalUrl={meta.canonicalUrl}>
			<RWAOverview {...props} pageKind="assetGroup" />
		</Layout>
	)
}
