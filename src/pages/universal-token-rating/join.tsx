import type { InferGetStaticPropsType } from 'next'
import { ClaimTokenProfile } from '~/containers/UniversalTokenRating/ClaimTokenProfile'
import {
	exchangeOptionsFromScoringConfig,
	fetchUtrClaimMarketMakerOptions,
	fetchUtrScoringConfig
} from '~/containers/UniversalTokenRating/server'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('universal-token-rating/join', async () => {
	const [scoringConfig, marketMakerOptions] = await Promise.all([
		fetchUtrScoringConfig(),
		fetchUtrClaimMarketMakerOptions()
	])
	return {
		props: { scoringConfig, exchangeOptions: exchangeOptionsFromScoringConfig(scoringConfig), marketMakerOptions },
		revalidate: maxAgeForNext([22])
	}
})

export default function UniversalTokenRatingJoinPage({
	scoringConfig,
	exchangeOptions,
	marketMakerOptions
}: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Apply for the Universal Token Rating - DefiLlama"
			description="Apply for the Universal Token Rating by submitting your project affiliation details."
			canonicalUrl="/universal-token-rating/join"
			pageName={['Universal Token Rating', 'Apply for the Universal Token Rating']}
		>
			<ClaimTokenProfile
				variant="join"
				exchangeOptions={exchangeOptions}
				marketMakerOptions={marketMakerOptions}
				scoringConfig={scoringConfig}
			/>
		</Layout>
	)
}
