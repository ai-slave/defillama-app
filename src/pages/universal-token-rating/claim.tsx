import { UtrAccessGate } from '~/containers/UniversalTokenRating/AccessGate'
import { ClaimTokenProfile } from '~/containers/UniversalTokenRating/ClaimTokenProfile'
import Layout from '~/layout'

export default function UniversalTokenRatingClaimPage() {
	return (
		<Layout
			title="Claim Your Token Profile - Universal Token Rating - DefiLlama"
			description="Claim your token profile in the Universal Token Rating to add information and improve your scores."
			canonicalUrl="/universal-token-rating/claim"
			pageName={['Universal Token Rating', 'Claim']}
		>
			<UtrAccessGate>
				<ClaimTokenProfile />
			</UtrAccessGate>
		</Layout>
	)
}
