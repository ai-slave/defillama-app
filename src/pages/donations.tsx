import { TokenLogo } from '~/components/TokenLogo'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import Layout from '~/layout'
import { Card } from '~/ui/Card'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'

const hideProtocols = new Set(['Mycelium', 'Hubble Exchange', 'NEX'])

export const getStaticProps = withPerformanceLogging('donations', async () => {
	const { protocols, parentProtocols } = await fetchProtocols()

	const protocolsWithReferralurl: Record<string, { name: string; logo: string; url: string; tvl: number }> = {}

	for (const parent of parentProtocols) {
		if (parent.referralUrl == null) continue
		protocolsWithReferralurl[parent.id] = {
			name: parent.name,
			logo: parent.logo ?? '',
			url: parent.referralUrl,
			tvl: 0
		}
	}

	for (const protocol of protocols) {
		if (protocolsWithReferralurl[protocol.parentProtocol]) {
			protocolsWithReferralurl[protocol.parentProtocol].tvl =
				(protocolsWithReferralurl[protocol.parentProtocol].tvl ?? 0) + (protocol.tvl ?? 0)
		}
		if (protocol.referralUrl == null) continue

		if (
			protocol.parentProtocol
				? protocolsWithReferralurl[protocol.parentProtocol] &&
					protocolsWithReferralurl[protocol.parentProtocol].url !== protocol.referralUrl
				: true
		) {
			protocolsWithReferralurl[protocol.defillamaId] = {
				name: protocol.name,
				logo: protocol.logo,
				url: protocol.referralUrl,
				tvl: protocol.tvl ?? 0
			}
		}
	}

	const finalProtocols = []
	for (const protocol in protocolsWithReferralurl) {
		if (hideProtocols.has(protocolsWithReferralurl[protocol].name)) continue
		finalProtocols.push(protocolsWithReferralurl[protocol])
	}

	return {
		props: {
			protocols: finalProtocols.sort((a, b) => b.tvl - a.tvl)
		},
		revalidate: maxAgeForNext([22])
	}
})

function DonationsPage({ protocols }) {
	return (
		<Layout
			title="DefiLlama Affiliate Links"
			description="DefiLlama affiliate links for protocols with referrals."
			canonicalUrl="/donations"
		>
			<Card as="section" padding="sm" className="flex flex-col gap-4">
				<h1 className="heading-xs">Affiliate links</h1>
				<hr className="border-subtle" />
				<div className="flex flex-col gap-3">
					<p>
						DefiLlama has referral links for all these protocols, using them with our referral sends us some rewards:
					</p>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
						{protocols.map((p) => (
							<a
								key={p.name}
								className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-hover-row focus-visible:bg-hover-row"
								target="_blank"
								rel="noopener noreferrer"
								href={p.url}
							>
								<TokenLogo src={p.logo} alt={`${p.name} logo`} size={24} />
								<span className="truncate body-sm text-link">{p.name}</span>
							</a>
						))}
					</div>
				</div>
			</Card>
		</Layout>
	)
}

export default DonationsPage
