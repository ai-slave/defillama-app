import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { tvlOptions } from '~/components/Filters/options'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { isProtocolListTvlKey } from '~/containers/ProtocolLists/api.types'
import { ProtocolTaxonomyPage } from '~/containers/ProtocolTaxonomy'
import { getProtocolCategoryPresentation } from '~/containers/ProtocolTaxonomy/constants'
import { getProtocolTaxonomyPageData } from '~/containers/ProtocolTaxonomy/queries'
import Layout from '~/layout'
import { slug } from '~/utils'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

export const getStaticProps = withPerformanceLogging(
	'protocols/[category]',
	async ({ params }: GetStaticPropsContext<{ category: string }>) => {
		if (!params?.category) {
			return { notFound: true }
		}

		const category = params.category
		const [{ default: metadataCache }, { resolveProtocolListingParamFromMetadata }] = await Promise.all([
			import('~/utils/metadata'),
			import('~/containers/ProtocolTaxonomy/server/routes')
		])
		const { categoriesAndTags } = metadataCache
		const categoryRoute = resolveProtocolListingParamFromMetadata(category, metadataCache)

		if (!categoryRoute) {
			return {
				notFound: true
			}
		}

		if (category !== categoryRoute.canonicalSlug) {
			return canonicalRouteRedirect(`/protocols/${categoryRoute.canonicalSlug}`)
		}

		const props =
			categoryRoute.kind === 'category'
				? await getProtocolTaxonomyPageData({
						kind: 'category',
						category: categoryRoute.value,
						categoriesAndTags,
						chainMetadata: metadataCache.chainMetadata
					})
				: await getProtocolTaxonomyPageData({
						kind: 'tag',
						tag: categoryRoute.value,
						tagCategory: categoryRoute.tagCategory,
						categoriesAndTags,
						chainMetadata: metadataCache.chainMetadata
					})

		if (!props)
			return {
				notFound: true
			}

		return {
			props: { ...props, year: new Date().getUTCFullYear() },
			revalidate: maxAgeForNext([22])
		}
	}
)

export async function getStaticPaths() {
	// When this is true (in preview environments) don't
	// prerender any static pages
	// (faster builds, but slower initial page load)
	if (SKIP_BUILD_STATIC_GENERATION) {
		return {
			paths: [],
			fallback: 'blocking'
		}
	}

	const { getProtocolListingStaticPaths } = await import('~/containers/ProtocolTaxonomy/server/routes')
	const paths = await getProtocolListingStaticPaths()

	return { paths, fallback: 'blocking' }
}

const toggleOptions = tvlOptions.filter((option) => isProtocolListTvlKey(option.key))

export default function Protocols(props: InferGetStaticPropsType<typeof getStaticProps>) {
	const categoryLabel = props.category ?? props.tag ?? ''
	const presentation = getProtocolCategoryPresentation({
		label: categoryLabel,
		effectiveCategory: props.effectiveCategory,
		isTagPage: !!props.tag && !props.category,
		protocolCount: props.protocols.length,
		year: props.year
	})
	const title = presentation.seoTitle
	const description = presentation.seoDescription
	return (
		<Layout
			title={title}
			description={description}
			canonicalUrl={`/protocols/${slug(props.category ? props.category : props.tag)}`}
			tvlOptions={toggleOptions}
		>
			<ProtocolTaxonomyPage {...props} />
		</Layout>
	)
}
