import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { RWAOverview } from '~/containers/RWA'
import { buildRWAPlatformPageData } from '~/containers/RWA/PlatformPage/buildPlatformPageData'
import { getRWAPlatformRoutes } from '~/containers/RWA/platformRoutes'
import { getRWAAssetsOverview } from '~/containers/RWA/queries'
import { rwaSlug } from '~/containers/RWA/rwaSlug'
import { RWATabNav } from '~/containers/RWA/TabNav'
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
		paths: getRWAPlatformRoutes(rwaList)
			.slice(0, 10)
			.map((platform) => ({ params: { platform: platform.slug } })),
		fallback: 'blocking'
	}
}

export const getStaticProps = withPerformanceLogging(
	`rwa/platform/[platform]`,
	async ({ params }: GetStaticPropsContext<{ platform: string }>) => {
		if (!params?.platform) {
			return { notFound: true }
		}

		const platformSlug = rwaSlug(params.platform)

		let platformName = null
		const metadataCache = await import('~/utils/metadata').then((m) => m.default)
		const rwaList = metadataCache.rwaList
		const platformsIndex = metadataCache.rwaPlatformsIndex
		for (const platform of getRWAPlatformRoutes(rwaList)) {
			if (platform.slug === platformSlug) {
				platformName = platform.name
				break
			}
		}

		if (!platformName) {
			return { notFound: true }
		}

		if (params.platform !== platformSlug) {
			return canonicalRouteRedirect(`/rwa/platform/${platformSlug}`)
		}

		const props = await getRWAAssetsOverview({ platform: platformSlug, rwaList })

		if (!props) {
			return { notFound: true, revalidate: maxAgeForNext([22]) }
		}

		const meta = platformsIndex.platforms[platformSlug] ?? null
		const platformPage =
			meta && props.platformAssetSummary
				? buildRWAPlatformPageData({
						meta,
						assetSummary: props.platformAssetSummary
					})
				: null

		return {
			props: { ...props, platformPage, platformName },
			revalidate: maxAgeForNext([22])
		}
	}
)

const pageName = ['RWA']

export default function RWAPage(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title={`${props.platformName} RWA Dashboard & Analytics - DefiLlama`}
			description={
				props.platformPage?.meta.description ??
				`Explore ${props.platformName}, an RWA platform enabling issuance, custody, trading, or management of tokenized real-world assets across blockchains.`
			}
			pageName={pageName}
			canonicalUrl={`/rwa/platform/${props.platformSlug}`}
		>
			<RWATabNav active="platforms" />
			<RWAOverview {...props} />
		</Layout>
	)
}
