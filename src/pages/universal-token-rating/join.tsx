import type { InferGetStaticPropsType } from 'next'
import { ClaimTokenProfile } from '~/containers/UniversalTokenRating/ClaimTokenProfile'
import { exchangeOptionsFromScoringConfig, fetchUtrScoringConfig } from '~/containers/UniversalTokenRating/server'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('universal-token-rating/join', async () => {
	const scoringConfig = await fetchUtrScoringConfig()
	return {
		props: { scoringConfig, exchangeOptions: exchangeOptionsFromScoringConfig(scoringConfig) },
		revalidate: maxAgeForNext([22])
	}
})

export default function UniversalTokenRatingJoinPage({
	scoringConfig,
	exchangeOptions
}: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Apply for the Universal Token Rating - DefiLlama"
			description="Apply for the Universal Token Rating by submitting your token's disclosure and project information."
			canonicalUrl="/universal-token-rating/join"
			pageName={['Universal Token Rating', 'Apply for the Universal Token Rating']}
		>
			<ClaimTokenProfile variant="join" exchangeOptions={exchangeOptions} scoringConfig={scoringConfig} />
		</Layout>
	)
}
