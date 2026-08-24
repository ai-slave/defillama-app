import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { UtrAccessGate } from '~/containers/UniversalTokenRating/AccessGate'
import {
	fetchIconDataUrl,
	fetchUtrAssetExchanges,
	fetchUtrAssetResponse,
	fetchUtrBatchMetrics,
	fetchUtrScoringConfig
} from '~/containers/UniversalTokenRating/server'
import { TokenPageLive } from '~/containers/UniversalTokenRating/TokenPageLive'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export async function getStaticPaths() {
	return { paths: [], fallback: 'blocking' }
}

export const getStaticProps = withPerformanceLogging(
	'universal-token-rating/token',
	async ({ params }: GetStaticPropsContext) => {
		const asset = typeof params?.asset === 'string' ? params.asset : null
		if (!asset || !/^[a-z0-9-]{1,64}$/.test(asset)) return { notFound: true, revalidate: maxAgeForNext([22]) }
		const live = await fetchUtrAssetResponse(asset)
		if (!live) return { notFound: true, revalidate: maxAgeForNext([22]) }
		const [batch, exchanges, scoringConfig, iconDataUrl] = await Promise.all([
			live.coingeckoId ? fetchUtrBatchMetrics([live.coingeckoId]) : null,
			fetchUtrAssetExchanges(asset),
			fetchUtrScoringConfig(),
			live.coingeckoId ? fetchIconDataUrl(live.coingeckoId) : null
		])
		const legacy = batch?.assets[0] ?? null
		return { props: { live, legacy, exchanges, scoringConfig, iconDataUrl }, revalidate: maxAgeForNext([22]) }
	}
)

export default function UniversalTokenRatingTokenPage({
	live,
	legacy,
	exchanges,
	scoringConfig,
	iconDataUrl
}: InferGetStaticPropsType<typeof getStaticProps>) {
	const name = live.projectName
	const asset = live.coingeckoId ?? live.arcticId
	return (
		<Layout
			title={`${name} - Universal Token Rating - DefiLlama`}
			description={`Universal Token Rating profile for ${name}: disclosure and market performance scores.`}
			canonicalUrl={`/universal-token-rating/token/${asset}`}
			pageName={['Universal Token Rating', name]}
		>
			<UtrAccessGate>
				<TokenPageLive
					asset={live}
					legacy={legacy}
					exchanges={exchanges}
					scoringConfig={scoringConfig}
					iconDataUrl={iconDataUrl}
				/>
			</UtrAccessGate>
		</Layout>
	)
}
