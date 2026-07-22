import type { GetStaticPropsContext } from 'next'
import { fetchCoinsChart } from '~/api'
import { fetchCoinPrices } from '~/api/pricing'
import type { CoinsChartResponse } from '~/api/types'
import { ExchangeProfile } from '~/containers/Exchanges/ExchangeProfile'
import { fetchExchangeVenueSeries } from '~/containers/Exchanges/master.api'
import type { ExchangeProfileModel } from '~/containers/Exchanges/models'
import { loadMasterExchangeProfile, MasterExchangeNotFoundError } from '~/containers/Exchanges/server/master.loaders'
import { isCanonicalExchangeSlug } from '~/containers/Exchanges/slugs'
import { fetchHacks } from '~/containers/Hacks/api'
import { fetchRaises } from '~/containers/Raises/api'
import Layout from '~/layout'
import { getPercentChange } from '~/utils'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

interface ExchangePageProps {
	profile: ExchangeProfileModel
	asOfDate: string
}

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

export function matchesDefillamaCex(name: string, defillamaCexSlug: string): boolean {
	const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '')
	const normalizedCexSlug = defillamaCexSlug.replace(/-cex$/, '').replace(/[^a-z0-9]/g, '')
	return normalizedName === normalizedCexSlug
}

export function nativeTokenChange24h(
	priceUsd: number | null,
	priceKey: string | null,
	history: CoinsChartResponse
): number | null {
	if (priceUsd == null || !priceKey) return null
	const previousPrice = history.coins?.[priceKey]?.prices?.find((point) => Number.isFinite(point.price))?.price
	return getPercentChange(priceUsd, previousPrice)
}

async function enrichExchangeProfile(profile: ExchangeProfileModel): Promise<ExchangeProfileModel> {
	const priceKey = profile.nativeToken?.coinId ? `coingecko:${profile.nativeToken.coinId}` : null
	const oneDayAgo = Math.floor(Date.now() / 1000) - 86_400
	const [prices, priceHistory, hacks, raises] = await Promise.all([
		priceKey ? fetchCoinPrices([priceKey]).catch(() => ({})) : {},
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
						amountUsd: hack.amount,
						technique: hack.technique,
						returnedFundsUsd: hack.returnedFunds
					}))
					.toSorted((a, b) => (b.date ?? 0) - (a.date ?? 0))
			: [],
		raises: cexSlug
			? raises.raises
					.filter((raise) => matchesDefillamaCex(raise.name, cexSlug))
					.map((raise) => ({
						date: raise.date,
						round: raise.round,
						amountUsd: raise.amount == null ? null : raise.amount * 1_000_000,
						valuationUsd: raise.valuation == null ? null : raise.valuation * 1_000_000,
						investors: [...(raise.leadInvestors ?? []), ...(raise.otherInvestors ?? [])],
						sourceUrl: raise.source || null
					}))
					.toSorted((a, b) => b.date - a.date)
			: []
	}
}

/**
 * Reserve charts exist only for venues whose DefiLlama cex link resolves in
 * the protocol metadata cache with tracked wallet assets — the same gating the
 * legacy /cex tabs use.
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
		hasStablecoins: Boolean(cexRoute.metadata.stablecoins),
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
