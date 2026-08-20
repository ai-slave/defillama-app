import { UtrAccessGate } from '~/containers/UniversalTokenRating/AccessGate'
import { ClaimTokenProfile } from '~/containers/UniversalTokenRating/ClaimTokenProfile'
import Layout from '~/layout'

export default function UniversalTokenRatingJoinPage() {
	return (
		<Layout
			title="Join the Universal Token Rating - DefiLlama"
			description="Join the Universal Token Rating to get your token scored on disclosures and market performance."
			canonicalUrl="/universal-token-rating/join"
			pageName={['Universal Token Rating', 'Join']}
		>
			<UtrAccessGate>
				<ClaimTokenProfile variant="join" />
			</UtrAccessGate>
		</Layout>
	)
}
