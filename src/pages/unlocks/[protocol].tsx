import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { LinkPreviewCard } from '~/components/SEO'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import type { EmissionEvent } from '~/containers/Unlocks/api.types'
import { EmissionsByProtocol } from '~/containers/Unlocks/EmissionsByProtocol'
import { getEmissionEventAmount } from '~/containers/Unlocks/eventAmount'
import {
	calculateTotalUnlockValue,
	getEventCountdown,
	getProtocolUnlocksStaticPropsData
} from '~/containers/Unlocks/protocolUnlocksStaticProps'
import Layout from '~/layout'
import { slug } from '~/utils'
import { formatDate } from '~/utils/dateFormat'
import { tokenIconUrl } from '~/utils/icons'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { formatCompactNumber, formatUsd } from '~/utils/numberFormat'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

function nextUnlockIntro(input: { symbol: string | null; events: ReadonlyArray<EmissionEvent> }): string | null {
	const { symbol, events } = input
	if (!symbol || events.length === 0) return null
	const date = formatDate(events[0].timestamp, { input: 'seconds' })
	if (!date) return null

	let cliffTotal = 0
	let cliffKnown = false
	let weeklyTotal = 0
	let linearKnown = false
	let unknown = false
	for (const event of events) {
		const amount = getEmissionEventAmount(event)
		if (amount == null) {
			unknown = true
			continue
		}
		if (event.unlockType === 'cliff') {
			cliffTotal += amount
			cliffKnown = true
		} else {
			weeklyTotal += amount
			linearKnown = true
		}
	}
	if (!cliffKnown && !linearKnown) return null

	const cliff = cliffKnown ? formatCompactNumber(cliffTotal, { compactSuffix: 'lowercase' }) : null
	const weekly = linearKnown ? formatCompactNumber(weeklyTotal, { compactSuffix: 'lowercase' }) : null
	if (cliffKnown && !cliff) return null
	if (linearKnown && !weekly) return null

	const release =
		cliff && weekly
			? `releasing ${cliff} ${symbol} on that date and ${weekly} ${symbol} per week`
			: cliff
				? `releasing ${cliff} ${symbol}`
				: `releasing ${weekly} ${symbol} per week`
	const caveat = unknown ? ' Some of the amount is not published.' : ''
	return `The next ${symbol} unlock is ${date}, ${release}.${caveat}`
}

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
