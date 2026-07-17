import type { GetStaticPropsContext } from 'next'
import { ExchangeProfile } from '~/containers/Exchanges/ExchangeProfile'
import { fetchExchangeVenueSeries } from '~/containers/Exchanges/master.api'
import type { ExchangeProfileModel } from '~/containers/Exchanges/models'
import { loadMasterExchangeProfile, MasterExchangeNotFoundError } from '~/containers/Exchanges/server/master.loaders'
import { isCanonicalExchangeSlug } from '~/containers/Exchanges/slugs'
import Layout from '~/layout'
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
			const profile = await loadMasterExchangeProfile(slug)
			return {
				props: {
					profile: { ...profile, reserves: await resolveProfileReserves(profile.defillamaCexSlug) },
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
