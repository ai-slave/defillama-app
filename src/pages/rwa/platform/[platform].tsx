import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { RWAOverview } from '~/containers/RWA'
import { getRwaPageMeta } from '~/containers/RWA/layout/pageCopy'
import { fetchRwaPageQuestions } from '~/containers/RWA/layout/questions.server'
import {
	getRwaPerpsOnlyPlatformSlugs,
	getRwaPlatformPageOutcome,
	getRWAPlatformRoutes
} from '~/containers/RWA/platformRoutes'
import { getRWAAssetsOverview } from '~/containers/RWA/queries'
import { findByRwaSlug, rwaSlug } from '~/containers/RWA/rwaSlug'
import { keepKnownProtocolSlug } from '~/containers/RWA/server/protocolLink'
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
	// A prerendered path may not redirect (Next fails the build), so the platforms that send to their venue are left out.
	const redirecting = getRwaPerpsOnlyPlatformSlugs(metadataCache)
	return {
		paths: getRWAPlatformRoutes(rwaList)
			.filter((platform) => !redirecting.has(platform.slug))
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
			return { notFound: true, revalidate: maxAgeForNext([22]) }
		}

		if (params.platform !== platformSlug) {
			return canonicalRouteRedirect(`/rwa/platform/${platformSlug}`)
		}

		const props = await getRWAAssetsOverview({
			platform: platformSlug,
			rwaList,
			rwaPlatformsIndex: metadataCache.rwaPlatformsIndex,
			redirectingPlatforms: getRwaPerpsOnlyPlatformSlugs(metadataCache)
		})

		const meta = platformsIndex.platforms[platformSlug] ?? null
		if (!props) {
			return { notFound: true, revalidate: maxAgeForNext([22]) }
		}
		// The page is spot only: a platform that only runs a perps venue goes to its venue page. The venue comes from
		// the list the venue route resolves against, so the redirect never lands on a 404.
		const outcome = getRwaPlatformPageOutcome({
			spotRows: props.assets.filter((asset) => asset.kind === 'spot').length,
			meta,
			perpsVenue: findByRwaSlug(platformSlug, metadataCache.rwaPerpsList.venues)
		})
		if (outcome.kind === 'notFound') {
			return { notFound: true, revalidate: maxAgeForNext([22]) }
		}
		if (outcome.kind === 'redirect') {
			return { ...canonicalRouteRedirect(outcome.destination), revalidate: maxAgeForNext([22]) }
		}
		const platformPage = meta ? { meta: keepKnownProtocolSlug(meta, metadataCache) } : null
		const entityQuestions = await fetchRwaPageQuestions({
			kind: 'platform',
			scopeName: platformName,
			rows: props.assets,
			defaultInclusion: props.defaultInclusion
		})

		return {
			props: { ...props, platformPage, platformName, perpsVenueHref: outcome.perpsVenueHref, entityQuestions },
			revalidate: maxAgeForNext([22])
		}
	}
)

const pageName = ['RWA']

export default function RWAPage(props: InferGetStaticPropsType<typeof getStaticProps>) {
	const meta = getRwaPageMeta(
		'platform',
		{ name: props.platformName, slug: props.platformSlug },
		props.platformPage?.meta.description
	)
	return (
		<Layout title={meta.title} description={meta.description} pageName={pageName} canonicalUrl={meta.canonicalUrl}>
			<RWAOverview {...props} pageKind="platform" />
		</Layout>
	)
}
