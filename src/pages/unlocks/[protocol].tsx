import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { LinkPreviewCard } from '~/components/SEO'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { EmissionsByProtocol } from '~/containers/Unlocks/EmissionsByProtocol'
import {
	calculateTotalUnlockValue,
	getEventCountdown,
	getProtocolUnlocksStaticPropsData
} from '~/containers/Unlocks/protocolUnlocksStaticProps'
import { nextUnlockIntro } from '~/containers/Unlocks/unlockIntro'
import Layout from '~/layout'
import { slug } from '~/utils'
import { tokenIconUrl } from '~/utils/icons'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { formatUsd } from '~/utils/numberFormat'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

export const getStaticProps = withPerformanceLogging(
	'unlocks/[protocol]',
	async ({ params }: GetStaticPropsContext<{ protocol: string }>) => {
		if (!params?.protocol) {
			return { notFound: true }
		}

		const metadataModule = await import('~/utils/metadata')
		const metadataCache = metadataModule.default
		const protocolSlug = slug(params.protocol)
		const canonicalProtocol = metadataCache.emissionsProtocolBySlug[protocolSlug]
		if (!canonicalProtocol) {
			return {
				notFound: true,
				revalidate: maxAgeForNext([22])
			}
		}
		if (params.protocol !== canonicalProtocol) {
			return canonicalRouteRedirect(`/unlocks/${canonicalProtocol}`)
		}

		const { emissions, tokenSymbol, initialTokenMarketData, generatedAtSec } = await getProtocolUnlocksStaticPropsData(
			canonicalProtocol,
			metadataCache.tokenlist,
			metadataCache.emissionsProtocolsList
		)

		if (!emissions) {
			return {
				notFound: true,
				revalidate: maxAgeForNext([22])
			}
		}

		const noUpcomingEvent = emissions.upcomingEvent[0]?.timestamp == null
		if (emissions.chartData.documented.length === 0 && emissions.chartData.realtime.length === 0) {
			return {
				notFound: true,
				revalidate: maxAgeForNext([22])
			}
		}
		const resolvedTokenSymbol = tokenSymbol ?? emissions.tokenPrice.symbol ?? null
		const displayName = emissions.name
		const named = `${displayName}${resolvedTokenSymbol ? ` (${resolvedTokenSymbol})` : ''}`
		const seoTitle = `${named} Unlock Schedule & Circulating Supply`
		const seoDescription = `See ${named} unlock cliffs, circulating supply, and the next unlock date on one vesting chart.`
		const unlockLead = nextUnlockIntro({ symbol: resolvedTokenSymbol, events: emissions.upcomingEvent })

		return {
			props: {
				emissions,
				totalUnlockValue: calculateTotalUnlockValue(emissions),
				eventCountdown: getEventCountdown(emissions.upcomingEvent[0]?.timestamp),
				noUpcomingEvent,
				initialTokenMarketData,
				generatedAtSec,
				canonicalProtocol,
				seoTitle,
				seoDescription,
				unlockLead
			},
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

export default function Protocol({
	emissions,
	totalUnlockValue,
	eventCountdown,
	noUpcomingEvent,
	initialTokenMarketData,
	generatedAtSec,
	canonicalProtocol,
	seoTitle,
	seoDescription,
	unlockLead
}: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout title={seoTitle} description={seoDescription} canonicalUrl={`/unlocks/${canonicalProtocol}`}>
			<LinkPreviewCard
				unlockPage
				cardName={emissions.name}
				logo={tokenIconUrl(emissions.name)}
				unlockAmount={
					totalUnlockValue === null
						? 'N/A'
						: formatUsd(totalUnlockValue, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})
				}
				tvl={noUpcomingEvent ? 'No Events' : eventCountdown}
			/>
			<EmissionsByProtocol
				data={emissions}
				isEmissionsPage
				initialTokenMarketData={initialTokenMarketData}
				generatedAtSec={generatedAtSec}
				disableClientTokenStatsFetch
				lead={unlockLead}
			/>
		</Layout>
	)
}
