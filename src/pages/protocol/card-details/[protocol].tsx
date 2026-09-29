import type { GetStaticPropsContext, GetStaticPropsResult } from 'next'
import { CryptoCardDetailsPage, type CryptoCardDetailsPageProps } from '~/containers/CryptoCards/CardDetails'
import {
	findCryptoCardIssuerSlug,
	getCryptoCardIssuerName,
	getCryptoCardIssuerSlugs
} from '~/containers/CryptoCards/models'
import type { IProtocolPageMetrics } from '~/containers/ProtocolOverview/types'
import { tokenIconUrl } from '~/utils/icons'
import { withPerformanceLogging } from '~/utils/perf'

type CardDetailsRouteParams = { protocol?: string }

const EMPTY_PROTOCOL_METRICS: IProtocolPageMetrics = {
	tvl: false,
	dexs: false,
	dexsNotionalVolume: false,
	perps: false,
	openInterest: false,
	optionsPremiumVolume: false,
	optionsNotionalVolume: false,
	dexAggregators: false,
	perpsAggregators: false,
	bridgeAggregators: false,
	stablecoins: false,
	bridge: false,
	treasury: false,
	unlocks: false,
	incentives: false,
	yields: false,
	fees: false,
	revenue: false,
	forks: false,
	dev: false,
	inflows: false,
	activeUsers: false,
	newUsers: false,
	txCount: false,
	gasUsed: false,
	liquidationVolume: false,
	collateralLiquidated: false,
	borrowed: false,
	tokenRights: false,
	rwa: false
}

export const getStaticProps = withPerformanceLogging(
	'protocol/card-details/[protocol]',
	async (
		context: GetStaticPropsContext<CardDetailsRouteParams>
	): Promise<GetStaticPropsResult<CryptoCardDetailsPageProps>> => {
		const routeParam = context.params?.protocol
		if (!routeParam) return { notFound: true }

		const [
			{ default: metadataCache },
			{ resolveProtocolParamFromMetadata },
			{ fetchProtocolOverviewMetrics },
			{ getProtocolMetricFlags },
			{ getProtocolWarningBanners },
			{ fetchCardDetailFromNetwork, fetchCardsIndexFromNetwork },
			{ maxAgeForNext }
		] = await Promise.all([
			import('~/utils/metadata'),
			import('~/containers/ProtocolOverview/server/routes'),
			import('~/containers/ProtocolOverview/api'),
			import('~/containers/ProtocolOverview/queries'),
			import('~/containers/ProtocolOverview/utils'),
			import('~/containers/CryptoCards/server/upstream'),
			import('~/utils/maxAgeForNext')
		])

		const index = await fetchCardsIndexFromNetwork()
		const issuerSlug = findCryptoCardIssuerSlug(getCryptoCardIssuerSlugs(index.cards), routeParam)
		if (!issuerSlug) return { notFound: true, revalidate: maxAgeForNext([22]) }

		const issuerCards = index.cards.filter((card) => (card.parent_id ?? card.id) === issuerSlug)
		if (issuerCards.length === 0) return { notFound: true, revalidate: maxAgeForNext([22]) }

		const exactRoute = resolveProtocolParamFromMetadata(issuerSlug, metadataCache)
		const normalizedProtocolSlug = exactRoute
			? null
			: findCryptoCardIssuerSlug(Object.keys(metadataCache.protocolRouteIdBySlug), issuerSlug)
		const resolvedRoute =
			exactRoute ??
			(normalizedProtocolSlug ? resolveProtocolParamFromMetadata(normalizedProtocolSlug, metadataCache) : null)
		const route = resolvedRoute?.metadata.cex ? null : resolvedRoute
		const protocolData = route ? await fetchProtocolOverviewMetrics(route.canonicalSlug) : null

		const details = await Promise.all(issuerCards.map((card) => fetchCardDetailFromNetwork(card.id)))
		const detailByCardId = new Map(details.map((detail) => [detail.id, detail]))
		for (const card of issuerCards) {
			const detail = detailByCardId.get(card.id)
			if (!detail) throw new Error(`Missing crypto card detail for ${card.id}`)
			if (detail.version !== index.version) {
				throw new Error(`Crypto card cache version mismatch for ${card.id}: ${index.version} !== ${detail.version}`)
			}
		}
		const issuerName = protocolData?.name ?? getCryptoCardIssuerName(issuerSlug, index.cards) ?? issuerSlug
		const issuerLogo = issuerCards.find((card) => card.logo)?.logo ?? tokenIconUrl(issuerName)

		return {
			props: {
				issuerSlug,
				name: issuerName,
				logo: issuerLogo,
				overviewHref: protocolData && route ? `/protocol/${route.canonicalSlug}` : null,
				category: protocolData?.category ?? null,
				otherProtocols: protocolData?.otherProtocols ?? [],
				metrics:
					protocolData && route
						? getProtocolMetricFlags({ protocolData, metadata: route.metadata })
						: EMPTY_PROTOCOL_METRICS,
				warningBanners: protocolData ? getProtocolWarningBanners(protocolData) : [],
				cards: issuerCards.map((card) => ({ card, detail: detailByCardId.get(card.id)! })),
				countries: index.countries
			},
			revalidate: maxAgeForNext([22])
		}
	}
)

export const getStaticPaths = () => ({ paths: [], fallback: 'blocking' as const })

export default CryptoCardDetailsPage
