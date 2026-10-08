import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { RWAOverview } from '~/containers/RWA'
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
		paths: rwaList.chains.slice(0, 10).map((chain) => ({ params: { chain: rwaSlug(chain) } })),
		fallback: 'blocking'
	}
}

export const getStaticProps = withPerformanceLogging(
	`rwa/chain/[chain]`,
	async ({ params }: GetStaticPropsContext<{ chain: string }>) => {
		if (!params?.chain) {
			return { notFound: true }
		}

		const chainSlug = rwaSlug(params.chain)

		let chainName = null
		const metadataCache = await import('~/utils/metadata').then((m) => m.default)
		const rwaList = metadataCache.rwaList
		for (const chain of rwaList.chains) {
			if (rwaSlug(chain) === chainSlug) {
				chainName = chain
				break
			}
		}
		if (!chainName) {
			return { notFound: true }
		}

		if (params.chain !== chainSlug) {
			return canonicalRouteRedirect(`/rwa/chain/${chainSlug}`)
		}

		const props = await getRWAAssetsOverview({
			chain: chainSlug,
			rwaList,
			rwaPlatformsIndex: metadataCache.rwaPlatformsIndex
		})

		if (!props) {
			return { notFound: true, revalidate: maxAgeForNext([22]) }
		}

		const entityQuestions = await fetchRwaPageQuestions({
			kind: 'chain',
			scopeName: chainName,
			rows: props.assets,
			defaultInclusion: props.defaultInclusion
		})

		return {
			props: { ...props, chainName, entityQuestions },
			revalidate: maxAgeForNext([22])
		}
	}
)

const pageName = ['RWA']

export default function RWAPage(props: InferGetStaticPropsType<typeof getStaticProps>) {
	const meta = getRwaPageMeta('chain', { name: props.chainName, slug: props.chainSlug ?? '' })
	return (
		<Layout title={meta.title} description={meta.description} pageName={pageName} canonicalUrl={meta.canonicalUrl}>
			<RWAOverview {...props} pageKind="chain" />
		</Layout>
	)
}
