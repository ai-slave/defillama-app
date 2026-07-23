import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { tvlOptions } from '~/components/Filters/options'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { ProtocolTaxonomyPage } from '~/containers/ProtocolTaxonomy'
import { getProtocolCategoryPresentation } from '~/containers/ProtocolTaxonomy/constants'
import { getProtocolTaxonomyPageData } from '~/containers/ProtocolTaxonomy/queries'
import Layout from '~/layout'
import { slug } from '~/utils'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

export const getStaticProps = withPerformanceLogging(
	'protocols/[category]/[chain]',
	async ({ params }: GetStaticPropsContext<{ category: string; chain: string }>) => {
		if (!params?.category || !params?.chain) {
			return { notFound: true }
		}

		const category = params.category
		const chain = slug(params.chain)

		const [{ default: metadataCache }, { resolveChainParamFromMetadata }, { resolveProtocolListingParamFromMetadata }] =
			await Promise.all([
				import('~/utils/metadata'),
				import('~/containers/ChainOverview/server/routes'),
				import('~/containers/ProtocolTaxonomy/server/routes')
			])
		const { categoriesAndTags } = metadataCache
		const categoryRoute = resolveProtocolListingParamFromMetadata(category, metadataCache)
		const chainRoute = resolveChainParamFromMetadata(params.chain, metadataCache)

		if (!categoryRoute || !chainRoute) {
			return {
				notFound: true
			}
		}

		if (category !== categoryRoute.canonicalSlug || params.chain !== chainRoute.canonicalSlug) {
			return canonicalRouteRedirect(`/protocols/${categoryRoute.canonicalSlug}/${chainRoute.canonicalSlug}`)
		}

		const props =
			categoryRoute.kind === 'category'
				? await getProtocolTaxonomyPageData({
						kind: 'category',
						category: categoryRoute.value,
						chain,
						categoriesAndTags,
						chainMetadata: metadataCache.chainMetadata
					})
				: await getProtocolTaxonomyPageData({
						kind: 'tag',
						tag: categoryRoute.value,
						tagCategory: categoryRoute.tagCategory,
						chain,
						categoriesAndTags,
						chainMetadata: metadataCache.chainMetadata
					})

		if (!props)
			return {
				notFound: true
			}

		return {
			props,
			revalidate: maxAgeForNext([22])
		}
	}
)

export const getStaticPaths = () => {
	// When this is true (in preview environments) don't
	// prerender any static pages
	// (faster builds, but slower initial page load)
	if (SKIP_BUILD_STATIC_GENERATION) {
		return {
			paths: [],
			fallback: 'blocking'
		}
	}

	return { paths: [], fallback: 'blocking' }
}

const toggleOptions = tvlOptions.filter((key) => !['doublecounted', 'liquidstaking'].includes(key.key))

export default function Protocols(props: InferGetStaticPropsType<typeof getStaticProps>) {
	const categoryLabel = props.category ?? props.tag ?? ''
	const presentation = getProtocolCategoryPresentation({
		label: categoryLabel,
		effectiveCategory: props.effectiveCategory,
		isTagPage: !!props.tag && !props.category,
		chain: props.chain,
		protocolCount: props.protocols.length
	})
	const title = presentation.seoTitle
	const description = presentation.seoDescription
	const canonicalChainSuffix = props.chain ? `/${slug(props.chain)}` : ''
	return (
		<Layout
			title={title}
			description={description}
			canonicalUrl={`/protocols/${slug(props.category ? props.category : props.tag)}${canonicalChainSuffix}`}
			tvlOptions={toggleOptions}
		>
			<ProtocolTaxonomyPage {...props} />
		</Layout>
	)
}
