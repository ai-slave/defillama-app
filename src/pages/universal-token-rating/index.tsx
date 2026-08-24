import type { InferGetStaticPropsType } from 'next'
import { UniversalTokenRating } from '~/containers/UniversalTokenRating'
import { UtrAccessGate } from '~/containers/UniversalTokenRating/AccessGate'
import {
	fetchUtrLeaderboardMom,
	fetchUtrScoringConfig,
	fetchUtrUniverseWithLive
} from '~/containers/UniversalTokenRating/server'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('universal-token-rating', async () => {
	const [universe, mom, scoringConfig] = await Promise.all([
		fetchUtrUniverseWithLive(),
		fetchUtrLeaderboardMom(),
		fetchUtrScoringConfig()
	])
	const assetByName = new Map(universe.rows.map((row) => [row.name.toLowerCase(), row.asset]))
	const liveMovers = (mom?.rows ?? [])
		.filter((row) => row.momChangePct != null)
		.sort((a, b) => Math.abs(b.momChangePct!) - Math.abs(a.momChangePct!))
		.slice(0, 8)
		.map((row) => ({
			asset: assetByName.get(row.projectName.toLowerCase()) ?? '',
			name: row.projectName,
			momChangePct: row.momChangePct!,
			logoUrl: row.logoUrl
		}))
	return {
		props: { universe, topMovers: liveMovers, scoringConfig },
		revalidate: maxAgeForNext([22])
	}
})

export default function UniversalTokenRatingPage(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Universal Token Rating - DefiLlama"
			description="Universal Token Rating: data-driven token scores across disclosures and market performance."
			canonicalUrl="/universal-token-rating"
			pageName={['Universal Token Rating']}
		>
			<UtrAccessGate>
				<UniversalTokenRating {...props} />
			</UtrAccessGate>
		</Layout>
	)
}
