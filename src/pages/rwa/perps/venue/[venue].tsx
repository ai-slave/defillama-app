import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { getRwaPageMeta } from '~/containers/RWA/layout/pageCopy'
import { fetchRwaPageQuestions } from '~/containers/RWA/layout/questions.server'
import { unpackRwaPerpsMarkets } from '~/containers/RWA/perpsPayload'
import { findByRwaSlug, rwaSlug } from '~/containers/RWA/rwaSlug'
import { keepKnownProtocolSlug } from '~/containers/RWA/server/protocolLink'
import { RWAVenuePage } from '~/containers/RWA/VenuePage/VenuePage'
import { getRWAVenuePageProps } from '~/containers/RWA/VenuePage/venuePageData'
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
		paths: metadataCache.rwaPerpsList.venues.slice(0, 10).map((venue) => ({ params: { venue: rwaSlug(venue) } })),
		fallback: 'blocking'
	}
}

export const getStaticProps = withPerformanceLogging(
	'rwa/perps/venue/[venue]',
	async ({ params }: GetStaticPropsContext<{ venue: string }>) => {
		if (!params?.venue) {
			return { notFound: true }
		}

		const metadataCache = await import('~/utils/metadata').then((m) => m.default)
		const venue = findByRwaSlug(params.venue, metadataCache.rwaPerpsList.venues)
		if (!venue) {
			return { notFound: true }
		}

		const venueSlug = rwaSlug(venue)

		if (params.venue !== venueSlug) {
			return canonicalRouteRedirect(`/rwa/perps/venue/${venueSlug}`)
		}

		const props = await getRWAVenuePageProps({
			venue,
			rwaPerpsList: metadataCache.rwaPerpsList,
			rwaPlatformsIndex: metadataCache.rwaPlatformsIndex,
			rwaList: metadataCache.rwaList
		})
		if (!props) {
			return { notFound: true, revalidate: maxAgeForNext([22]) }
		}

		const entityQuestions = await fetchRwaPageQuestions({
			kind: 'venue',
			scopeName: venue,
			rows: unpackRwaPerpsMarkets(props.markets)
		})

		return {
			props: { ...props, meta: props.meta && keepKnownProtocolSlug(props.meta, metadataCache), entityQuestions },
			revalidate: maxAgeForNext([22])
		}
	}
)

const pageName = ['RWA Perps']

export default function RWAPerpsVenueRoute(props: InferGetStaticPropsType<typeof getStaticProps>) {
	const meta = getRwaPageMeta('venue', { name: props.venue, slug: props.venueSlug })
	return (
		<Layout title={meta.title} description={meta.description} pageName={pageName} canonicalUrl={meta.canonicalUrl}>
			<RWAVenuePage {...props} />
		</Layout>
	)
}
