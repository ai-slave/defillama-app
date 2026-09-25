import type { GetStaticPropsContext } from 'next'
import { fetchCoinsChart } from '~/api'
import { fetchCoinPrices } from '~/api/pricing'
import type { PriceObject } from '~/api/types'
import { ExchangeProfile } from '~/containers/Exchanges/ExchangeProfile'
import { fetchExchangeVenueSeries } from '~/containers/Exchanges/master.api'
import type { ExchangeProfileModel } from '~/containers/Exchanges/models'
import { matchesDefillamaCex, nativeTokenChange24h } from '~/containers/Exchanges/profileEnrichment'
import { loadMasterExchangeProfile, MasterExchangeNotFoundError } from '~/containers/Exchanges/server/master.loaders'
import { isCanonicalExchangeSlug } from '~/containers/Exchanges/slugs'
import { fetchHacks } from '~/containers/Hacks/api'
import { fetchRaises } from '~/containers/Raises/api'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

interface ExchangePageProps {
	profile: ExchangeProfileModel
	asOfDate: string
}

const EMPTY_PRICES: Record<string, PriceObject> = {}

export const getStaticProps = withPerformanceLogging(
	'exchange/[slug]',
	async ({ params }: GetStaticPropsContext<{ slug: string }>) => {
		if (!params?.slug || !isCanonicalExchangeSlug(params.slug)) return { notFound: true }
		const slug = params.slug

		try {
			const baseProfile = await loadMasterExchangeProfile(slug)
			const [profile, reserves] = await Promise.all([
				enrichExchangeProfile(baseProfile),
				resolveProfileReserves(baseProfile.defillamaCexSlug)
			])
			return {
				props: {
					profile: { ...profile, reserves },
					asOfDate: new Date().toISOString().slice(0, 10)
				} satisfies ExchangePageProps,
				revalidate: maxAgeForNext([22])
			}
		} catch (error) {
			if (error instanceof MasterExchangeNotFoundError) return { notFound: true }
			throw error
		}
	}
)

async function enrichExchangeProfile(profile: ExchangeProfileModel): Promise<ExchangeProfileModel> {
	const priceKey = profile.nativeToken?.coinId ? `coingecko:${profile.nativeToken.coinId}` : null
	const oneDayAgo = Math.floor(Date.now() / 1000) - 86_400
	const [prices, priceHistory, hacks, raises] = await Promise.all([
		priceKey ? fetchCoinPrices([priceKey]).catch(() => EMPTY_PRICES) : EMPTY_PRICES,
		priceKey
			? fetchCoinsChart({ coin: priceKey, start: oneDayAgo, span: 24, searchWidth: '600' }).catch(() => ({ coins: {} }))
			: { coins: {} },
		profile.defillamaCexSlug ? fetchHacks().catch(() => []) : [],
		profile.defillamaCexSlug ? fetchRaises().catch(() => ({ raises: [] })) : { raises: [] }
	])
	const cexSlug = profile.defillamaCexSlug
	const priceUsd = priceKey ? (prices[priceKey]?.price ?? null) : null
	return {
		...profile,
		nativeToken: profile.nativeToken
			? { ...profile.nativeToken, priceUsd, change24h: nativeTokenChange24h(priceUsd, priceKey, priceHistory) }
			: null,
		hacks: cexSlug
			? hacks
					.filter((hack) => hack.targetType === 'CEX' && matchesDefillamaCex(hack.name, cexSlug))
					.map((hack) => ({
						date: hack.date,
						name: hack.name,
						amountUsd: hack.amountUsd,
						technique: hack.technique,
						returnedFundsUsd: hack.returnedFundsUsd
					}))
					.toSorted((a, b) => (b.date ?? 0) - (a.date ?? 0))
			: [],
		raises: cexSlug
			? raises.raises
					.filter((raise) => matchesDefillamaCex(raise.name, cexSlug))
					.map((raise) => ({
						date: raise.date,
						round: raise.round,
						amountUsd: raise.amountUsd,
						valuationUsd: raise.valuationUsd,
						investors: [...(raise.leadInvestors ?? []), ...(raise.otherInvestors ?? [])],
						sourceUrl: raise.source || null
					}))
					.toSorted((a, b) => b.date - a.date)
			: []
	}
}

/**
 * Reserve charts exist only for venues whose DefiLlama cex link resolves in
 * the protocol metadata cache with tracked wallet assets. Every such CEX keeps
 * both asset and stablecoin views available; transient chart failure is not
 * product absence.
 */
async function resolveProfileReserves(defillamaCexSlug: string | null): Promise<ExchangeProfileModel['reserves']> {
	if (!defillamaCexSlug) return null
	const [{ default: metadataCache }, { resolveCexParamFromMetadata }] = await Promise.all([
		import('~/utils/metadata'),
		import('~/containers/Cexs/server/routes')
	])
	const cexRoute = resolveCexParamFromMetadata(defillamaCexSlug, metadataCache)
	if (!cexRoute || !cexRoute.metadata.tvl) return null
	return {
		protocolSlug: cexRoute.canonicalSlug,
		ownToken: cexRoute.cexMetadata?.coin ?? null
	}
}

export const getStaticPaths = () => ({ paths: [], fallback: 'blocking' as const })

export default function ExchangePage({ profile, asOfDate }: ExchangePageProps) {
	const metadataOnly = profile.profileMode === 'metadata-only'
	return (
		<Layout
			title={
				metadataOnly
					? `${profile.name} Exchange Profile - DefiLlama`
					: `${profile.name} Exchange Markets and Liquidity - DefiLlama`
			}
			description={
				metadataOnly
					? `Review ${profile.name} exchange identity, regulation, fees, funding options, promotions, and official links.`
					: `Track ${profile.name} spot and perpetual volume, open interest, funding, order-book depth, fees, leverage, and market metadata.`
			}
			canonicalUrl={`/exchange/${encodeURIComponent(profile.slug)}`}
		>
			<ExchangeProfile key={profile.slug} profile={profile} asOfDate={asOfDate} loadSeries={fetchExchangeVenueSeries} />
		</Layout>
	)
}
