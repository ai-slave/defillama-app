import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { UtrAccessGate } from '~/containers/UniversalTokenRating/AccessGate'
import { getMockUniverse } from '~/containers/UniversalTokenRating/mocks'
import {
	fetchIconDataUrl,
	fetchUtrAssetExchanges,
	fetchUtrAssetResponse,
	fetchUtrBatchMetrics,
	fetchUtrScoringDocs
} from '~/containers/UniversalTokenRating/server'
import { TokenPage } from '~/containers/UniversalTokenRating/TokenPage'
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
		const mockRow = getMockUniverse().rows.find((entry) => entry.asset === asset) ?? null
		if (mockRow) {
			return {
				props: { row: mockRow, live: null, legacy: null, exchanges: null, scoringDocs: null, iconDataUrl: null },
				revalidate: maxAgeForNext([22])
			}
		}
		const live = await fetchUtrAssetResponse(asset)
		if (!live) return { notFound: true, revalidate: maxAgeForNext([22]) }
		const [batch, exchanges, scoringDocs, iconDataUrl] = await Promise.all([
			live.coingeckoId ? fetchUtrBatchMetrics([live.coingeckoId]) : null,
			fetchUtrAssetExchanges(asset),
			fetchUtrScoringDocs(),
			live.coingeckoId ? fetchIconDataUrl(live.coingeckoId) : null
		])
		const legacy = batch?.assets[0] ?? null
		return { props: { row: null, live, legacy, exchanges, scoringDocs, iconDataUrl }, revalidate: maxAgeForNext([22]) }
	}
)

export default function UniversalTokenRatingTokenPage({
	row,
	live,
	legacy,
	exchanges,
	scoringDocs,
	iconDataUrl
}: InferGetStaticPropsType<typeof getStaticProps>) {
	const name = live?.projectName ?? row?.name ?? ''
	const asset = live?.coingeckoId ?? live?.arcticId ?? row?.asset ?? ''
	return (
		<Layout
			title={`${name} - Universal Token Rating - DefiLlama`}
			description={`Universal Token Rating profile for ${name}: disclosure and market performance scores.`}
			canonicalUrl={`/universal-token-rating/token/${asset}`}
			pageName={['Universal Token Rating', name]}
		>
			<UtrAccessGate>
				{live ? (
					<TokenPageLive
						asset={live}
						legacy={legacy}
						exchanges={exchanges}
						scoringDocs={scoringDocs}
						iconDataUrl={iconDataUrl}
					/>
				) : row ? (
					<TokenPage row={row} />
				) : null}
			</UtrAccessGate>
		</Layout>
	)
}
