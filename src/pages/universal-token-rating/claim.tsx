import type { InferGetStaticPropsType } from 'next'
import { ClaimTokenProfile } from '~/containers/UniversalTokenRating/ClaimTokenProfile'
import {
	fetchUtrDisclosureScoreSummaries,
	exchangeOptionsFromScoringConfig,
	fetchUtrScoringConfig,
	fetchUtrProjects
} from '~/containers/UniversalTokenRating/server'
import type { UtrClaimProjectOption } from '~/containers/UniversalTokenRating/types'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

export const getStaticProps = withPerformanceLogging('universal-token-rating/claim', async () => {
	const [projects, scoreSummaries, scoringConfig] = await Promise.all([
		fetchUtrProjects(),
		fetchUtrDisclosureScoreSummaries(),
		fetchUtrScoringConfig()
	])
	const exchangeOptions = exchangeOptionsFromScoringConfig(scoringConfig)
	const scoreByProject = new Map(scoreSummaries.map((summary) => [summary.arcticId, summary]))
	const projectOptions = projects.reduce<UtrClaimProjectOption[]>((options, project) => {
		if (project.isActive) {
			const summary = scoreByProject.get(project.arcticId)
			options.push({
				arcticId: project.arcticId,
				projectName: project.projectName,
				symbol: project.symbol,
				tgeStatus: project.tgeStatus,
				disclosureScore: summary?.disclosureScore ?? null,
				gradedCount: summary?.gradedCount ?? 0,
				criteriaCount: summary?.criteriaCount ?? 0
			})
		}
		return options
	}, [])
	projectOptions.sort((a, b) => a.projectName.localeCompare(b.projectName))

	return {
		props: { projects: projectOptions, exchangeOptions, scoringConfig },
		revalidate: maxAgeForNext([22])
	}
})

export default function UniversalTokenRatingClaimPage({
	projects,
	exchangeOptions,
	scoringConfig
}: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title="Claim Your Token Profile - Universal Token Rating - DefiLlama"
			description="Claim your token profile in the Universal Token Rating to add information and improve your scores."
			canonicalUrl="/universal-token-rating/claim"
			pageName={['Universal Token Rating', 'Claim']}
		>
			<ClaimTokenProfile projects={projects} exchangeOptions={exchangeOptions} scoringConfig={scoringConfig} />
		</Layout>
	)
}
