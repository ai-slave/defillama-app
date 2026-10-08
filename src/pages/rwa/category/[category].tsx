import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { RWAOverview } from '~/containers/RWA'
import { filterCategoriesForStandardRwaOverview } from '~/containers/RWA/constants'
import { getRwaPageMeta } from '~/containers/RWA/layout/pageCopy'
import { fetchRwaPageQuestions } from '~/containers/RWA/layout/questions.server'
import { getRWAAssetsOverview } from '~/containers/RWA/queries'
import { rwaSlug } from '~/containers/RWA/rwaSlug'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

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

	const metadataCache = await import('~/utils/metadata').then((m) => m.default)
	const rwaList = metadataCache.rwaList
	return {
		paths: filterCategoriesForStandardRwaOverview(rwaList.categories)
			.slice(0, 10)
			.map((category) => ({ params: { category: rwaSlug(category) } })),
		fallback: 'blocking'
	}
}

export const getStaticProps = withPerformanceLogging(
	`rwa/category/[category]`,
	async ({ params }: GetStaticPropsContext<{ category: string }>) => {
		if (!params?.category) {
			return { notFound: true }
		}

		const categorySlug = rwaSlug(params.category)

		let categoryName = null
		const metadataCache = await import('~/utils/metadata').then((m) => m.default)
		const rwaList = metadataCache.rwaList
		for (const category of filterCategoriesForStandardRwaOverview(rwaList.categories)) {
			if (rwaSlug(category) === categorySlug) {
				categoryName = category
				break
			}
		}
		if (!categoryName) {
			return { notFound: true }
		}

		if (params.category !== categorySlug) {
			return canonicalRouteRedirect(`/rwa/category/${categorySlug}`)
		}

		const props = await getRWAAssetsOverview({
			category: categorySlug,
			rwaList,
			rwaPlatformsIndex: metadataCache.rwaPlatformsIndex
		})

		if (!props) {
			return { notFound: true, revalidate: maxAgeForNext([22]) }
		}

		const entityQuestions = await fetchRwaPageQuestions({
			kind: 'category',
			scopeName: categoryName,
			rows: props.assets,
			defaultInclusion: props.defaultInclusion
		})

		return {
			props: { ...props, categoryName, entityQuestions },
			revalidate: maxAgeForNext([22])
		}
	}
)

const pageName = ['RWA']

export default function RWAPage(props: InferGetStaticPropsType<typeof getStaticProps>) {
	const meta = getRwaPageMeta('category', { name: props.categoryName, slug: props.categorySlug ?? '' })
	return (
		<Layout title={meta.title} description={meta.description} pageName={pageName} canonicalUrl={meta.canonicalUrl}>
			<RWAOverview {...props} pageKind="category" />
		</Layout>
	)
}
